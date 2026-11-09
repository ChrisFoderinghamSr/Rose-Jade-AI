import { loadCloudConfig } from './cloud-config.mjs'
import {
  CloudConfigurationError,
  db,
  id,
  now,
  passwordHash,
  defaults,
  audit,
  prune,
  parseRecord,
  publicOpen,
  publicUntil,
} from './db.mjs'
import {
  fail,
  HttpError,
  text,
  choice,
  body,
  origin,
  getUser,
  requireUser,
  verifyPassword,
  session,
  cookie,
  token,
  hash,
  limit,
  https,
  owned,
} from '../../security/src/access.mjs'
import { complete, providerStatus } from '../../ai/src/provider.mjs'
import { exportArtifact, safeName, calendar } from './exports.mjs'
import { plans, billingReady, checkout, webhook, cancel } from './billing.mjs'
import nodemailer from 'nodemailer'
const reply = (v, status = 200, headers = {}) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
const download = (data, mime, name) =>
  new Response(data, {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': 'attachment; filename="' + name + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
const profileOf = (u) => JSON.parse(u.profile)
const email = (v) => {
  v = text(v, 'Email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(400, 'Use a valid email.')
  return v
}
const recordKinds = ['task', 'email', 'event', 'portfolio', 'livechat', 'form']
function fieldsFor(kind, b) {
  const f = b.fields
  if (!f || typeof f !== 'object' || Array.isArray(f)) fail(400, 'Fields are required.')
  const optional = (key, max = 5000) => (typeof f[key] === 'string' ? f[key].slice(0, max) : '')
  const fields = { detail: optional('detail') }
  if (kind === 'task') {
    fields.due = optional('due', 10)
    if (fields.due && !/^\d{4}-\d{2}-\d{2}$/.test(fields.due)) fail(400, 'Invalid due date.')
    fields.priority = choice(f.priority || 'Normal', ['Low', 'Normal', 'High'])
  }
  if (kind === 'email') {
    fields.to = email(f.to)
    fields.subject = text(f.subject, 'Subject', 150)
    if (/[\r\n]/.test(fields.subject)) fail(400, 'Subject must be one line.')
    fields.body = text(f.body, 'Message', 10000)
  }
  if (kind === 'event') {
    const start = Date.parse(f.start),
      end = Date.parse(f.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      fail(400, 'Choose a valid start and later end time.')
    fields.start = new Date(start).toISOString()
    fields.end = new Date(end).toISOString()
    fields.location = optional('location', 200)
  }
  if (kind === 'portfolio') {
    fields.summary = text(f.summary, 'Summary', 2000)
    fields.url = https(f.url)
    fields.published = f.published === true
  }
  if (kind === 'livechat') {
    fields.channel = optional('channel', 100)
    fields.transcript = optional('transcript', 12000)
  }
  if (kind === 'form') {
    fields.questions = text(
      Array.isArray(f.questions) && f.questions.every((q) => typeof q === 'string')
        ? f.questions.join('\n')
        : f.questions,
      'Questions',
      1500,
    )
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)
    if (fields.questions.length > 10) fail(400, 'Use at most 10 form questions.')
  }
  return fields
}
export default async function handle(r) {
  try {
    await loadCloudConfig()
    const route = new URL(r.url).pathname.replace('/api/', ''),
      method = r.method
    if (route === 'billing/webhook' && method === 'POST') return reply(await webhook(r))
    if (method !== 'GET') origin(r)
    if (route === 'public' && method === 'GET') {
      db()
      return reply({
        open: await publicOpen(),
        until: await publicUntil(),
        plans,
        billingReady: billingReady(),
        domain: 'RoseJade.chrisfoderingham.com',
        provider: providerStatus(),
        portfolios: (await publicOpen())
          ? (await db().prepare("SELECT title,fields FROM records WHERE kind='portfolio'").all())
              .map(parseRecord)
              .filter((p) => p.fields.published)
              .map((p) => ({ title: p.title, summary: p.fields.summary, url: p.fields.url }))
          : [],
      })
    }
    if (route === 'auth/me' && method === 'GET') {
      const u = await getUser(r)
      return reply({ user: u ? { id: u.id, email: u.email, role: u.role, plan: u.plan } : null })
    }
    if (['auth/login', 'auth/signup'].includes(route) && method === 'POST') {
      const b = await body(r)
      const address = email(b.email),
        password = text(b.password, 'Password', 128)
      await limit('login:' + address, 10, 900000)
      let u = await db().prepare('SELECT * FROM users WHERE email=?').get(address)
      if (route === 'auth/signup') {
        if (!(await publicOpen())) fail(403, 'Public registration is currently closed.')
        await limit('signup-global', 30, 86400000)
        if (password.length < 14) fail(400, 'Use a password of at least 14 characters.')
        if (u) fail(409, 'This email cannot be registered.')
        const userId = id()
        await db()
          .prepare('INSERT INTO users(id,email,password,role,profile,created) VALUES(?,?,?,?,?,?)')
          .run(userId, address, passwordHash(password), 'Member', JSON.stringify(defaults()), now())
        u = await db().prepare('SELECT * FROM users WHERE id=?').get(userId)
      } else {
        const valid = verifyPassword(password, u?.password || passwordHash('not-a-real-account'))
        if (!u || !valid) fail(401, 'Email or password is incorrect.')
      }
      await audit(u.id, 'session.login')
      return reply({ ok: true }, 200, { 'Set-Cookie': cookie(await session(u)) })
    }
    const user = await requireUser(r)
    await prune(user)
    if (route === 'auth/logout' && method === 'POST') {
      await db()
        .prepare('DELETE FROM sessions WHERE token=?')
        .run(hash(token(r)))
      return reply({ ok: true }, 200, { 'Set-Cookie': cookie('', true) })
    }
    if (route === 'state' && method === 'GET')
      return reply({
        user: { id: user.id, email: user.email, role: user.role, plan: user.plan },
        profile: profileOf(user),
        providers: providerStatus(),
        plans,
        billingReady: billingReady(),
        publicUntil: await publicUntil(),
        threads: await db()
          .prepare('SELECT * FROM threads WHERE user_id=? ORDER BY created DESC')
          .all(user.id),
        messages: await db()
          .prepare('SELECT * FROM messages WHERE user_id=? ORDER BY created')
          .all(user.id),
        memories: await db()
          .prepare('SELECT * FROM memories WHERE user_id=? ORDER BY created DESC')
          .all(user.id),
        records: (
          await db()
            .prepare('SELECT * FROM records WHERE user_id=? ORDER BY updated DESC')
            .all(user.id)
        ).map(parseRecord),
        artifacts: await db()
          .prepare(
            'SELECT id,title,format,provider,created FROM artifacts WHERE user_id=? ORDER BY created DESC',
          )
          .all(user.id),
        submissions: await db()
          .prepare('SELECT * FROM submissions WHERE user_id=? ORDER BY created DESC')
          .all(user.id),
        audit: await db()
          .prepare(
            'SELECT action,target,created FROM audit WHERE user_id=? ORDER BY created DESC LIMIT 50',
          )
          .all(user.id),
        connections: {
          email:
            process.env.MAIL_MODE === 'smtp'
              ? 'SMTP configured'
              : 'Cloud email drafts · no message sent',
          calendar: 'ICS export · no live calendar sync',
          livechat: 'Local conversation notes · no external chat connector',
        },
      })
    if (route === 'profile' && method === 'PATCH') {
      const b = await body(r)
      const timezone = text(b.timezone, 'Timezone', 80)
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone })
      } catch {
        fail(400, 'Use a valid IANA timezone.')
      }
      const p = {
        name: typeof b.name === 'string' ? b.name.slice(0, 100) : '',
        timezone,
        goals: typeof b.goals === 'string' ? b.goals.slice(0, 3000) : '',
        tone: choice(b.tone, [
          'Warm and practical',
          'Concise and direct',
          'Detailed and thoughtful',
        ]),
        memoryEnabled: b.memoryEnabled === true,
        cloudConsent: b.cloudConsent === true,
        voiceConsent: b.voiceConsent === true,
        retentionDays: choice(Number(b.retentionDays), [7, 30, 90]),
      }
      await db().prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(p), user.id)
      await audit(user.id, 'profile.update')
      return reply({ ok: true })
    }
    if (route === 'chat' && method === 'POST') {
      await limit('chat:' + user.id, 60)
      const b = await body(r)
      const prompt = text(b.prompt, 'Message', 12000)
      const provider = choice(b.provider, ['openai'])
      let threadId = b.threadId
      if (threadId) await owned('threads', user, threadId)
      else {
        threadId = id()
        await db()
          .prepare('INSERT INTO threads VALUES(?,?,?,?)')
          .run(threadId, user.id, prompt.slice(0, 70), now())
      }
      const history = (
        await db()
          .prepare(
            'SELECT role,content FROM messages WHERE thread_id=? AND user_id=? ORDER BY created DESC LIMIT 12',
          )
          .all(threadId, user.id)
      ).reverse()
      const content = await complete({ user, prompt, provider, history })
      const created = now()
      await db()
        .prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?)')
        .run(id(), user.id, threadId, 'user', prompt, provider, created)
      await db()
        .prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?)')
        .run(
          id(),
          user.id,
          threadId,
          'assistant',
          content,
          provider,
          new Date(Date.now() + 1).toISOString(),
        )
      // Explicit remember cues create proposals, never active memory or hidden profiling.
      const cue = prompt.match(
        /^(?:please\s+)?(?:remember(?: that)?|my preference is)[: ,]+([\s\S]+)/i,
      )
      if (profileOf(user).memoryEnabled && cue) {
        const candidate = cue[1].trim().slice(0, 1500)
        if (candidate)
          await db()
            .prepare('INSERT INTO memories VALUES(?,?,?,?,?,?,?,?)')
            .run(id(), user.id, candidate, 'Preference', 'Pending', prompt.slice(0, 1600), 0, now())
      }
      await audit(user.id, 'chat.reply', provider)
      return reply({ threadId, content, provider })
    }
    if (route === 'memories' && method === 'POST') {
      const b = await body(r)
      const memoryId = id()
      await db()
        .prepare('INSERT INTO memories VALUES(?,?,?,?,?,?,?,?)')
        .run(
          memoryId,
          user.id,
          text(b.content, 'Memory', 1500),
          choice(b.category || 'Preference', ['Preference', 'Goal', 'Routine', 'Context']),
          'Pending',
          'Explicit user entry',
          0,
          now(),
        )
      return reply({ id: memoryId }, 201)
    }
    if (route === 'memories' && method === 'PATCH') {
      const b = await body(r)
      await owned('memories', user, b.id)
      await db()
        .prepare('UPDATE memories SET content=?,status=?,cloud=? WHERE id=? AND user_id=?')
        .run(
          text(b.content, 'Memory', 1500),
          choice(b.status, ['Pending', 'Approved', 'Rejected']),
          b.cloud === true ? 1 : 0,
          b.id,
          user.id,
        )
      await audit(user.id, 'memory.review', b.id)
      return reply({ ok: true })
    }
    if (route === 'memories' && method === 'DELETE') {
      const b = await body(r)
      await owned('memories', user, b.id)
      await db().prepare('DELETE FROM memories WHERE id=? AND user_id=?').run(b.id, user.id)
      await audit(user.id, 'memory.delete')
      return reply({ ok: true })
    }
    if (route === 'records' && (method === 'POST' || method === 'PATCH')) {
      const b = await body(r)
      const kind = choice(b.kind, recordKinds)
      const title = text(b.title, 'Title', 150)
      const fields = fieldsFor(kind, b)
      const recordId = method === 'POST' ? id() : b.id
      let revision = 1
      if (method === 'PATCH') {
        const old = await owned('records', user, recordId)
        if (old.kind !== kind) fail(400, 'Record type cannot change.')
        if (['Sending', 'Sent', 'Delivery uncertain'].includes(old.status))
          fail(
            409,
            'An email being delivered or with uncertain delivery cannot be edited. Check the provider before creating another draft.',
          )
        if (Number(b.revision) !== old.revision)
          fail(409, 'This record changed. Refresh before editing.')
        revision = old.revision + 1
      }
      const status = choice(
        b.status || 'Draft',
        kind === 'task'
          ? ['Draft', 'To do', 'In progress', 'Done']
          : ['Draft', 'Reviewed', 'Archived'],
      )
      const old = method === 'PATCH' ? await owned('records', user, recordId) : null
      const saved = await db()
        .prepare(
          'INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,fields=excluded.fields,status=excluded.status,revision=excluded.revision,updated=excluded.updated WHERE records.user_id=excluded.user_id AND records.revision=excluded.revision-1',
        )
        .run(
          recordId,
          user.id,
          kind,
          title,
          JSON.stringify(fields),
          status,
          revision,
          old?.created || now(),
          now(),
        )
      if (!saved.changes) fail(409, 'This record changed. Refresh before editing.')
      await audit(user.id, 'record.save', kind)
      return reply({ id: recordId }, method === 'POST' ? 201 : 200)
    }
    if (route === 'records' && method === 'DELETE') {
      const b = await body(r)
      await owned('records', user, b.id)
      await db().prepare('DELETE FROM records WHERE id=? AND user_id=?').run(b.id, user.id)
      await audit(user.id, 'record.delete')
      return reply({ ok: true })
    }
    if (route === 'forms/submit' && method === 'POST') {
      const b = await body(r),
        form = parseRecord(await owned('records', user, b.id))
      if (form.kind !== 'form') fail(400, 'Not a form.')
      if (!Array.isArray(b.answers) || b.answers.length !== form.fields.questions.length)
        fail(400, 'Answer every question.')
      const answers = b.answers.map((v) => text(v, 'Answer', 2000))
      await db()
        .prepare('INSERT INTO submissions VALUES(?,?,?,?,?)')
        .run(id(), user.id, form.id, JSON.stringify(answers), now())
      return reply({ ok: true }, 201)
    }
    if (route === 'calendar/export' && method === 'GET') {
      const records = (
        await db()
          .prepare("SELECT * FROM records WHERE user_id=? AND kind='event' AND status<>'Archived'")
          .all(user.id)
      ).map(parseRecord)
      return download(calendar(records), 'text/calendar; charset=utf-8', 'rose-jade-calendar.ics')
    }
    if (route.startsWith('email/') && route.endsWith('/export') && method === 'GET') {
      const record = parseRecord(await owned('records', user, route.split('/')[1]))
      if (record.kind !== 'email') fail(400, 'Not an email.')
      const transport = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      })
      const result = await transport.sendMail({
        from: process.env.MAIL_FROM || user.email,
        to: record.fields.to,
        subject: record.fields.subject,
        text: record.fields.body,
      })
      return download(result.message, 'message/rfc822', safeName(record.title) + '.eml')
    }
    if (route === 'email/send' && method === 'POST') {
      const b = await body(r),
        record = parseRecord(await owned('records', user, b.id))
      if (
        record.kind !== 'email' ||
        record.status !== 'Reviewed' ||
        b.confirm !== true ||
        Number(b.revision) !== record.revision
      )
        fail(409, 'Review this exact draft and explicitly confirm before sending.')
      if (user.role !== 'Owner')
        fail(
          403,
          'External SMTP sending is restricted to the owner until per-user mail integrations are configured.',
        )
      if (process.env.MAIL_MODE !== 'smtp')
        fail(503, 'SMTP is not enabled. Export the local MIME draft instead.')
      const allow = (process.env.SMTP_ALLOWED_RECIPIENTS || '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
      if (!allow.includes(record.fields.to.toLowerCase()))
        fail(403, 'Recipient is not in the server-configured allowlist.')
      if (
        !process.env.SMTP_HOST ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASSWORD ||
        !process.env.MAIL_FROM
      )
        fail(503, 'SMTP configuration incomplete.')
      const claimed = await db()
        .prepare(
          "UPDATE records SET status='Sending' WHERE id=? AND user_id=? AND status='Reviewed' AND revision=?",
        )
        .run(record.id, user.id, record.revision)
      if (!claimed.changes) fail(409, 'This message is already being processed.')
      try {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === '465',
          requireTLS: process.env.SMTP_PORT !== '465',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
          connectionTimeout: 10000,
          socketTimeout: 15000,
        })
        await transport.sendMail({
          from: process.env.MAIL_FROM,
          to: record.fields.to,
          subject: record.fields.subject,
          text: record.fields.body,
        })
        await db()
          .prepare("UPDATE records SET status='Sent' WHERE id=? AND user_id=?")
          .run(record.id, user.id)
        await audit(user.id, 'email.smtp-accepted', record.id)
        return reply({
          message: 'SMTP provider accepted the message; final delivery is not guaranteed.',
        })
      } catch {
        await db()
          .prepare("UPDATE records SET status='Delivery uncertain' WHERE id=? AND user_id=?")
          .run(record.id, user.id)
        fail(502, 'Delivery is uncertain. Check provider logs before attempting another send.')
      }
    }
    if (route === 'artifacts' && method === 'POST') {
      const b = await body(r)
      const format = choice(b.format, [
        'md',
        'txt',
        'html',
        'json',
        'csv',
        'py',
        'js',
        'ts',
        'docx',
        'pdf',
      ])
      const title = text(b.title, 'Title', 150)
      let content =
        typeof b.content === 'string' && b.content.trim()
          ? text(b.content, 'Content', 100000)
          : await complete({
              user,
              prompt: text(b.prompt, 'Instructions', 5000),
              provider: choice(b.provider, ['openai']),
              purpose: 'artifact',
            })
      if (format === 'json') {
        try {
          JSON.parse(content)
        } catch {
          content = JSON.stringify({ title, content }, null, 2)
        }
      }
      const artifactId = id()
      await db()
        .prepare('INSERT INTO artifacts VALUES(?,?,?,?,?,?,?)')
        .run(
          artifactId,
          user.id,
          title,
          content,
          format,
          b.content?.trim() ? 'manual' : 'openai',
          now(),
        )
      await audit(user.id, 'artifact.create', format)
      return reply({ id: artifactId }, 201)
    }
    if (route.startsWith('artifacts/') && method === 'GET') {
      const identifier = route.split('/')[1],
        record = await owned('artifacts', user, identifier)
      const format = new URL(r.url).searchParams.get('format') || record.format
      choice(format, ['md', 'txt', 'html', 'json', 'csv', 'py', 'js', 'ts', 'docx', 'pdf'])
      const result = await exportArtifact(record, format)
      return download(result.bytes, result.mime, safeName(record.title) + '.' + result.extension)
    }
    if (route === 'decisions' && method === 'POST') {
      const b = await body(r)
      const prompt =
        'Compare this decision: ' +
        text(b.question, 'Decision', 3000) +
        '\nOptions: ' +
        text(b.options, 'Options', 3000) +
        '\nConstraints and jurisdiction: ' +
        text(b.constraints, 'Constraints', 3000) +
        '\nSeparate benefits, tradeoffs, rights/privacy impacts, uncertainties and facts to verify. Do not claim current legal research.'
      const content = await complete({
        user,
        prompt,
        provider: choice(b.provider, ['openai']),
      })
      return reply({ content })
    }
    if (route === 'billing/cancel' && method === 'POST') {
      const b = await body(r)
      return reply(await cancel(user, b.confirm))
    }
    if (route === 'billing/checkout' && method === 'POST') {
      const b = await body(r)
      return reply(await checkout(user, b.plan))
    }
    if (route === 'privacy/export' && method === 'GET') {
      const result = {
        profile: profileOf(user),
        memories: await db()
          .prepare(
            'SELECT content,category,status,source,cloud,created FROM memories WHERE user_id=?',
          )
          .all(user.id),
        threads: await db()
          .prepare('SELECT id,title,created FROM threads WHERE user_id=?')
          .all(user.id),
        messages: await db()
          .prepare('SELECT role,content,provider,created,thread_id FROM messages WHERE user_id=?')
          .all(user.id),
        records: (await db().prepare('SELECT * FROM records WHERE user_id=?').all(user.id)).map(
          parseRecord,
        ),
        artifacts: await db()
          .prepare('SELECT title,content,format,provider,created FROM artifacts WHERE user_id=?')
          .all(user.id),
        submissions: await db()
          .prepare('SELECT form_id,answers,created FROM submissions WHERE user_id=?')
          .all(user.id),
      }
      return download(
        JSON.stringify(result, null, 2),
        'application/json',
        'rose-jade-private-export.json',
      )
    }
    if (route === 'privacy/clear' && method === 'POST') {
      const b = await body(r)
      if (b.confirm !== 'DELETE HISTORY') fail(400, 'Type DELETE HISTORY to confirm.')
      await db().prepare('DELETE FROM threads WHERE user_id=?').run(user.id)
      await audit(user.id, 'history.clear')
      return reply({ ok: true })
    }
    if (route === 'privacy/erase' && method === 'POST') {
      const b = await body(r)
      if (b.confirm !== 'ERASE WORKSPACE') fail(400, 'Type ERASE WORKSPACE to confirm.')
      await db().transaction(async () => {
        for (const table of [
          'submissions',
          'messages',
          'threads',
          'memories',
          'records',
          'artifacts',
          'audit',
        ])
          await db()
            .prepare('DELETE FROM ' + table + ' WHERE user_id=?')
            .run(user.id)
        await db()
          .prepare('UPDATE users SET profile=? WHERE id=?')
          .run(JSON.stringify(defaults()), user.id)
      })
      return reply({
        message: 'Workspace data erased. Your login and subscription records remain.',
      })
    }
    if (route === 'auth/password' && method === 'POST') {
      const b = await body(r)
      if (!verifyPassword(text(b.current, 'Current password', 128), user.password))
        fail(400, 'Current password is incorrect.')
      const password = text(b.password, 'New password', 128)
      if (password.length < 14) fail(400, 'Use at least 14 characters.')
      await db()
        .prepare('UPDATE users SET password=? WHERE id=?')
        .run(passwordHash(password), user.id)
      await db().prepare('DELETE FROM sessions WHERE user_id=?').run(user.id)
      return reply({ ok: true }, 200, { 'Set-Cookie': cookie('', true) })
    }
    fail(404, 'Endpoint not found.')
  } catch (error) {
    if (error instanceof HttpError || error instanceof CloudConfigurationError)
      return reply({ error: error.message }, error.status)
    console.error('Rose Jade operation failed:', error.message)
    return reply(
      { error: 'The operation failed. Check the server log; no success has been assumed.' },
      500,
    )
  }
}
