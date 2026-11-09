# AWS Amplify cloud-only setup

This guide configures external resources; none have been provisioned or charged by the code update.

## 1. Persistent database

In your chosen AWS region (the screenshots use us-east-2), create or select a **supported Aurora PostgreSQL cluster with RDS Data API enabled**. A regular RDS PostgreSQL instance without Data API is not interchangeable. Set an initial database name such as rosejade, keep database credentials in AWS Secrets Manager, and enable appropriate encryption/backups. Check the selected engine/region's Data API support and costs before creating it.

Record RDS_CLUSTER_ARN, RDS_SECRET_ARN and RDS_DATABASE. No database password belongs in these fields. This app uses HTTPS Data API calls, not a public PostgreSQL socket or local file volume.

## 2. Application configuration secret

Create a Secrets Manager secret containing a JSON object of **string values**. Use docs/cloud-secret.example.json as a shape reference, replacing placeholders privately. At minimum provide OPENAI_API_KEY and OPENAI_MODEL for real AI, plus OWNER_EMAIL and OWNER_PASSWORD (14+ characters) for first initialization. Set PayPal and SMTP fields only when ready. The compute role reads the secret through APP_CONFIG_SECRET_ARN, caching it for up to five minutes per server process.

Remove OWNER_PASSWORD from the secret after initializing the owner if your operational process supports it. Runtime login uses the database password hash; the bootstrap value is never written to a local credential file or returned in the API.

## 3. Initialize the schema

Run the following from an authorized workstation or AWS CloudShell with Node.js 22+, the repository checked out and dependencies installed. Your AWS identity needs the database and secret permissions. Supply the exact values through environment variables (PowerShell example):

```powershell
$env:AWS_REGION='us-east-2'
$env:RDS_CLUSTER_ARN='your-aurora-cluster-arn'
$env:RDS_SECRET_ARN='your-database-secret-arn'
$env:RDS_DATABASE='rosejade'
$env:APP_CONFIG_SECRET_ARN='your-application-config-secret-arn'
$env:APP_ORIGIN='https://your-current-hostname'
npm.cmd run check:cloud
npm.cmd run db:migrate
```

The migration is transactional and uses a PostgreSQL advisory lock. It creates tables and the first owner once. Running it again does not reset passwords or delete data. Runtime web requests do not auto-create local databases or bootstrap accounts. Existing development SQLite data remains untouched; export any valuable data from the previous version before changing over. Automatic historical-data import is not provided by this update.

## 4. Amplify settings

- Repository: ChrisFoderinghamSr/Rose-Jade-AI; branch: main; monorepo root: apps/web.
- The repository's amplify.yml overrides console build YAML. It installs Node 22, uses npm ci, builds from the repository root and publishes apps/web/.next.
- Keep AMPLIFY_MONOREPO_APP_ROOT=apps/web. Do not select a Gen 2 backend unless you separately create one; this app uses its own Data API connection.
- Configure APP_ORIGIN to the exact Amplify HTTPS hostname initially, COOKIE_SECURE=true, AWS_REGION, RDS_CLUSTER_ARN, RDS_SECRET_ARN, RDS_DATABASE and APP_CONFIG_SECRET_ARN.
- Leave PUBLIC_ACCESS_UNTIL empty to keep registration and public portfolios closed, or choose an explicit future ISO timestamp. Existing users may still sign in.
- Set EMBED_ORIGINS only for HTTPS portfolio origins that may frame the read-only widget.
- Assign the **SSR compute role** appropriate permissions for the two secrets and the Aurora Data API. The build/service role is not a substitute for runtime permissions. Use infrastructure/cloud-runtime-policy.json as a scoped template; replace its placeholder ARNs. Custom KMS keys may also need narrowly scoped kms:Decrypt permission.

scripts/configure-amplify.mjs copies only allowlisted, non-secret runtime references into an ignored apps/web/.env.production file during the build. It does not write provider API keys, owner passwords, AWS access keys or PayPal secrets. Those are retrieved at runtime through the compute role and Secrets Manager. The region/reference ARNs are identifiers, not credentials.

## 5. Verify before public use

Confirm the schema migration, owner login, second-account isolation, memory consent/review, cloud AI response, downloads, restart persistence and PayPal sandbox. Then connect RoseJade.chrisfoderingham.com through Amplify custom-domain settings and update APP_ORIGIN to that exact origin, followed by a redeploy. A Git push does not create database resources or prove DNS/TLS success.

The app returns a configuration error if the database references are absent. A missing model key/model or missing user cloud consent blocks AI instead of generating a fake answer. PayPal remains a preview until its complete configuration is supplied.

Sources: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html and https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html

## Missing Next.js runtime after a successful deployment

The first Amplify deployment returned HTTP 500 because its launcher could not resolve /tmp/app/node_modules/next/dist/server/next.js. Next was nested in apps/web/node_modules. The repository now pins the same Next version at the workspace root and web app, generates standalone output, and runs npm run test:package during GitHub CI and Amplify builds. This check copies only the traced server files to an isolated temporary directory, verifies root-level Next resolution and starts the packaged app. It checks the home page and portrait return 200, while absent database settings produce a controlled 503 API response. This is a packaging check; it does not configure or call paid cloud services.

Keep artifacts.baseDirectory as apps/web/.next. The standalone subdirectory is generated by Next for complete server tracing; it is not a replacement Amplify artifact root. A new push should trigger an Amplify build when automatic builds are enabled. If needed, deploy the latest main commit, rather than redeploying the original failed artifact.
