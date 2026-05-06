import { Module } from "@nestjs/common";
import { PostsController } from "@/posts/posts.controller";
import { PostsService } from "@/posts/posts.service";
import { FeedService } from "@/posts/feed.service";
import { ModerationService } from "@/posts/moderation/moderation.service";
import { DomainEventsService } from "@/posts/events/domain-events.service";
import { RankingContext } from "@/posts/strategies/ranking-context";

@Module({
    controllers: [PostsController],
    providers: [
        PostsService,
        FeedService,
        ModerationService,
        DomainEventsService,
        RankingContext,
    ],
})
export class PostsModule {}