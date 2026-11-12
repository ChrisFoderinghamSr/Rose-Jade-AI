import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const check = fileURLToPath(new URL('../scripts/check-cloud.mjs', import.meta.url))
test('deployment check accepts only an exact HTTPS origin and never prints reference values', () => {
  const env = { ...process.env, RDS_DATABASE:'example-private-db', RDS_CLUSTER_ARN:'example-private-cluster', RDS_SECRET_ARN:'example-private-secret' }
  for(const [origin, status] of [['https://app.example.test',0],['http://app.example.test',1],['https://app.example.test/path',1]]) {
    const run=spawnSync(process.execPath,[check],{env:{...env,APP_ORIGIN:origin},encoding:'utf8'})
    assert.equal(run.status,status)
    assert.doesNotMatch(run.stdout+run.stderr,/example-private-/)
  }
})
