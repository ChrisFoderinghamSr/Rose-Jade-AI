import { writeFileSync } from 'node:fs'
const keys = [
  'APP_ORIGIN',
  'COOKIE_SECURE',
  'AWS_REGION',
  'RDS_CLUSTER_ARN',
  'RDS_SECRET_ARN',
  'RDS_DATABASE',
  'APP_CONFIG_SECRET_ARN',
  'PUBLIC_ACCESS_UNTIL',
  'EMBED_ORIGINS',
]
const lines = keys
  .filter((key) => process.env[key] !== undefined)
  .map((key) => key + '=' + JSON.stringify(process.env[key]))
writeFileSync('apps/web/.env.production', lines.join('\n') + '\n', { mode: 0o600 })
console.log('Prepared non-secret runtime references for Amplify; no API keys or passwords copied.')
