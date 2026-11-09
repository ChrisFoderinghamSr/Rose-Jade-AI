import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '../../core/src/db.mjs'
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function fail(status, message) {
  throw new HttpError(status, message)
}
export const hash = (v) => createHash('sha256').update(v).digest('hex')
export const text = (v, label, max = 500) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(400, label + ' is required (up to ' + max + ' characters).')
  return v.trim()
}
export const choice = (v, options) => {
  if (!options.includes(v)) fail(400, 'Invalid option.')
  return v
}
export function verifyPassword(p, stored) {
  const [salt, hex] = stored.split(':')
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(hex, 'hex'))
}
export function origin(r) {
  if (r.headers.get('origin') !== (process.env.APP_ORIGIN || 'http://' + r.headers.get('host')))
    fail(403, 'Browser origin does not match this application.')
}
export function cookie(token, clear = false) {
  return (
    'rose_session=' +
    token +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
    (clear ? '0' : '28800') +
    (process.env.COOKIE_SECURE === 'true' ? '; Secure' : '')
  )
}
export function token(r) {
  return (
    r.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('rose_session='))
      ?.slice(13) || ''
  )
}
export function getUser(r) {
  return (
    db()
      .prepare(
        'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',
      )
      .get(hash(token(r)), Date.now()) || null
  )
}
export function requireUser(r) {
  const user = getUser(r)
  if (!user) fail(401, 'Sign in to your private workspace.')
  return user
}
export function session(user) {
  const token = randomBytes(32).toString('hex')
  db().prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())
  db()
    .prepare('INSERT INTO sessions VALUES(?,?,?)')
    .run(hash(token), user.id, Date.now() + 28800000)
  return token
}
export function limit(key, max = 30, period = 3600000) {
  key = hash(key)
  const d = db(),
    row = d.prepare('SELECT * FROM limits WHERE key=?').get(key)
  if (row && row.reset > Date.now() && row.count >= max)
    fail(429, 'Usage limit reached. Please try again later.')
  if (!row || row.reset < Date.now())
    d.prepare('INSERT OR REPLACE INTO limits VALUES(?,?,?)').run(key, 1, Date.now() + period)
  else d.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key)
}
export async function body(r, max = 150000) {
  if (Number(r.headers.get('content-length') || 0) > max) fail(413, 'Request too large.')
  const raw = await r.text()
  if (Buffer.byteLength(raw) > max) fail(413, 'Request too large.')
  let b
  try {
    b = JSON.parse(raw)
  } catch {
    fail(400, 'Expected JSON.')
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) fail(400, 'Expected an object.')
  return b
}
export function https(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') fail(400, 'Use an HTTPS URL.')
    return url.href
  } catch {
    fail(400, 'Use a valid HTTPS URL.')
  }
}
export function owned(table, user, identifier) {
  if (!['records', 'artifacts', 'threads', 'memories'].includes(table))
    throw Error('Invalid internal table')
  const row = db()
    .prepare('SELECT * FROM ' + table + ' WHERE id=? AND user_id=?')
    .get(text(identifier, 'Record ID', 100), user.id)
  if (!row) fail(404, 'Record not found.')
  return row
}
