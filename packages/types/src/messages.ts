import type { ISODateString, MessageId } from './ids.js'

export type MessageRole =
  | 'system'
  | 'user'
  | 'assistant'
  | 'tool'

export type MessageStatus =
  | 'pending'
  | 'complete'
  | 'failed'

export interface MessageMetadata {
  readonly model?: string
  readonly modelVersion?: string
  readonly source?: string
  readonly latencyMs?: number
  readonly tokenCount?: number
}

export interface Message {
  readonly id: MessageId
  readonly role: MessageRole
  readonly content: string
  readonly status: MessageStatus
  readonly createdAt: ISODateString
  readonly metadata?: MessageMetadata
}