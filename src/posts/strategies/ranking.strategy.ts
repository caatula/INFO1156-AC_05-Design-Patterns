import { PostEntity } from "@/posts/entities/post.entity"

export interface FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[]
}

export class LatestRankingStrategy implements FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[] {
        return [...posts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
}

export class MostLikedRankingStrategy implements FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[] {
        return [...posts].sort((a, b) => b.likesCount - a.likesCount)
    }
}

export class MostCommentedRankingStrategy implements FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[] {
        return [...posts].sort((a, b) => b.commentsCount - a.commentsCount)
    }
}

export class RelevanceRankingStrategy implements FeedRankingStrategy {
    sort(posts: PostEntity[]): PostEntity[] {
        return [...posts].sort((a, b) => b.relevanceScore - a.relevanceScore)
    }
}