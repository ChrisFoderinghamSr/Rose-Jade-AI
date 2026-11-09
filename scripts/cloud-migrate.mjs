import { db, id, now, defaults, passwordHash } from '../packages/core/src/db.mjs'
import { schemaStatements } from '../packages/core/src/schema.mjs'
import { loadCloudConfig } from '../packages/core/src/cloud-config.mjs'
export async function migrate() {
  await loadCloudConfig()
  await db().transaction(async () => {
    await db().prepare('SELECT pg_advisory_xact_lock(73190421)').all()
    for (const sql of schemaStatements) await db().prepare(sql).run()
    const owner = await db().prepare("SELECT id FROM users WHERE role='Owner' LIMIT 1").get()
    if (!owner) {
      const email = process.env.OWNER_EMAIL,
        password = process.env.OWNER_PASSWORD
      if (!email || !password || password.length < 14)
        throw Error(
          'First cloud migration requires OWNER_EMAIL and a 14+ character OWNER_PASSWORD in the protected server configuration.',
        )
      await db()
        .prepare('INSERT INTO users(id,email,password,role,profile,created) VALUES(?,?,?,?,?,?)')
        .run(
          id(),
          email.toLowerCase(),
          passwordHash(password),
          'Owner',
          JSON.stringify(defaults()),
          now(),
        )
    }
    await db()
      .prepare('INSERT OR IGNORE INTO settings VALUES(?,?)')
      .run('publicUntil', process.env.PUBLIC_ACCESS_UNTIL || '')
  })
}
if (
  process.argv[1] &&
  import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href
) {
  await migrate()
  console.log(
    'Cloud PostgreSQL schema and owner initialization completed. No local account file was created.',
  )
}
