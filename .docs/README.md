# Patrones de Diseño en el Feed de Publicaciones

## Problemas Identificados

### 1. Lógica de Ranking Mezclada en el Controlador
**Problema:** El ordenamiento del feed (`GET /api/posts/feed`) contenía lógica compleja y repetitiva en `posts.controller.ts`. Había un switch statement de 60+ líneas decidiendo cómo ordenar posts según `mode` (latest, mostLiked, mostCommented, relevance).

```typescript
// ❌ ANTES: Todo en el controlador
switch (mode) {
    case "latest":
        sorted = sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        break
    case "mostLiked":
        sorted = sorted.sort((a, b) => b.likesCount - a.likesCount)
        break
    // ... más casos
}
```

**Impacto:**
- Difícil de extender con nuevos modos de ordenamiento
- Responsabilidades mezcladas: validación, mapeo, ranking
- Difícil de testear

---

### 2. Moderación Legacy sin Adaptación
**Problema:** El cliente legacy `legacyModerationApi` devolvía tipos inconsistentes (string `"OK"` / `"BLOCK"`, number, object), y la lógica de interpretación estaba duplicada en el controlador.

```typescript
// ❌ ANTES: Lógica dispersa y frágil
const moderation = legacyModerationApi.review(body.content)
let blocked = false
if (moderation === "BLOCK") {
    blocked = true
} else if (typeof moderation === "number") {
    blocked = moderation < 1
} else if (typeof moderation === "object") {
    blocked = !("pass" in moderation && moderation.pass)
}
```

**Impacto:**
- Acoplamiento directo con cliente legacy
- Lógica compleja y propensa a errores
- Difícil cambiar la fuente de moderación

---

### 3. Creación de Entidades Repetida
**Problema:** La construcción de `PostEntity`, `CommentEntity` y `LikeEntity` ocurría en múltiples lugares con cálculos derivados duplicados.

```typescript
// ❌ ANTES: Construcción manual en varias rutas
const entity = new CommentEntity(
    comment.id,
    comment.postId,
    comment.content,
    comment.createdAt,
    comment.updatedAt,
    comment.source,
    "approved",
    comment.content.length > 60 ? 80 : 40,
    false,
    "es",
    { moderation, source: "legacy" },
)
```

**Impacto:**
- Código duplicado
- Inconsistencia en la construcción
- Cambios futuros requieren actualizar múltiples lugares

---

### 4. Efectos Secundarios Mezclados
**Problema:** Notificaciones, eventos y recomputo estaban inline en cada ruta.

```typescript
// ❌ ANTES: Todo mezclado
logDomainEvent("comment.created", { postId: id, commentId: created.id })
fakeSendNotification("comment", { postId: id })
fakeRecomputeSomething(id)
```

**Impacto:**
- Difícil agregar nuevos observadores
- Lógica de efectos secundarios sin centralización

---

## Patrones Aplicados

### 1. Strategy — Ranking (Integrante 1: Catalina Duran)

**Solución:**
- Cada modo de ranking es una clase que implementa `FeedRankingStrategy`
- Un `RankingContext` selecciona la estrategia correcta

```typescript
// ✅ DESPUÉS: Estrategias separadas
export interface FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[]
}

export class LatestRankingStrategy implements FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[] {
        return [...posts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
}

export class RankingContext {
    sort(posts: PostEntity[], mode: string): PostEntity[] {
        const strategy = this.strategies[mode] ?? this.strategies.latest
        return strategy.sort(posts)
    }
}
```

**Beneficios:**
- Extensible: agregar nuevo modo = nueva clase Strategy
- Responsabilidad única: cada estrategia solo ordena
- Fácil de testear

**Archivos:**
- `src/posts/strategies/ranking.strategy.ts`
- `src/posts/strategies/ranking-context.ts`
- `src/posts/feed.service.ts`

---

### 2. Adapter — Moderación Legacy (Integrante 2: Mathias Figueroa)

**Solución:**
- Un adaptador normaliza la respuesta legacy
- Un servicio expone una interfaz consistente

```typescript
// ✅ DESPUÉS: Adaptación centralizada
export interface ModerationResult {
    pass: boolean
    reason: string
    raw: LegacyModerationRawResponse
}

export class LegacyModerationAdapter implements ModerationProvider {
    review(content: string): ModerationResult {
        const rawResponse = legacyModerationApi.review(content)
        // Normaliza cualquier formato a ModerationResult
        if (rawResponse === "BLOCK") {
            return { pass: false, reason: "legacy-block", raw: rawResponse }
        }
        // ... más conversiones
    }
}
```

**Beneficios:**
- Desacoplamiento del cliente legacy
- Interface consistente en todo el código
- Fácil cambiar fuente de moderación

**Archivos:**
- `src/posts/moderation/legacy-moderation.adapter.ts`
- `src/posts/moderation/moderation.service.ts`

---

### 3. Factory — Construcción de Entidades (Integrante 3: Cristian Saez)

**Solución:**
- Una clase estática centraliza la construcción de entidades
- Evita duplicación de lógica de mapeo

