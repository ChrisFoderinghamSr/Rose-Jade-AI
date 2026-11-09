# Rose Jade AI™ — cloud-only

An original personal AI workspace by Christian Foderingham. Rose Jade is a fictional AI character, not a human. The app provides private conversations, explicitly reviewed memory, planning tools, document/code exports and optional PayPal subscriptions.

Target domain: **https://RoseJade.chrisfoderingham.com**.

## Cloud architecture

- **Website/API:** Next.js 15.5.29 and Node.js 22+, configured for AWS Amplify Hosting.
- **Persistent data:** Aurora PostgreSQL through the AWS RDS Data API over HTTPS. Accounts, sessions, memories, messages, records, files and subscriptions stay in the cloud database.
- **AI:** server-side OpenAI Responses API only, with explicit per-user cloud consent and separately approved shared memory.
- **Secrets:** AWS Secrets Manager, accessed using the host's AWS role. No keys are exposed in the browser or copied into repository source.
- **Payments:** PayPal subscription approval, provider-verified webhooks and explicit cancellation.

**There is no SQLite runtime, Ollama connection, offline model, demo AI reply or generated local owner-password file.** Missing cloud configuration returns an error; the app never substitutes an offline answer. Files can still be downloaded by the user, and exact-content file creation does not require a model request.

## Deployment steps

1. Follow [CLOUD-SETUP.md](docs/CLOUD-SETUP.md) to supply an Aurora PostgreSQL cluster with Data API, a database credential secret and an application configuration secret. These are paid/external resources; this repository does not create them automatically.
2. Initialize the cloud schema and first owner account using the protected operator command: npm run db:migrate. Existing local SQLite data is not automatically imported or deleted.
3. In Amplify select repository main, mark it as a monorepo and use **apps/web**. The committed amplify.yml supplies install/build/output settings.
4. Configure the non-secret resource references and an SSR compute role using the guide. Build settings alone are not a working database.
5. Deploy and verify the Amplify HTTPS address before connecting the custom hostname. Configure AI and PayPal sandbox before enabling live service.

## Develop and verify

Requires Node.js 22+ and npm. Local development runs the web server, but its application data/AI still require configured cloud services. Tests use a separate PostgreSQL engine and controlled cloud mocks; they do not enable a local production-storage mode.

```powershell
cd C:\Portfolio-Projects\Rose-Jade-AI
npm.cmd ci
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

For development, place cloud references in apps/web/.env.local, authenticate your AWS SDK environment using your own authorized AWS profile, then run npm.cmd run dev. For the standalone migration/check commands, export the variables in your shell; these scripts do not automatically load the Next.js environment file. Never paste real keys into chat or commit them.

## Included workflows

Private accounts; cloud chat threads; voice-to-editable-text input with consent; optional speech playback; Pending/Approved/Rejected memory with editing and deletion; tasks; email drafts and guarded owner-only SMTP; calendar event/ICS exports; portfolio entries and a read-only public widget; private forms/responses; live-chat notes; DOCX/PDF/text/data/code exports; decision comparisons; user-scoped exports, history clearing and workspace erasure; PayPal $5/$15/$30 monthly offers.

Voice uses the browser's speech service, which may transmit audio to its provider. It is not an always-listening avatar. “Learning” means approved context, not model retraining or hidden profiling. External mailbox/calendar/live-chat sync is not implemented. No model gets code-execution or unattended external-action powers. Model responses and legal/rights comparisons require human verification.

Temporary public portfolio viewing/registration is **closed by default** unless PUBLIC_ACCESS_UNTIL is a future timestamp. Visitors do not get unauthenticated AI requests. Existing users can sign in after the public window closes. Logged-in free and paid users share the workspace features, with different cloud-request allowances.

Paid plans remain previews until PayPal is configured. No card data is collected by Rose Jade. Real provider costs, hosting and billing require separate operator configuration and acceptance testing.

## Documentation

[Cloud setup](docs/CLOUD-SETUP.md) · [Architecture](docs/ARCHITECTURE.md) · [AI/workflow providers](docs/PROVIDERS.md) · [PayPal](docs/PAYPAL.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Validation](docs/VALIDATION.md)

Source code and artwork are retained in Git. Branding uses ™; no completed trademark or copyright registration is asserted.
