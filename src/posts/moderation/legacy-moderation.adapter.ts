import { legacyModerationApi } from "@/posts/legacy-moderation.client"

export type LegacyModerationRawResponse =
    | "OK"
    | "BLOCK"
    | number
    | { pass: boolean; reason: string }

export interface ModerationResult {
    pass: boolean
    reason: string
    raw: LegacyModerationRawResponse
}

export interface ModerationProvider {
    review(content: string): ModerationResult
}

export class LegacyModerationAdapter implements ModerationProvider {
    review(content: string): ModerationResult {
        const rawResponse = legacyModerationApi.review(content)

        if (rawResponse === "BLOCK") {
            return { pass: false, reason: "legacy-block", raw: rawResponse }
        }

        if (rawResponse === "OK") {
            return { pass: true, reason: "legacy-ok", raw: rawResponse }
        }

        if (typeof rawResponse === "number") {
            return {
                pass: rawResponse >= 1,
                reason: rawResponse >= 1 ? "legacy-score-pass" : "legacy-score-fail",
                raw: rawResponse,
            }
        }

        return {
            pass: Boolean(rawResponse.pass),
            reason: rawResponse.pass
                ? rawResponse.reason
                : "legacy-object-fail",
            raw: rawResponse,
        }
    }
}