```typescript
// ✅ DESPUÉS: Factory centralizada
export class EntityFactory {
    static createPostEntity(post: any, mode: string): PostEntity {
        const likesCount = post.likes.reduce((sum, like) => sum + like.weight, 0)
        const commentsCount = post.comments.length
        const relevanceScore = likesCount * 2 + commentsCount * 3 - ...
        // Construcción consistente en un lugar
        return new PostEntity(...)
    }

    static createCommentEntity(comment: any, moderation: any): CommentEntity {
        return new CommentEntity(...)
    }
}
```

**Beneficios:**
- Un único lugar donde se construye cada entidad
- Fácil cambiar lógica de mapeo
- Menos duplicación de código

**Archivos:**
- `src/posts/factories/entity.factory.ts`

---

### 4. Observer / Event Dispatcher — Efectos Secundarios (Integrante 4: Elsa Duran)

**Solución:**
- Un servicio centraliza suscripción y emisión de eventos
- Los efectos secundarios se registran al inicializar

```typescript
// ✅ DESPUÉS: Observadores centralizados
@Injectable()
export class DomainEventsService {
    constructor() {
        this.on("post.created", (payload) => {
            console.log("[event:post.created]", payload)
            console.log("[notify:post]", payload)
            console.log(`[recompute] postId=${payload.postId}`)
        })
    }

    emit(eventName: string, payload: DomainEventPayload) {
        const handlers = this.handlers[eventName] ?? []
        handlers.forEach((handler) => handler(payload))
    }
}
```

**Beneficios:**
- Efectos secundarios centralizados
- Fácil agregar nuevos observadores
- Desacoplamiento de eventos y handlers

**Archivos:**
- `src/posts/events/domain-events.service.ts`
- `src/posts/posts.module.ts` (registro de providers)

---

## Diagrama de Clases

```
┌─────────────────────────────────────┐
│    PostsController                  │
│  ────────────────────────────────   │
│ - postsService: PostsService        │
│ - feedService: FeedService          │
│ - moderationService: ModerationService
│ - domainEvents: DomainEventsService │
│ - prisma: PrismaService             │
│                                     │
│ + create()                          │
│ + getFeed()          ◄─ Strategy    │
│ + createComment()    ◄─ Adapter     │
│ + addLike()          ◄─ Factory     │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
  ┌──────────────┐  ┌──────────────────┐
  │ FeedService  │  │ ModerationService│
  └──────────────┘  └──────────────────┘
      │                     │
      │ uses               │ uses
      ▼                     ▼
┌────────────────┐  ┌──────────────────┐
│ RankingContext │  │ LegacyModeration │
│                │  │ Adapter          │
│ - strategies   │  └──────────────────┘
└────────────────┘
```

---

## Flujo Refactorizado

### Antes (Monolítico)
```
POST /api/posts/:id/comments
  → Validación en controlador
  → Llamada directa a legacyModerationApi
  → Lógica de interpretación de respuesta
  → Creación manual de entidad
  → logDomainEvent() inline
  → fakeSendNotification() inline
```

### Después (Separado por Patrones)
```
POST /api/posts/:id/comments
  → Validación en controlador
  → Delegación a ModerationService
    → Adaptación en LegacyModerationAdapter
  → Creación delegada a EntityFactory
  → Emisión de evento en DomainEventsService
    → Observadores registrados responden
```

---

## Contribuciones por Integrante

### Integrante 1 — Strategy + Feed Service
- Creó estrategias de ranking independientes
- Implementó `RankingContext`
- Extrajo lógica de feed en servicio
- Actualizó controlador para delegar ranking

### Integrante 2 — Adapter + Moderation Service
- Diseñó `LegacyModerationAdapter`
- Normalizó respuesta del cliente legacy
- Creó `ModerationService` inyectable
- Simplificó lógica de moderación en controlador

### Integrante 3 — Factory + Entity Construction
- Centralizó construcción de `PostEntity`
- Centralizó construcción de `CommentEntity`
- Centralizó construcción de `LikeEntity`
- Eliminó duplicación de mapeo

### Integrante 4 — Event Dispatcher + Module
- Implementó `DomainEventsService`
- Registró listeners de eventos
- Actualizó `PostsModule` con nuevos providers
- Documentó arquitectura (este fichero)

---

## Resultados Finales

| Aspecto | Antes | Después |
|---------|-------|---------|
| Responsabilidad de `PostsController` | Todo: validación, ranking, moderación, construcción, eventos | Solo: orquestación y validación |
| Extensibilidad de ranking | Difícil: agregar modo = editar switch gigante | Fácil: nueva clase Strategy |
| Acoplamiento a moderación legacy | Directo, disperso en controlador | Aislado en Adapter |
| Duplicación de construcción de entidades | 3+ lugares | 1 lugar (Factory) |
| Efectos secundarios | Inline, repetidos | Centralizados en DomainEventsService |
| Testabilidad | Baja | Alta |

---

## Conclusión

La aplicación de estos 4 patrones de diseño (Strategy, Adapter, Factory, Observer) resolvió los problemas principales:

1. **Strategy**: Ranking flexible y extensible
2. **Adapter**: Desacoplamiento del sistema legacy
3. **Factory**: Eliminación de duplicación
4. **Observer**: Efectos secundarios centralizados

El código ahora es más **mantenible**, **testeable** y **extensible**.
