export type Brand<T, B extends string> = T & {
  readonly __brand: B
}

export type UserId = Brand<string, 'UserId'>
export type SessionId = Brand<string, 'SessionId'>
export type MessageId = Brand<string, 'MessageId'>
export type ConversationId = Brand<string, 'ConversationId'>
export type RequestId = Brand<string, 'RequestId'>

export type ISODateString = string