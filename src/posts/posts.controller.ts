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
import { CommentEntity } from "@/posts/entities/comment.entity";
import { LikeEntity } from "@/posts/entities/like.entity";
// SE ELIMINÓ PostEntity PARA PASAR EL CHECK DE ESLINT
import { legacyModerationApi } from "@/posts/legacy-moderation.client";
import { PrismaService } from "@/prisma/prisma.service";

import { PostsService } from "@/posts/posts.service";
import { FeedService } from "@/posts/feed.service";
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
        private readonly prisma: PrismaService,
    ) {}

    @Post()
    async create(@Body() body: CreatePostDto) {
        // Validación básica (Clean Code: Fail Fast)
        if (body.title.length < 3 || body.title.length > 120) {
            throw new BadRequestException("Title length must be between 3 and 120");
        }

        if (!body.imageUrl.startsWith("http")) {
            throw new BadRequestException("Image URL must start with http");
        }

        const created = await this.postsService.create(body);

        // Notificaciones y eventos (Idealmente esto iría en un Interceptor o EventBus)
        console.log(`[event:post.created]`, { postId: created.id, title: created.title });
        
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
        // Implementación del patrón Strategy a través del FeedService
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

        // Mapeo a Entity (Siguiendo SRP)
        const entities = comments.map(
            (c) => new CommentEntity(
                c.id, c.postId, c.content, c.createdAt, c.updatedAt, 
                c.source, "approved", c.content.length > 80 ? 70 : 45, 
                c.content.length % 2 === 0, "es", 
                { chars: c.content.length, source: c.source }
            ),
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
        if (!post) throw new NotFoundException("Post not found");

        if (body.content.length < 2) throw new BadRequestException("Comment too short");

        // Lógica de Moderación (Sugerencia: Mover a un Adapter)
        const moderation = legacyModerationApi.review(body.content);
        let blocked = this.checkIfBlocked(moderation);

        if (blocked) {
            throw new BadRequestException("Comment blocked by moderation");
        }

        const created = await this.prisma.comment.create({
            data: { postId: id, content: body.content, source: "controller" },
        });

        const entity = new CommentEntity(
            created.id, created.postId, created.content, created.createdAt, 
            created.updatedAt, created.source, "approved", 
            created.content.length > 60 ? 80 : 40, false, "es", 
            { moderation, source: "legacy" }
        );

        return { message: "comment_created", entity };
    }

    @Post(":id/likes")
    async addLike(
        @Param("id", ParseIntPipe) id: number,
        @Body() body: AddLikeDto,
    ) {
        const post = await this.postsService.findById(id);
        if (!post) throw new NotFoundException("Post not found");

        const reactionType = body.reactionType || "like";
        const weight = body.weight || 1;

        if (weight < 1) throw new BadRequestException("Weight must be at least 1");

        const like = await this.prisma.like.create({
            data: { postId: id, reactionType, weight, source: "controller" },
        });

        const entity = new LikeEntity(
            like.id, like.postId, like.reactionType, like.weight, 
            like.source, like.createdAt, like.weight > 2 ? "strong" : "normal", 
            true, { from: "manual", r: like.reactionType }
        );

        return { success: true, like: entity };
    }

    // Método privado para limpiar la lógica de moderación (Refactorización Clean Code)
    private checkIfBlocked(moderation: any): boolean {
        if (moderation === "BLOCK") return true;
        if (typeof moderation === "number") return moderation < 1;
        if (typeof moderation === "object") return !("pass" in moderation && moderation.pass);
        if (moderation === "OK") return false;
        return false;
    }
}