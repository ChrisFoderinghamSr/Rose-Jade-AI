// Test-only: execute real PostgreSQL SQL in PGlite while replacing paid cloud transports.
import { PGlite } from '@electric-sql/pglite'
import { RDSDataClient } from '@aws-sdk/client-rds-data'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { writeFileSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const postgres = new PGlite(process.env.TEST_PG_DIR)
const active = new Set()
RDSDataClient.prototype.send = async function (command) {
  const input = command.input,
    name = command.constructor.name
  if (name === 'BeginTransactionCommand') {
    await postgres.exec('BEGIN')
    const transactionId = randomUUID()
    active.add(transactionId)
    return { transactionId }
  }
  if (name === 'CommitTransactionCommand' || name === 'RollbackTransactionCommand') {
    if (!active.has(input.transactionId)) throw Error('Missing test transaction ID')
    await postgres.exec(name === 'CommitTransactionCommand' ? 'COMMIT' : 'ROLLBACK')
    active.delete(input.transactionId)
    return {}
  }
  if (name !== 'ExecuteStatementCommand') throw Error('Unexpected RDS command ' + name)
  if (input.transactionId && !active.has(input.transactionId))
    throw Error('Invalid test transaction ID')
  if (input.sql.includes('pg_advisory_xact_lock'))
    return { formattedRecords: '[]', numberOfRecordsUpdated: 0 }
  const params = input.parameters || []
  const sql = input.sql.replace(/:p([0-9]+)/g, (_, n) => '$' + n)
  const values = params.map((p) =>
    p.value.isNull
      ? null
      : 'stringValue' in p.value
        ? p.value.stringValue
        : 'longValue' in p.value
          ? p.value.longValue
          : 'doubleValue' in p.value
            ? p.value.doubleValue
            : p.value.booleanValue,
  )
  const result = await postgres.query(sql, values)
  return {
    formattedRecords: JSON.stringify(result.rows),
    numberOfRecordsUpdated: result.affectedRows || 0,
  }
}
SecretsManagerClient.prototype.send = async () => ({
  SecretString: JSON.stringify({
    OPENAI_API_KEY: 'mock-cloud-only-key',
    OPENAI_MODEL: 'mock-cloud',
    OWNER_EMAIL: 'owner@example.org',
    OWNER_PASSWORD: 'Cloud-test-owner-password-123!',
  }),
})
const real = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url === 'https://api.openai.com/v1/responses') {
    const payload = JSON.parse(init.body)
    writeFileSync(process.env.MODEL_CAPTURE_PATH, JSON.stringify({ url, payload }))
    if (payload.input.at(-1).content === 'TEST_PROVIDER_FAILURE')
      return Response.json({ error: 'mock failure' }, { status: 503 })
    return Response.json({
      output: [{ content: [{ type: 'output_text', text: 'Mock cloud transport response' }] }],
    })
  }
  if (url === 'https://api-m.sandbox.paypal.com/v1/oauth2/token')
    return Response.json({ access_token: 'mock-paypal-token' })
  if (url.endsWith('/v1/notifications/verify-webhook-signature'))
    return Response.json({
      verification_status:
        JSON.parse(init.body).transmission_sig === 'valid-test-signature' ? 'SUCCESS' : 'FAILURE',
    })
  if (url.endsWith('/v1/billing/subscriptions/I-TEST')) {
    const event = JSON.parse(readFileSync(process.env.MODEL_CAPTURE_PATH + '-paypal', 'utf8'))
    return Response.json({
      id: 'I-TEST',
      custom_id: event.resource.custom_id,
      plan_id: 'P-TEST-STARTER',
      status: 'ACTIVE',
    })
  }
  return real(input, init)
}
const { migrate } = await import('../scripts/cloud-migrate.mjs')
await migrate()
