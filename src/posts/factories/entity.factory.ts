import { PostEntity } from "@/posts/entities/post.entity"
import { CommentEntity } from "@/posts/entities/comment.entity"
import { LikeEntity } from "@/posts/entities/like.entity"

/**
 * Interface para datos crudos de Post desde la BD
 */
interface PostData {
    id: number
    title: string
    description: string
    imageUrl: string
    createdAt: Date
    updatedAt: Date
    likes: Array<{ weight: number }>
    comments: Array<{ content: string }>
}

/**
 * Interface para datos crudos de Comment desde la BD
 */
interface CommentData {
    id: number
    postId: number
    content: string
    createdAt: Date
    updatedAt: Date
}

/**
 * Interface para datos crudos de Like desde la BD
 */
interface LikeData {
    id: number
    postId: number
    reactionType: string
    weight: number
    createdAt: Date
}

/**
 * Interface para resultado de moderación
 */
interface ModerationResult {
    pass: boolean
    reason?: string
}

/**
 * Factory Pattern (Creacional)
 * 
 * Encapsula TODA la lógica de construcción de entidades de dominio.
 * Responsabilidades:
 * - Transformar datos crudos de la BD en entidades enriquecidas
 * - Calcular valores derivados (scores, conteos, metadata)
 * - Aplicar reglas de negocio en un único lugar
 * - Separar la lógica de construcción de la lógica de dominio
 * 
 * Beneficio: El resto del código solo llama al factory, sin lógica suelta.
 */
export class EntityFactory {
    /**
     * Crea una entidad de Post enriquecida con cálculos de relevancia y metadata.
     * 
     * @param post - Datos crudos del post desde la BD
     * @param mode - Modo de ranking (ej: 'latest', 'trending', 'popular')
     * @returns PostEntity con todos los campos derivados calculados
     * 
     * Patrón: Factory Method (Creacional)
     * Responsabilidad única: Encapsular toda la lógica de transformación de Post
     */
    static createPostEntity(post: PostData, mode: string): PostEntity {
        const likesCount = this.calculateLikesCount(post.likes)
        const commentsCount = post.comments.length
        const relevanceScore = this.calculateRelevanceScore(
            likesCount,
            commentsCount,
            post.createdAt,
        )
        const tags = this.extractTags(post.title)
        const metadata = this.buildPostMetadata(post)
        const isFeatured = relevanceScore > 20

        return new PostEntity(
            post.id,
            post.title,
            post.description,
            post.imageUrl,
            post.createdAt,
            post.updatedAt,
            likesCount,
            commentsCount,
            relevanceScore,
            isFeatured,
            "factory",
            tags,
            metadata,
            mode,
        )
    }

    /**
     * Crea una entidad de Comment con información de moderación.
     * 
     * @param comment - Datos crudos del comentario desde la BD
     * @param moderation - Resultado del proceso de moderación
     * @returns CommentEntity con estado de moderación y análisis enriquecido
     * 
     * Patrón: Factory Method (Creacional)
     * Responsabilidad única: Encapsular la transformación de Comment
     */
    static createCommentEntity(
        comment: CommentData,
        moderation: ModerationResult,
    ): CommentEntity {
        const moderationState = moderation.pass ? "approved" : "rejected"
        const language = this.detectLanguage(comment.content)
        const sentimentScore = this.calculateSentimentScore(comment.content)
        const metadata = this.buildCommentMetadata(comment)

        return new CommentEntity(
            comment.id,
            comment.postId,
            comment.content,
            comment.createdAt,
            comment.updatedAt,
            "factory",
            moderationState,
            sentimentScore,
            false,
            language,
            metadata,
        )
    }

    /**
     * Crea una entidad de Like con datos normalizados y enriquecidos.
     * 
     * @param like - Datos crudos del like desde la BD
     * @returns LikeEntity con todos los campos requeridos
     * 
     * Patrón: Factory Method (Creacional)
     * Responsabilidad única: Encapsular la transformación de Like
     */
    static createLikeEntity(like: LikeData): LikeEntity {
        const strengthLabel = this.calculateStrengthLabel(like.weight)
        const shouldAffectRelevanceScore = like.weight > 0.5
        const metadata = this.buildLikeMetadata(like)

        return new LikeEntity(
            like.id,
            like.postId,
            like.reactionType,
            like.weight,
            "factory",
            like.createdAt,
            strengthLabel,
            shouldAffectRelevanceScore,
            metadata,
        )
    }

    /**
     * Calcula el conteo total de likes ponderado por su peso.
     * @private
     */
    private static calculateLikesCount(likes: Array<{ weight: number }>): number {
        return likes.reduce((totalWeight, like) => totalWeight + like.weight, 0)
    }

    /**
     * Calcula el score de relevancia basado en likes, comentarios y edad del post.
     * 
     * Fórmula: (likes * 2) + (comentarios * 3) - horas_transcurridas
     * @private
     */
    private static calculateRelevanceScore(
        likesCount: number,
        commentsCount: number,
        createdAt: Date,
    ): number {
        const hoursSinceCreated =
            (Date.now() - new Date(createdAt).getTime()) / 3_600_000
        return likesCount * 2 + commentsCount * 3 - Math.floor(hoursSinceCreated)
    }

    /**
     * Extrae tags del título (palabras con más de 4 caracteres).
     * @private
     */
    private static extractTags(title: string): string[] {
        return title
            .split(" ")
            .filter((word) => word.length > 4)
            .map((word) => word.toLowerCase())
    }

    /**
     * Construye metadata enriquecida del post para analytics.
     * @private
     */
    private static buildPostMetadata(post: PostData): Record<string, unknown> {
        return {
            likesWeights: post.likes.map((like) => like.weight),
            commentLengths: post.comments.map((comment) => comment.content.length),
            hourOfCreate: new Date(post.createdAt).getHours(),
        }
    }

    /**
     * Detecta el idioma del comentario (simplificado).
     * @private
     */
    private static detectLanguage(content: string): string {
        // Implementación simplificada
        return "es"
    }

    /**
     * Calcula un score de sentimiento simplificado del comentario.
     * @private
     */
    private static calculateSentimentScore(content: string): number {
        // Implementación simplificada (0-1)
        return 0.5
    }

    /**
     * Construye metadata del comentario.
     * @private
     */
    private static buildCommentMetadata(
        comment: CommentData,
    ): Record<string, unknown> {
        return {
            contentLength: comment.content.length,
            wordCount: comment.content.split(" ").length,
        }
    }

    /**
     * Calcula la etiqueta de fuerza del like basado en su peso.
     * @private
     */
    private static calculateStrengthLabel(weight: number): string {
        if (weight >= 2) return "strong"
        if (weight >= 1) return "normal"
        return "weak"
    }

    /**
     * Construye metadata del like.
     * @private
     */
    private static buildLikeMetadata(like: LikeData): Record<string, unknown> {
        return {
            reactionWeight: like.weight,
            reactionType: like.reactionType,
        }
    }
}