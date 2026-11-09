import {
  RDSDataClient,
  ExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
export const id = () => randomUUID()
export const now = () => new Date().toISOString()
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(password, salt, 64).toString('hex')
}
export const defaults = () => ({
  name: '',
  timezone: 'America/Chicago',
  goals: '',
  tone: 'Warm and practical',
  memoryEnabled: true,
  cloudConsent: false,
  voiceConsent: false,
  retentionDays: 30,
})
export class CloudConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.status = 503
  }
}
const transactions = new AsyncLocalStorage()
let client
function connection() {
  if (!process.env.RDS_CLUSTER_ARN || !process.env.RDS_SECRET_ARN || !process.env.RDS_DATABASE)
    throw new CloudConfigurationError(
      'Cloud database is not configured. The operator must supply the Aurora cluster, database secret and database name.',
    )
  client ??= new RDSDataClient({})
  return {
    resourceArn: process.env.RDS_CLUSTER_ARN,
    secretArn: process.env.RDS_SECRET_ARN,
    database: process.env.RDS_DATABASE,
  }
}
export function translateSQL(source) {
  let sql = source.trim()
  if (/^INSERT OR IGNORE INTO /i.test(sql))
    sql = sql.replace(/^INSERT OR IGNORE INTO /i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING'
  if (/^INSERT OR REPLACE INTO settings /i.test(sql))
    sql =
      sql.replace(/^INSERT OR REPLACE INTO /i, 'INSERT INTO ') +
      ' ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  if (/\bPRAGMA\b|INSERT OR REPLACE|BEGIN IMMEDIATE/i.test(sql))
    throw Error('Unsupported non-PostgreSQL query.')
  // Replace positional placeholders only outside SQL single-quoted string literals.
  let quoted = false,
    index = 0,
    result = ''
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (c === "'") {
      result += c
      if (quoted && sql[i + 1] === "'") {
        result += "'"
        i++
        continue
      }
      quoted = !quoted
      continue
    }
    result += c === '?' && !quoted ? ':p' + ++index : c
  }
  return { sql: result, count: index }
}
export function encodeParameter(value, index) {
  if (value === null) return { name: 'p' + (index + 1), value: { isNull: true } }
  if (typeof value === 'string') return { name: 'p' + (index + 1), value: { stringValue: value } }
  if (typeof value === 'number' && Number.isFinite(value))
    return {
      name: 'p' + (index + 1),
      value: Number.isSafeInteger(value) ? { longValue: value } : { doubleValue: value },
    }
  if (typeof value === 'boolean') return { name: 'p' + (index + 1), value: { booleanValue: value } }
  throw Error('Unsupported database parameter type.')
}
async function execute(sql, args = []) {
  const settings = connection()
  const translated = translateSQL(sql)
  if (translated.count !== args.length) throw Error('Database parameter count mismatch.')
  const output = await client.send(
    new ExecuteStatementCommand({
      ...settings,
      sql: translated.sql,
      parameters: args.map(encodeParameter),
      transactionId: transactions.getStore(),
      formatRecordsAs: 'JSON',
    }),
  )
  return {
    rows: output.formattedRecords ? JSON.parse(output.formattedRecords) : [],
    changes: output.numberOfRecordsUpdated || 0,
  }
}
const database = {
  prepare(sql) {
    return {
      async all(...args) {
        return (await execute(sql, args)).rows
      },
      async get(...args) {
        return (await execute(sql, args)).rows[0]
      },
      async run(...args) {
        return execute(sql, args)
      },
    }
  },
  async transaction(operation) {
    if (transactions.getStore()) return operation()
    const settings = connection()
    const begun = await client.send(new BeginTransactionCommand(settings))
    try {
      const value = await transactions.run(begun.transactionId, operation)
      await client.send(
        new CommitTransactionCommand({
          resourceArn: settings.resourceArn,
          secretArn: settings.secretArn,
          transactionId: begun.transactionId,
        }),
      )
      return value
    } catch (error) {
      try {
        await client.send(
          new RollbackTransactionCommand({
            resourceArn: settings.resourceArn,
            secretArn: settings.secretArn,
            transactionId: begun.transactionId,
          }),
        )
      } catch {}
      throw error
    }
  },
}
export const db = () => database
export async function audit(user, action, target = '') {
  await db().prepare('INSERT INTO audit VALUES(?,?,?,?,?)').run(id(), user, action, target, now())
}
export async function publicUntil() {
  if (process.env.PUBLIC_ACCESS_UNTIL) return process.env.PUBLIC_ACCESS_UNTIL
  return (
    (await db().prepare("SELECT value FROM settings WHERE key='publicUntil'").get())?.value || ''
  )
}
export async function publicOpen() {
  const until = await publicUntil()
  return Number.isFinite(Date.parse(until)) && Date.now() < Date.parse(until)
}
export async function prune(user) {
  const days = JSON.parse(user.profile).retentionDays
  await db()
    .prepare('DELETE FROM messages WHERE user_id=? AND created<?')
    .run(user.id, new Date(Date.now() - days * 86400000).toISOString())
}
export const parseRecord = (r) => ({ ...r, fields: JSON.parse(r.fields) })
