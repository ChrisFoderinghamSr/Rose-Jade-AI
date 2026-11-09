// Used only by the integration test's child process. No real provider is contacted.
import { writeFileSync } from 'node:fs'
const real = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url === 'https://api-m.sandbox.paypal.com/v1/oauth2/token')
    return Response.json({ access_token: 'mock-paypal-token' })
  if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
    const b = JSON.parse(init.body)
    return Response.json({
      verification_status: b.transmission_sig === 'valid-test-signature' ? 'SUCCESS' : 'FAILURE',
    })
  }
  if (url.endsWith('/v1/billing/subscriptions/I-TEST')) {
    const event = JSON.parse(
      await import('node:fs').then((m) =>
        m.readFileSync(process.env.MODEL_CAPTURE_PATH + '-paypal', 'utf8'),
      ),
    )
    return Response.json({
      id: 'I-TEST',
      custom_id: event.resource.custom_id,
      plan_id: 'P-TEST-STARTER',
      status: 'ACTIVE',
    })
  }
  if (url === 'https://api.openai.com/v1/responses' || url === 'http://127.0.0.1:11434/api/chat') {
    const payload = JSON.parse(init.body)
    writeFileSync(process.env.MODEL_CAPTURE_PATH, JSON.stringify({ url, payload }))
    return Response.json(
      url.includes('openai.com')
        ? {
            output: [{ content: [{ type: 'output_text', text: 'Mock cloud transport response' }] }],
          }
        : { message: { content: 'Mock local transport response' } },
    )
  }
  return real(input, init)
}
