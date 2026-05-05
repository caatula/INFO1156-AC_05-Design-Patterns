import { Injectable } from "@nestjs/common"
import {
    FeedRankingStrategy,
    LatestRankingStrategy,
    MostCommentedRankingStrategy,
    MostLikedRankingStrategy,
    RelevanceRankingStrategy,
} from "@/posts/strategies/ranking.strategy"
import { PostEntity } from "@/posts/entities/post.entity"

@Injectable()
export class RankingContext {
    private readonly strategies: Record<string, FeedRankingStrategy>

    constructor() {
        this.strategies = {
            latest: new LatestRankingStrategy(),
            mostLiked: new MostLikedRankingStrategy(),
            mostCommented: new MostCommentedRankingStrategy(),
            relevance: new RelevanceRankingStrategy(),
        }
    }

    sort(posts: PostEntity[], mode: string): PostEntity[] {
        const strategy = this.strategies[mode] ?? this.strategies.latest
        return strategy.sort(posts)
    }
}