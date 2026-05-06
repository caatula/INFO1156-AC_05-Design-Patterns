import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"
import { RankingContext } from "@/posts/strategies/ranking-context"
import { EntityFactory } from "@/posts/factories/entity.factory"

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

        const mappedPosts = posts.map((post) =>
            EntityFactory.createPostEntity(post, mode),
        )

        const sorted = this.rankingContext.sort(mappedPosts, mode)

        return {
            mode,
            count: sorted.length,
            rows: sorted,
        }
    }
}
