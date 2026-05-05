import { Injectable } from "@nestjs/common"
import { LegacyModerationAdapter, ModerationResult } from "@/posts/moderation/legacy-moderation.adapter"

@Injectable()
export class ModerationService {
    private readonly adapter = new LegacyModerationAdapter()

    review(content: string): ModerationResult {
        return this.adapter.review(content)
    }
}