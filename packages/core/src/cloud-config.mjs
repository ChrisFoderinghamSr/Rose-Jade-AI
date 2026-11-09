import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
const keys = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'PAYPAL_PLAN_STARTER',
  'PAYPAL_PLAN_PLUS',
  'PAYPAL_PLAN_PRO',
  'PAYPAL_ENV',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
  'SMTP_ALLOWED_RECIPIENTS',
  'MAIL_MODE',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
]
let loadedAt = 0,
  pending
export async function loadCloudConfig() {
  if (!process.env.APP_CONFIG_SECRET_ARN) return
  if (Date.now() - loadedAt < 300000) return
  if (pending) return pending
  pending = (async () => {
    const client = new SecretsManagerClient({})
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.APP_CONFIG_SECRET_ARN }),
    )
    if (!result.SecretString) throw Error('Cloud application secret contains no JSON string.')
    let values
    try {
      values = JSON.parse(result.SecretString)
    } catch {
      throw Error('Cloud application secret must contain valid JSON.')
    }
    for (const key of keys) {
      if (values[key] !== undefined) {
        if (typeof values[key] !== 'string') throw Error('Cloud secret values must be strings.')
        process.env[key] = values[key]
      }
    }
    loadedAt = Date.now()
  })()
  try {
    await pending
  } finally {
    pending = undefined
  }
}
