import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"
import { PostEntity } from "@/posts/entities/post.entity"
import { RankingContext } from "@/posts/strategies/ranking-context"

@Injectable()
export class FeedService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly rankingContext: RankingContext,
    ) {}

    async getFeed(mode: string) {
        const posts = await this.prisma.post.findMany({
            include: {
                comments: true,
                likes: true,
            },
        })

        const mappedPosts = posts.map((post) => {
            const likesCount = post.likes.reduce((sum, like) => sum + like.weight, 0)
            const commentsCount = post.comments.length
            const hoursSinceCreated =
                (Date.now() - new Date(post.createdAt).getTime()) / 36_000_00
            const relevanceScore =
                likesCount * 2 + commentsCount * 3 - Math.floor(hoursSinceCreated)
            const tags = post.title.split(" ").filter((word) => word.length > 4)
            const metadata = {
                likesWeights: post.likes.map((like) => like.weight),
                commentLengths: post.comments.map(
                    (comment) => comment.content.length,
                ),
                hourOfCreate: new Date(post.createdAt).getHours(),
            }

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
                relevanceScore > 20,
                "feed-service",
                tags,
                metadata,
                mode,
            )
        })

        const sorted = this.rankingContext.sort(mappedPosts, mode)

        return {
            mode,
            count: sorted.length,
            rows: sorted,
        }
    }
}
