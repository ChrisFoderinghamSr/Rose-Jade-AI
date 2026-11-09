import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
export const root = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.cwd().replaceAll('\\', '/').endsWith('/apps/web') ? '../..' : '.',
)
export const dataDir = process.env.ROSE_DATA_DIR || path.join(root, '.local')
export const id = () => randomUUID()
export const now = () => new Date().toISOString()
export const passwordHash = (p) => {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(p, salt, 64).toString('hex')
}
let database
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
export function db() {
  if (database) return database
  mkdirSync(dataDir, { recursive: true })
  const d = new DatabaseSync(path.join(dataDir, 'rose.sqlite'))
  d.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,profile TEXT NOT NULL,plan TEXT NOT NULL DEFAULT 'free',subscription TEXT,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),title TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,provider TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),content TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,cloud INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,title TEXT NOT NULL,fields TEXT NOT NULL,status TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),title TEXT NOT NULL,content TEXT NOT NULL,format TEXT NOT NULL,provider TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),form_id TEXT REFERENCES records(id) ON DELETE CASCADE,answers TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),action TEXT NOT NULL,target TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS billing_events(id TEXT PRIMARY KEY,created TEXT NOT NULL);`)
  if (!d.prepare('SELECT id FROM users LIMIT 1').get()) {
    const email = process.env.OWNER_EMAIL || 'owner@rosejade.local'
    const password = process.env.OWNER_PASSWORD || randomBytes(24).toString('base64url')
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ROSE_PUBLIC_DEPLOYMENT === 'true' &&
      (!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD || password.length < 14)
    )
      throw Error(
        'Network deployment requires OWNER_EMAIL and a unique OWNER_PASSWORD of at least 14 characters.',
      )
    const userId = id()
    d.prepare('INSERT INTO users(id,email,password,role,profile,created) VALUES(?,?,?,?,?,?)').run(
      userId,
      email,
      passwordHash(password),
      'Owner',
      JSON.stringify(defaults()),
      now(),
    )
    if (!process.env.OWNER_PASSWORD)
      writeFileSync(
        path.join(dataDir, 'owner-access.json'),
        JSON.stringify({ email, password }, null, 2),
        { mode: 0o600 },
      )
  }
  const until = process.env.PUBLIC_ACCESS_UNTIL || new Date(Date.now() + 7 * 86400000).toISOString()
  d.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run('publicUntil', until)
  database = d
  return d
}
export const audit = (user, action, target = '') =>
  db().prepare('INSERT INTO audit VALUES(?,?,?,?,?)').run(id(), user, action, target, now())
export const publicUntil = () =>
  process.env.PUBLIC_ACCESS_UNTIL ||
  db().prepare("SELECT value FROM settings WHERE key='publicUntil'").get().value
export const publicOpen = () =>
  Number.isFinite(Date.parse(publicUntil())) && Date.now() < Date.parse(publicUntil())
export function prune(user) {
  const days = JSON.parse(user.profile).retentionDays
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  db().prepare('DELETE FROM messages WHERE user_id=? AND created<?').run(user.id, cutoff)
}
export const parseRecord = (r) => ({ ...r, fields: JSON.parse(r.fields) })
