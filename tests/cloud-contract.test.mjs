import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  translateSQL,
  encodeParameter,
  db,
  CloudConfigurationError,
} from '../packages/core/src/db.mjs'
test('PostgreSQL placeholder conversion preserves quoted strings', () => {
  assert.deepEqual(translateSQL("SELECT '?' AS literal, ? AS bound, 'it''s ?' AS quoted"), {
    sql: "SELECT '?' AS literal, :p1 AS bound, 'it''s ?' AS quoted",
    count: 1,
  })
  assert.match(
    translateSQL('INSERT OR IGNORE INTO settings VALUES(?,?)').sql,
    /ON CONFLICT DO NOTHING/,
  )
  assert.throws(() => translateSQL('PRAGMA journal_mode=WAL'))
})
test('Data API parameters preserve large epoch values and reject objects', () => {
  assert.equal(encodeParameter(1800000000000, 0).value.longValue, 1800000000000)
  assert.equal(encodeParameter(null, 0).value.isNull, true)
  assert.throws(() => encodeParameter({}, 0))
})
test('missing Aurora configuration fails without creating local storage', async () => {
  const old = process.env.RDS_CLUSTER_ARN
  delete process.env.RDS_CLUSTER_ARN
  try {
    await assert.rejects(db().prepare('SELECT 1').all(), CloudConfigurationError)
  } finally {
    if (old) process.env.RDS_CLUSTER_ARN = old
  }
})
test('application runtime has no SQLite or offline AI provider imports', async () => {
  for (const file of ['packages/core/src/db.mjs', 'packages/ai/src/provider.mjs']) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(
      source,
      /node:sqlite|DatabaseSync|OLLAMA|streamTransport.*writeFile|node:fs/,
    )
  }
  const middleware = await readFile('apps/web/middleware.ts', 'utf8')
  assert.match(middleware, /runtime: 'nodejs'/)
})
