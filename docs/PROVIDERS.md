# Models and workflow connections

## Local model

Install Ollama and obtain a model under its license. Configure OLLAMA_MODEL and optionally OLLAMA_URL=http://127.0.0.1:11434 in apps/web/.env.local. The model must already be installed; the app does not download weights. Local-model requests use POST /api/chat with stream:false. Source: https://docs.ollama.com/api/chat

## Cloud model

Configure a server-side OPENAI_API_KEY and a model accessible to that account in OPENAI_MODEL. Enable cloud sharing inside each account before using it. The app uses https://api.openai.com/v1/responses with store:false; recent chat and selected approved context are sent. No tools, browser access or shell access are granted to the model. Provider costs/access depend on the account. Source: https://developers.openai.com/api/docs/quickstart

Neither real model provider was called during integration tests; controlled mocks validated payload structure, consent gating and memory filtering. No production key is bundled. Missing/failed providers return an error rather than a fake AI success.

## Voice

Browser SpeechRecognition/webkitSpeechRecognition support varies. Enable voice consent, then click the microphone; speech becomes editable message text before sending. Raw audio is not stored by this app. Browser recognition may use a vendor service; local AI does not make browser recognition automatically offline. Speech synthesis is optional and may use installed/vendor voices. No continuous microphone use, camera capture or lip-sync animation is implemented. Microphone behavior was not automatically exercised in tests.

## Email, calendar and live-chat systems

Email drafts work locally. For external SMTP set MAIL_MODE=smtp plus SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and SMTP_ALLOWED_RECIPIENTS. Only the owner may send through that shared server account. Review the exact revision, choose Reviewed and explicitly confirm sending. SMTP port 587 requires STARTTLS; 465 uses TLS. An ambiguous failure marks delivery uncertain; check provider logs before making another draft. No real mail was sent during testing.

Calendar events export as ICS for import to your calendar. External mailbox reads, Google/Microsoft OAuth, live calendar updates, live-chat messaging providers and third-party form filling are not implemented or advertised as connected. Those need per-user OAuth scopes, account linking, revocation, audited action previews and provider-specific integration before use.
