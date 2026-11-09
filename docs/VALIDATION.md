# Verification — November 9, 2026

- npm install: success; 59 packages audited, 0 known vulnerabilities reported at installation time.
- npm run build: exit 0; Next.js 16.4.5 production pages, API routes and frame-policy proxy compiled.
- npm run typecheck: exit 0.
- npm test: exit 0; **9 tests passed, 0 failed** (parent integration plus eight subtests), final duration **6590.5613 ms**.

Coverage includes temporary public access and expiry; authentication/origin protection; cross-account isolation; private chat persistence; explicit memory proposals, approval and cloud sharing; local/cloud model payloads; records/revision checks; MIME/ICS exports; private forms and preserved responses; public portfolio field projections; real DOCX/PDF generation and protected downloads; PayPal preview, invalid-signature rejection, verified plan matching and duplicate webhook handling; server restart persistence and user-scoped privacy deletion.

All model and PayPal requests in automated checks were intercepted by controlled test-only mocks. This tests transport and application behavior, not live provider availability or actual merchant payments. No cloud model, installed Ollama model, real SMTP recipient or PayPal subscription was contacted. Voice/microphone input was not exercised. PayPal cancellation and actual external approval need sandbox acceptance testing with the operator's provider settings.

Browser: public landing page and fictional character portrait inspected. Owner login worked, the chat accepted a message, a memory remained Pending, and sign-out returned to the limited public page. The character is displayed above the chat and again beside the composer. Screenshots were saved outside the repository. No comprehensive accessibility or cross-browser certification is asserted.

The original scaffold was backed up before implementation. Existing Git metadata and origin were preserved. Private runtime data, generated owner credentials, .env files, models and dependencies are excluded from the repository. The generated fictional-character PNG is an intentional public app asset.

Docker/Compose and reverse-proxy examples are supplied but were not built/run in this Windows verification. GitHub CI validates on Linux/Node 24 after push. Live DNS, hosting deployment, HTTPS, model credentials, SMTP and PayPal merchant settings are external setup tasks; their success must not be inferred from a code push.
