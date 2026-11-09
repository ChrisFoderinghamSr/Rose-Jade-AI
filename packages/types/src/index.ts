import type {
  ConversationId,
  ISODateString,
  RequestId,
  SessionId,
  UserId,
} from './ids.js'

import type { Message } from './messages.js'

export * from './ids.js'
export * from './messages.js'

export type Environment =
  | 'development'
  | 'test'
  | 'staging'
  | 'production'

export interface Conversation {
  readonly id: ConversationId
  readonly sessionId: SessionId
  readonly userId?: UserId
  readonly messages: readonly Message[]
  readonly createdAt: ISODateString
  readonly updatedAt: ISODateString
}

export interface ChatRequest {
  readonly sessionId: SessionId
  readonly conversationId?: ConversationId
  readonly message: string
}

export interface ChatResponse {
  readonly requestId: RequestId
  readonly conversationId: ConversationId
  readonly message: Message
}

export interface ApiError {
  readonly requestId?: RequestId
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown>
}

export interface HealthResponse {
  readonly status: 'online' | 'degraded' | 'offline'
  readonly service: string
  readonly environment: Environment
  readonly timestamp: ISODateString
}