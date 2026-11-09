import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const requireWeb = createRequire(pathToFileURL(path.resolve('apps/web/package.json')))

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
test('Rose Jade cloud-only PostgreSQL integration', { timeout: 150000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rose-jade-test-'))
  const socket = net.createServer()
  await new Promise((r) => socket.listen(0, '127.0.0.1', r))
  const port = socket.address().port
  await new Promise((r) => socket.close(r))
  const base = 'http://127.0.0.1:' + port
  const capture = path.join(dir, 'model.json')
  let server,
    logs = '',
    ownerId,
    threadId,
    memoryId,
    recordId,
    formId,
    artifactId
  const cookies = {}
  async function start(expired = false) {
    server = spawn(
      process.execPath,
      [
        '--import',
        pathToFileURL(path.resolve('tests/cloud-preload.mjs')).href,
        requireWeb.resolve('next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: path.resolve('apps/web'),
        env: {
          ...process.env,
          TEST_PG_DIR: path.join(dir, 'postgres'),
          AWS_REGION: 'us-east-2',
          RDS_CLUSTER_ARN: 'arn:aws:rds:us-east-2:000000000000:cluster:test',
          RDS_SECRET_ARN: 'arn:aws:secretsmanager:us-east-2:000000000000:secret:test',
          RDS_DATABASE: 'rosejade',
          APP_CONFIG_SECRET_ARN: 'arn:aws:secretsmanager:us-east-2:000000000000:secret:config',
          APP_ORIGIN: base,
          COOKIE_SECURE: 'false',
          ROSE_PUBLIC_DEPLOYMENT: 'false',
          PUBLIC_ACCESS_UNTIL: expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
          OPENAI_API_KEY: 'mock-only',
          OPENAI_MODEL: 'mock-model',
          OLLAMA_MODEL: 'mock-local',
          OLLAMA_URL: 'http://127.0.0.1:11434',
          MODEL_CAPTURE_PATH: capture,
          PAYPAL_ENV: 'sandbox',
          PAYPAL_CLIENT_ID: 'mock-client',
          PAYPAL_CLIENT_SECRET: 'mock-secret',
          PAYPAL_WEBHOOK_ID: 'mock-webhook',
          PAYPAL_PLAN_STARTER: 'P-TEST-STARTER',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    server.stdout.on('data', (c) => (logs += c))
    server.stderr.on('data', (c) => (logs += c))
    for (let i = 0; i < 160; i++) {
      try {
        if ((await fetch(base + '/api/public')).ok) return
      } catch {}
      if (server.exitCode !== null) throw Error(logs)
      await new Promise((r) => setTimeout(r, 250))
    }
    throw Error(logs)
  }
  async function stop() {
    if (server && server.exitCode === null) {
      const done = new Promise((r) => server.once('exit', r))
      server.kill()
      await done
    }
  }
  const api = (route, role, method = 'GET', body, origin = base) =>
    fetch(base + '/api/' + route, {
      method,
      headers: {
        ...(role ? { Cookie: cookies[role] } : {}),
        ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  const state = async (role = 'owner') => {
    const r = await api('state', role)
    assert.equal(r.status, 200)
    return r.json()
  }
  const login = async (role, email, password, signup = false) => {
    const r = await api(signup ? 'auth/signup' : 'auth/login', null, 'POST', { email, password })
    assert.equal(r.status, 200)
    cookies[role] = r.headers.get('set-cookie').split(';')[0]
  }
  const create = async (kind, title, fields, status = 'Draft') => {
    const r = await api('records', 'owner', 'POST', { kind, title, fields, status })
    assert.equal(r.status, 201, await r.clone().text())
    return (await r.json()).id
  }
  const signed = async (event, valid = true) => {
    await writeFile(capture + '-paypal', JSON.stringify(event))
    return fetch(base + '/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-id': 'mock-transmission',
        'paypal-transmission-sig': valid ? 'valid-test-signature' : 'invalid',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api-m.sandbox.paypal.com/mock-cert',
      },
      body: JSON.stringify(event),
    })
  }
  try {
    await start()
    const owner = { email: 'owner@example.org', password: 'Cloud-test-owner-password-123!' }
    await t.test('temporary public access, protected state and authentication', async () => {
      assert.equal((await fetch(base)).status, 200)
      assert.equal((await fetch(base + '/embed')).status, 200)
      assert.equal((await api('state')).status, 401)
      assert.equal(
        (await api('auth/login', null, 'POST', owner, 'https://untrusted.example')).status,
        403,
      )
      await login('owner', owner.email, owner.password)
      await api('profile', 'owner', 'PATCH', { ...(await state()).profile, cloudConsent: true })
      ownerId = (await state()).user.id
      await login('other', 'other@example.org', 'Unique-other-password-123!', true)
      assert.equal((await api('public/demo', null, 'POST', { prompt: 'Hello' })).status, 401)
    })
    await t.test(
      'chat persistence, memory proposal, explicit approval, edit and isolation',
      async () => {
        let r = await api('chat', 'owner', 'POST', {
          prompt: 'Remember that I prefer concise answers',
          provider: 'openai',
        })
        assert.equal(r.status, 200)
        threadId = (await r.json()).threadId
        let s = await state()
        assert.equal(s.messages.length, 2)
        assert.equal(s.memories[0].status, 'Pending')
        memoryId = s.memories[0].id
        assert.equal(
          (
            await api('memories', 'other', 'PATCH', {
              id: memoryId,
              content: 'stolen',
              status: 'Approved',
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await api('memories', 'owner', 'PATCH', {
              id: memoryId,
              content: 'I prefer concise answers',
              status: 'Approved',
              cloud: false,
            })
          ).status,
          200,
        )
        r = await api('chat', 'owner', 'POST', {
          threadId,
          prompt: 'What do you remember about me?',
          provider: 'openai',
        })
        assert.equal((await r.json()).content, 'Mock cloud transport response')
        assert.equal((await state('other')).messages.length, 0)
        assert.equal(
          (
            await api('chat', 'other', 'POST', {
              threadId,
              prompt: 'Read private data',
              provider: 'openai',
            })
          ).status,
          404,
        )
      },
    )
    await t.test(
      'cloud-only adapter, consent and memory-sharing filter (mock transport)',
      async () => {
        let r
        assert.equal(
          (await api('chat', 'owner', 'POST', { prompt: 'Hello', provider: 'ollama' })).status,
          400,
        )
        await api('profile', 'owner', 'PATCH', { ...(await state()).profile, cloudConsent: false })
        assert.equal(
          (await api('chat', 'owner', 'POST', { prompt: 'Hello', provider: 'openai' })).status,
          403,
        )
        assert.equal(
          (await api('chat', 'owner', 'POST', { prompt: 'Hello', provider: 'demo' })).status,
          400,
        )
        const p = (await state()).profile
        assert.equal(
          (await api('profile', 'owner', 'PATCH', { ...p, name: 'Test Owner', cloudConsent: true }))
            .status,
          200,
        )
        r = await api('chat', 'owner', 'POST', { prompt: 'Cloud greeting', provider: 'openai' })
        assert.equal(r.status, 200)
        let captured = JSON.parse(await readFile(capture, 'utf8'))
        assert.equal(captured.payload.store, false)
        assert.doesNotMatch(captured.payload.instructions, /I prefer concise answers/)
        await api('memories', 'owner', 'PATCH', {
          id: memoryId,
          content: 'I prefer concise answers',
          status: 'Approved',
          cloud: true,
        })
        await api('chat', 'owner', 'POST', { prompt: 'Cloud context', provider: 'openai' })
        captured = JSON.parse(await readFile(capture, 'utf8'))
        assert.match(captured.payload.instructions, /I prefer concise answers/)
      },
    )
    await t.test(
      'task/email/event records, revision checks, calendar and capture exports',
      async () => {
        recordId = await create('task', 'Private task', {
          priority: 'High',
          due: '2026-12-01',
          detail: 'Only owner',
        })
        const row = (await state()).records.find((r) => r.id === recordId)
        assert.equal(
          (await api('records', 'owner', 'PATCH', { ...row, revision: 999, status: 'Done' }))
            .status,
          409,
        )
        assert.equal((await api('records', 'other', 'DELETE', { id: recordId })).status, 404)
        const emailId = await create(
          'email',
          'Draft mail',
          { to: 'test@example.org', subject: 'Fictional draft', body: 'Not sent.' },
          'Reviewed',
        )
        assert.equal((await api('email/' + emailId + '/export', 'owner')).status, 200)
        assert.equal((await api('email/' + emailId + '/export', 'other')).status, 404)
        const mail = (await state()).records.find((r) => r.id === emailId)
        assert.equal(
          (
            await api('email/send', 'owner', 'POST', {
              id: emailId,
              revision: mail.revision,
              confirm: true,
            })
          ).status,
          503,
        )
        await create('event', 'Demo exercise', {
          start: '2026-12-01T15:00:00Z',
          end: '2026-12-01T16:00:00Z',
          location: 'Test room',
          detail: 'Private calendar',
        })
        const calendar = await api('calendar/export', 'owner')
        assert.match(await calendar.text(), /BEGIN:VEVENT/)
      },
    )
    await t.test(
      'private forms, preserved responses and explicit public portfolio fields',
      async () => {
        formId = await create('form', 'Private questionnaire', {
          questions: 'Goal?\nNext step?',
          detail: 'Test form',
        })
        assert.equal(
          (
            await api('forms/submit', 'owner', 'POST', {
              id: formId,
              answers: ['Finish project', 'Review'],
            })
          ).status,
          201,
        )
        const row = (await state()).records.find((r) => r.id === formId)
        assert.equal(
          (await api('records', 'owner', 'PATCH', { ...row, title: 'Edited questionnaire' }))
            .status,
          200,
        )
        assert.equal((await state()).submissions.length, 1)
        await create('portfolio', 'Approved public project', {
          summary: 'A public summary only',
          url: 'https://example.org',
          published: true,
        })
        const pub = await (await api('public')).json()
        assert.equal(pub.portfolios.length, 1)
        assert.deepEqual(Object.keys(pub.portfolios[0]).sort(), ['summary', 'title', 'url'])
        assert.doesNotMatch(JSON.stringify(pub), /Only owner|concise answers/)
        const ownerPage = await fetch(base)
        assert.match(ownerPage.headers.get('content-security-policy'), /frame-ancestors 'none'/)
        assert.match(
          (await fetch(base + '/embed')).headers.get('content-security-policy'),
          /frame-ancestors 'self'/,
        )
      },
    )
    await t.test('real DOCX, PDF and text exports; no cross-user downloads', async () => {
      const r = await api('artifacts', 'owner', 'POST', {
        title: 'Test report',
        format: 'md',
        content: 'A fictional report\n\nOne clear next step.',
        provider: 'openai',
      })
      assert.equal(r.status, 201)
      artifactId = (await r.json()).id
      const pdf = await api('artifacts/' + artifactId + '?format=pdf', 'owner')
      assert.equal(pdf.status, 200)
      assert.equal(
        Buffer.from(await pdf.arrayBuffer())
          .subarray(0, 5)
          .toString(),
        '%PDF-',
      )
      const docx = await api('artifacts/' + artifactId + '?format=docx', 'owner')
      assert.equal(docx.status, 200)
      assert.equal(
        Buffer.from(await docx.arrayBuffer())
          .subarray(0, 2)
          .toString(),
        'PK',
      )
      assert.equal((await api('artifacts/' + artifactId, 'other')).status, 404)
    })
    await t.test(
      'billing preview, signature rejection, verified entitlement and duplicate events',
      async () => {
        const preview = await api('billing/checkout', 'owner', 'POST', { plan: 'starter' })
        assert.equal(preview.status, 200)
        assert.equal((await preview.json()).preview, true)
        const event = {
          id: 'evt_paypal_test_1',
          event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
          resource: { id: 'I-TEST', custom_id: ownerId },
        }
        assert.equal((await signed(event, false)).status, 401)
        assert.equal((await signed(event)).status, 200)
        assert.equal((await (await signed(event)).json()).duplicate, true)
        assert.equal((await state()).user.plan, 'starter')
      },
    )
    await t.test(
      'restart persistence, public expiry and privacy deletion are user-scoped',
      async () => {
        await stop()
        await start(true)
        assert.equal((await state()).artifacts.length, 1)
        assert.equal((await state()).memories[0].status, 'Approved')
        assert.equal((await (await api('public')).json()).open, false)
        assert.equal(
          (
            await api('auth/signup', null, 'POST', {
              email: 'closed@example.org',
              password: 'Strong-closed-password-123!',
            })
          ).status,
          403,
        )
        const exported = await api('privacy/export', 'owner')
        assert.equal(exported.status, 200)
        const raw = await exported.text()
        assert.doesNotMatch(raw, /password|rose_session|mock-only|mock-cloud-only-key/)
        assert.equal(
          (await api('privacy/clear', 'other', 'POST', { confirm: 'DELETE HISTORY' })).status,
          200,
        )
        assert.ok((await state()).messages.length > 0)
        assert.equal(
          (await api('privacy/erase', 'owner', 'POST', { confirm: 'incorrect' })).status,
          400,
        )
        assert.equal(
          (await api('privacy/erase', 'owner', 'POST', { confirm: 'ERASE WORKSPACE' })).status,
          200,
        )
        const s = await state()
        assert.equal(
          s.messages.length + s.memories.length + s.records.length + s.artifacts.length,
          0,
        )
        assert.equal(s.user.plan, 'starter')
        assert.equal((await api('auth/logout', 'owner', 'POST', {})).status, 200)
        assert.equal((await api('state', 'owner')).status, 401)
      },
    )
  } finally {
    await stop()
    await rm(dir, { recursive: true, force: true })
  }
})
