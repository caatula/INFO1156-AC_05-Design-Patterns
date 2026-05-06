import { Injectable } from "@nestjs/common"

export type DomainEventPayload = Record<string, unknown>
export type DomainEventHandler = (payload: DomainEventPayload) => void

@Injectable()
export class DomainEventsService {
    private readonly handlers: Record<string, DomainEventHandler[]> = {}

    constructor() {
        this.on("post.created", (payload) => {
            console.log("[event:post.created]", payload)
            console.log("[notify:post]", payload)
            if (typeof payload.postId === "number") {
                console.log(`[recompute] postId=${payload.postId}`)
            }
        })

        this.on("comment.created", (payload) => {
            console.log("[event:comment.created]", payload)
            console.log("[notify:comment]", payload)
            if (typeof payload.postId === "number") {
                console.log(`[recompute] postId=${payload.postId}`)
            }
        })

        this.on("like.created", (payload) => {
            console.log("[event:like.created]", payload)
            console.log("[notify:like]", payload)
            if (typeof payload.postId === "number") {
                console.log(`[recompute] postId=${payload.postId}`)
            }
        })
    }

    on(eventName: string, handler: DomainEventHandler) {
        this.handlers[eventName] = this.handlers[eventName] ?? []
        this.handlers[eventName].push(handler)
    }

    emit(eventName: string, payload: DomainEventPayload) {
        const handlers = this.handlers[eventName] ?? []
        handlers.forEach((handler) => handler(payload))
    }
}