# Deploying RoseJade.chrisfoderingham.com

The repository includes a Node/Docker deployment path and GitHub CI. No DNS/hosting provider credentials are included. A repository push can trigger an existing external hosting integration, but DNS alone does not run this Node service. Confirm the configured host's build/start settings and logs.

## Standard Node host

- Node.js 24+; install: npm ci; build: npm run build; start: npm start (loopback port 3120).
- For a host requiring a public container interface, run: node node_modules/next/dist/bin/next start apps/web --hostname 0.0.0.0 --port 3120. Put it behind HTTPS and a reverse proxy; do not expose the development server.
- Set APP_ORIGIN=https://RoseJade.chrisfoderingham.com, COOKIE_SECURE=true, ROSE_PUBLIC_DEPLOYMENT=true, OWNER_EMAIL and a unique 14+ character OWNER_PASSWORD before first run. Remove OWNER_PASSWORD from configuration after initialization if your secrets lifecycle permits; it only bootstraps an empty database.
- Set ROSE_DATA_DIR to a persistent private volume. Ephemeral serverless storage loses SQLite data and is unsuitable without redesign.
- Set a deliberate PUBLIC_ACCESS_UNTIL timestamp. Cloud models, SMTP and PayPal require separate server secrets. Default preview modes do not provide live AI/billing integrations.
- A local-model process must run on the same host/loopback. Inside Docker, loopback is the app container; use a separately engineered private model connection or a suitable shared host setup rather than exposing Ollama publicly. The starter deliberately rejects arbitrary remote model URLs.

## Docker

Copy docs/production.env.example to an ignored .env.production file and fill its values. Run docker compose up --build -d. The service uses a persistent named volume, an unprivileged Node user and a loopback-only published port. The sample Caddyfile is for a host-installed reverse proxy on the same machine. Set the domain A/AAAA or provider CNAME through the existing domain operator, then let the host provision TLS. No DNS record was changed by this build.

Builds must never package .local/, .git/, .env.local or model weights. Docker and Next tracing exclusions are supplied. Database backups belong outside the repository. Test login, user isolation, public expiry, restore, models and PayPal sandbox on the real host before switching payment settings live.

## GitHub

CI runs npm ci, build, typecheck and isolated tests on Node 24. It is a validation workflow, not a deployment workflow. Retain/configure the hosting integration you already use; the repository does not assume a vendor or create a new deployment secret.
