import {
    BadRequestException,
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Post,
    Query,
} from "@nestjs/common";
import { PostsService } from "@/posts/posts.service";
import { FeedService } from "@/posts/feed.service";
import { ModerationService } from "@/posts/moderation/moderation.service";
import { DomainEventsService } from "@/posts/events/domain-events.service";
import { PrismaService } from "@/prisma/prisma.service";
import { EntityFactory } from "@/posts/entities/entity.factory";
import {
    AddLikeDto,
    CreateCommentDto,
    CreatePostDto,
    FeedQueryDto,
} from "@/posts/posts.dtos";

@Controller("api/posts")
export class PostsController {
    constructor(
        private readonly postsService: PostsService,
        private readonly feedService: FeedService,
        private readonly moderationService: ModerationService,
        private readonly domainEvents: DomainEventsService,
        private readonly prisma: PrismaService,
    ) {}

    @Post()
    async create(@Body() body: CreatePostDto) {
        // Validación básica: Fail Fast
        if (body.title.length < 3 || body.title.length > 120) {
            throw new BadRequestException("Title length must be between 3 and 120");
        }

        if (!body.imageUrl.startsWith("http")) {
            throw new BadRequestException("Image URL must start with http");
        }

        const created = await this.postsService.create(body);

        // Emisión de evento de dominio para creación de post
        this.domainEvents.emit("post.created", { 
            postId: created.id, 
            title: created.title 
        });
        
        return {
            ok: true,
            payload: created,
        };
    }

    @Get()
    async findAll() {
        const posts = await this.postsService.findAll();
        return {
            total: posts.length,
            items: posts,
        };
    }

    @Get("feed")
    async getFeed(@Query() query: FeedQueryDto) {
        // Implementación de estrategia de feed
        const mode = query.mode || "latest";
        return this.feedService.getFeed(mode);
    }

    @Get(":id/comments")
    async getComments(@Param("id", ParseIntPipe) id: number) {
        const post = await this.postsService.findById(id);
        if (!post) {
            throw new NotFoundException("Post not found");
        }

        const comments = await this.prisma.comment.findMany({
            where: { postId: id },
            orderBy: { createdAt: "desc" },
        });

        // Mapeo centralizado usando la Factory
        const entities = comments.map((c) => 
            EntityFactory.createCommentEntity(c, { pass: true })
        );

        return {
            total_comments: entities.length,
            comments: entities,
        };
    }

    @Post(":id/comments")
    async createComment(
        @Param("id", ParseIntPipe) id: number,
        @Body() body: CreateCommentDto,
    ) {
        const post = await this.postsService.findById(id);
        if (!post) {
            throw new NotFoundException("Post not found");
        }

        if (body.content.length < 2) {
            throw new BadRequestException("Comment too short");
        }

        // Cambio de lógica legada por servicio de moderación inyectado
        // Se asume llamada asíncrona por ser un servicio externo de revisión
        const moderation = await this.moderationService.review(body.content);

        if (!moderation.pass) {
            throw new BadRequestException("Comment blocked by moderation");
        }

        // Delegación de persistencia al Service en lugar de Prisma directo[cite: 1]
        const created = await this.postsService.createComment(id, body, "controller");
        
        // Uso de Factory para desacoplar la creación de la entidad[cite: 1]
        const entity = EntityFactory.createCommentEntity(created, moderation);

        // Notificación mediante eventos de dominio
        this.domainEvents.emit("comment.created", {
            postId: id,
            commentId: created.id,
        });

        return {
            message: "comment_created",
            entity,
        };
    }

    @Post(":id/likes")
    async addLike(
        @Param("id", ParseIntPipe) id: number,
        @Body() body: AddLikeDto,
    ) {
        const post = await this.postsService.findById(id);
        if (!post) {
            throw new NotFoundException("Post not found");
        }

        const reactionType = body.reactionType || "like";
        const weight = body.weight || 1;

        if (weight < 1) {
            throw new BadRequestException("Weight must be at least 1");
        }

        const like = await this.prisma.like.create({
            data: { postId: id, reactionType, weight, source: "controller" },
        });

        const entity = EntityFactory.createLikeEntity(like);

        return { 
            success: true, 
            like: entity 
        };
    }
}