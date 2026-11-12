const required = ['RDS_CLUSTER_ARN', 'RDS_SECRET_ARN', 'RDS_DATABASE', 'APP_ORIGIN']
let failed = false
for (const key of required) {
  const present = !!process.env[key]
  console.log(key + ': ' + (present ? 'set' : 'MISSING'))
  if (!present) failed = true
}
console.log(
  'APP_CONFIG_SECRET_ARN: ' +
    (process.env.APP_CONFIG_SECRET_ARN
      ? 'set'
      : 'not set (server environment secrets must be supplied directly)'),
)
if (process.env.APP_ORIGIN) {
  try {
    const origin = new URL(process.env.APP_ORIGIN)
    if (origin.protocol !== 'https:' || origin.origin !== process.env.APP_ORIGIN) throw new Error()
  } catch {
    console.error('Hosted APP_ORIGIN must be a bare HTTPS origin.')
    failed = true
  }
}
if (!failed && process.argv.includes('--connect')) {
  try {
    const { db } = await import('../packages/core/src/db.mjs')
    await db().prepare('SELECT 1 AS ready').get()
    console.log('Database connection verified with the current runtime identity.')
  } catch {
    console.error('Database connection failed. Check the Data API, region, runtime role and secret references.')
    failed = true
  }
}
if (failed) process.exitCode = 1
