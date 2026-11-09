// Start only the deployable files in a temporary directory. A normal `next start`
// can hide missing dependencies by finding them in the developer's source tree.
import assert from 'node:assert/strict'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { once } from 'node:events'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const directory = await mkdtemp(path.join(os.tmpdir(), 'rose-packaged-'))
let server,
  logs = ''
try {
  await cp('apps/web/.next/standalone', directory, { recursive: true })
  const app = path.join(directory, 'apps/web')
  await cp('apps/web/.next/static', path.join(app, '.next/static'), { recursive: true })
  await cp('apps/web/public', path.join(app, 'public'), { recursive: true })
  // Amplify's generated launcher requires Next from the root node_modules folder.
  const requireBundle = createRequire(path.join(directory, 'launcher.cjs'))
  assert.equal(requireBundle('next/package.json').version, '15.5.29')
  assert.ok(requireBundle.resolve('next/dist/server/next.js').startsWith(directory))
  const socket = net.createServer()
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  const env = { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1' }
  for (const key of [
    'NODE_PATH',
    'NODE_OPTIONS',
    'APP_CONFIG_SECRET_ARN',
    'RDS_CLUSTER_ARN',
    'RDS_SECRET_ARN',
    'RDS_DATABASE',
  ])
    env[key] = '' // Override .env.production too: this check must never contact AWS.
  server = spawn(process.execPath, [path.join(app, 'server.js')], {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', (chunk) => {
    logs += chunk
  })
  server.stderr.on('data', (chunk) => {
    logs += chunk
  })
  const base = 'http://127.0.0.1:' + port
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error('Packaged server exited: ' + logs)
    try {
      const response = await fetch(base)
      assert.equal(response.status, 200)
      assert.match(await response.text(), /Rose Jade/)
      ready = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  assert.ok(ready, 'Packaged home page did not start: ' + logs)
  assert.equal((await fetch(base + '/rose-jade.png')).status, 200)
  // Missing external setup must produce a controlled API error, not a startup crash.
  assert.equal((await fetch(base + '/api/public')).status, 503)
  console.log(
    'Packaged server passed: isolated root Next runtime, home 200, image 200, unconfigured API 503.',
  )
} finally {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit')
    server.kill()
    await stopped
  }
  assert.equal(path.dirname(directory), os.tmpdir())
  assert.ok(path.basename(directory).startsWith('rose-packaged-'))
  await rm(directory, { recursive: true, force: true })
}
