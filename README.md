# Rose Jade AI™

An original personal-assistant workspace by Christian Foderingham. Rose Jade is an AI character, not a human. The app supports private conversations, explicit memory review, practical planning, file creation and optional PayPal subscriptions.

Deployment target: **https://RoseJade.chrisfoderingham.com**. A Git push does not itself verify that the hostname is serving this app; see deployment instructions for your hosting pipeline.

## Run on Windows

Requires Node.js **24+** and npm. Node SQLite is used for persistent local data.

```powershell
cd C:\Portfolio-Projects\Rose-Jade-AI
npm.cmd ci
npm.cmd run accounts
npm.cmd run dev
```

Visit http://127.0.0.1:3120. The accounts command creates an owner account with a unique generated password on first use. Credentials live in ignored .local/owner-access.json. Never publish that file. New users can register during the temporary public-access window; every account has a separate private workspace.

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd start
```

The root commands now run the working apps/web Next.js application. It contains the HTTP backend and account interface; the original apps/api and apps/admin directories remain architectural placeholders, not separately running services. Shared implementation lives in packages/core, packages/security and packages/ai. Existing Git origin and modular folders are retained.

## Capabilities and honest boundaries

| Area | Working implementation | External setup / limitation |
|---|---|---|
| Chat | Private threads, saved messages, separate account data | Demo templates by default; configure Ollama or OpenAI for actual open-ended AI |
| Voice | Explicit browser dictation and optional speech playback | Browser support/permission required; speech provider may receive audio; not an always-listening avatar |
| Personal learning | Pending memory proposals, approve/edit/reject/forget, goals and tone | Context personalization, not model-weight training or autonomous personality inference |
| Email | Private drafts, review, .eml exports, guarded SMTP send path | SMTP setup and allowlisted recipients required; sending is owner-only; no mailbox read/sync integration |
| Planning | Tasks, events, statuses and ICS calendar export | No Google/Microsoft live calendar sync |
| Portfolio | Private projects; explicit public title/summary/link sharing | HTTPS deployment and frame-origin allowlist required for external embedding |
| Live chats | Private conversation transcripts and follow-up notes | No external live-chat messaging network is connected |
| Forms | Private form questions, stored responses, data export | No automated third-party form submission |
| Files | Markdown, text, DOCX, PDF, CSV, JSON, HTML, Python, JS and TS exports | Generated programs never execute; all outputs need review; PDF has a basic Latin-1 font |
| Decisions | Structured option/constraint/jurisdiction prompts | No live legal research, universal outcome guarantee or absolute protection promise |
| Membership | $5 / $15 / $30 monthly plan previews, PayPal approval/webhook/cancellation adapters | No charges until server PayPal settings and real plans are configured |

Every logged-in account has the workspace tools. Free access has a small configured cloud-request allowance; paid plans increase it. Owner access bypasses that app quota. Cloud model cost is billed separately by the AI provider to the configured server account. The prices are product configuration, not a cost/profitability guarantee.

## AI setup

Copy .env.example to apps/web/.env.local and fill only needed settings. Keep keys on the server. Local option: install a separately licensed model in Ollama and set OLLAMA_MODEL; the app only contacts loopback Ollama URLs. Cloud option: set OPENAI_API_KEY and OPENAI_MODEL, then explicitly enable cloud sharing in Privacy & profile. No model is silently substituted if the selected provider fails.

Approved memories are available to the local model. Cloud AI gets only approved memories individually marked for cloud use, plus the current prompt, recent conversation and configured name/goals/style after global cloud consent. Cloud requests use the Responses API with store:false; this does not override provider security/abuse-retention policies.

## Try the workflows

1. Chat: “Remember that I prefer concise answers.” Review the Pending memory and approve it. Ask “What do you remember about me?” in local demo mode.
2. Add a task, event, email draft and portfolio entry in Workbench. Export the calendar as ICS and the email as MIME. Neither export sends anything.
3. Create a private form, fill it and export private data to retrieve its stored answers. Editing the form preserves responses; keep questions stable after responses or create a new form version.
4. In Create, paste your own content for exact exports or choose a configured model for generation. Download Word and PDF versions. Demo generation is a labeled planning template.
5. Review cloud and microphone consent. Export private data, clear history or erase workspace data using the required typed phrases. Login/payment records remain.
6. Preview a monthly plan. Unconfigured PayPal creates no subscription and takes no payment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [PayPal billing](docs/PAYPAL.md)
- [Provider setup](docs/PROVIDERS.md)
- [Security](SECURITY.md) and [privacy](PRIVACY.md)
- [Validation](docs/VALIDATION.md)

The generated portrait is an original fictional AI character, not a photograph of the owner or a real assistant. Rose Jade AI uses ™; no registered trademark or completed legal registration is asserted.
