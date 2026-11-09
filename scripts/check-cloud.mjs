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
if (process.env.APP_ORIGIN && !process.env.APP_ORIGIN.startsWith('https://')) {
  console.log('Hosted APP_ORIGIN must use HTTPS.')
  failed = true
}
if (failed) process.exitCode = 1
