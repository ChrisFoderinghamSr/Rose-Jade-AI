import { db, now, audit } from './db.mjs'
import { fail, text } from '../../security/src/access.mjs'
export const plans = [
  { id: 'starter', name: 'Companion', price: 5, allowance: 100 },
  { id: 'plus', name: 'Everyday', price: 15, allowance: 300 },
  { id: 'pro', name: 'Signature', price: 30, allowance: 600 },
]
const configured = () =>
  !!(
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_CLIENT_SECRET &&
    process.env.PAYPAL_WEBHOOK_ID
  )
export const billingReady = () =>
  configured() && plans.every((p) => !!process.env['PAYPAL_PLAN_' + p.id.toUpperCase()])
const base = () =>
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
async function access() {
  if (!configured()) fail(503, 'PayPal is not configured.')
  const r = await fetch(base() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString(
          'base64',
        ),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) fail(502, 'PayPal authentication failed.')
  const b = await r.json()
  if (!b.access_token) fail(502, 'PayPal returned no access token.')
  return b.access_token
}
async function call(route, token, method = 'GET', body, requestId) {
  const r = await fetch(base() + route, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) fail(502, 'PayPal could not complete the request. Check provider configuration.')
  return r.status === 204 ? {} : r.json()
}
export async function checkout(user, plan) {
  const selected = plans.find((p) => p.id === plan)
  if (!selected) fail(400, 'Unknown plan.')
  if (!billingReady())
    return {
      preview: true,
      plan: selected,
      message: 'PayPal plan preview only. No payment or subscription was created.',
    }
  if (user.plan !== 'free' && user.subscription)
    fail(409, 'You already have a subscription. Cancel it before choosing another plan.')
  const origin = process.env.APP_ORIGIN
  if (!origin?.startsWith('https://'))
    fail(503, 'PayPal approval requires a configured HTTPS origin.')
  const token = await access()
  const response = await call(
    '/v1/billing/subscriptions',
    token,
    'POST',
    {
      plan_id: process.env['PAYPAL_PLAN_' + plan.toUpperCase()],
      custom_id: user.id,
      application_context: {
        brand_name: 'Rose Jade AI',
        user_action: 'SUBSCRIBE_NOW',
        return_url: origin + '/?billing=approved',
        cancel_url: origin + '/?billing=cancelled',
      },
    },
    user.id + '-' + plan + '-' + Math.floor(Date.now() / 300000),
  )
  const approval = response.links?.find((link) => link.rel === 'approve')?.href
  let url
  try {
    url = new URL(approval)
  } catch {
    fail(502, 'PayPal returned no approval link.')
  }
  if (
    url.protocol !== 'https:' ||
    !['www.paypal.com', 'www.sandbox.paypal.com'].includes(url.hostname)
  )
    fail(502, 'Invalid PayPal approval destination.')
  await audit(user.id, 'paypal.approval', plan)
  return { url: url.href }
}
export async function cancel(user, confirmation) {
  if (confirmation !== true)
    fail(400, 'Explicit subscription cancellation confirmation is required.')
  if (!user.subscription) fail(409, 'No active subscription is recorded.')
  const token = await access()
  await call(
    '/v1/billing/subscriptions/' + encodeURIComponent(user.subscription) + '/cancel',
    token,
    'POST',
    { reason: 'Cancelled by the authenticated subscriber in Rose Jade.' },
  )
  await db().prepare("UPDATE users SET plan='free' WHERE id=?").run(user.id)
  await audit(user.id, 'paypal.cancel', user.subscription)
  return {
    message:
      'PayPal accepted cancellation. Paid app access has ended; the private workspace remains.',
  }
}
export async function webhook(request) {
  if (!configured()) fail(503, 'PayPal webhook is not configured.')
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 150000) fail(413, 'Payload too large.')
  let event
  try {
    event = JSON.parse(raw)
  } catch {
    fail(400, 'Invalid PayPal JSON.')
  }
  const eventId = text(event.id, 'Event ID', 150)
  const headers = request.headers
  const transmissionTime = headers.get('paypal-transmission-time') || ''
  if (
    !Number.isFinite(Date.parse(transmissionTime)) ||
    Math.abs(Date.now() - Date.parse(transmissionTime)) > 600000
  )
    fail(401, 'Expired PayPal transmission.')
  const token = await access()
  // Delegate certificate/signature validation to PayPal's authenticated verification API.
  const verification = await call('/v1/notifications/verify-webhook-signature', token, 'POST', {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: transmissionTime,
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  })
  if (verification.verification_status !== 'SUCCESS') fail(401, 'Invalid PayPal webhook signature.')
  if (await db().prepare('SELECT id FROM billing_events WHERE id=?').get(eventId))
    return { duplicate: true }
  const supported = [
    'BILLING.SUBSCRIPTION.ACTIVATED',
    'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.CANCELLED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.EXPIRED',
  ]
  let current = null
  if (supported.includes(event.event_type)) {
    const identifier = text(event.resource?.id, 'Subscription ID', 100)
    if (!/^[A-Za-z0-9-]+$/.test(identifier)) fail(400, 'Invalid subscription ID.')
    current = await call('/v1/billing/subscriptions/' + identifier, token)
  }
  return db().transaction(async () => {
    if (current) {
      const user = await db()
        .prepare('SELECT * FROM users WHERE id=?')
        .get(typeof current.custom_id === 'string' ? current.custom_id : '')
      if (user) {
        const plan = plans.find(
          (p) => process.env['PAYPAL_PLAN_' + p.id.toUpperCase()] === current.plan_id,
        )
        const active = current.status === 'ACTIVE'
        if (active && user.subscription && user.plan !== 'free' && user.subscription !== current.id)
          fail(409, 'A different active subscription is already assigned.')
        if (!active && user.subscription && user.subscription !== current.id) {
          await db().prepare('INSERT INTO billing_events VALUES(?,?)').run(eventId, now())
          return { ignoredDifferentSubscription: true }
        }
        const next = active && plan ? plan.id : 'free'
        await db()
          .prepare('UPDATE users SET plan=?,subscription=? WHERE id=?')
          .run(next, current.id, user.id)
        await audit(user.id, 'paypal.subscription', next)
      }
    }
    await db().prepare('INSERT INTO billing_events VALUES(?,?)').run(eventId, now())
    return { received: true }
  })
}
