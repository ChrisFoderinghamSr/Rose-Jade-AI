import { db, dataDir } from '../packages/core/src/db.mjs'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
db()
const file = path.join(dataDir, 'owner-access.json')
if (existsSync(file)) console.table([JSON.parse(readFileSync(file, 'utf8'))])
else console.log('Owner credentials were supplied through the environment.')
