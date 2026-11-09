# Privacy and user control

Each login has its own conversations, profile, memory, records, forms, files and audit events. No private records are placed in the portfolio widget. The owner account is for initial administration and shared SMTP; it has no ordinary API for reading other accounts' private content. Hosting/database administrators can still access server files and must be trusted.

Conversations persist for 7/30/90 days according to the account setting (30 by default); pruning happens when that account accesses the service, not through a guaranteed background deletion job. Explicit memory proposals and workspace records persist until removed. Memory is not used until Approved; global pause keeps it out of model context. Cloud sharing is separate, off by default, and includes only memories individually marked for cloud use.

“Learning” here means saved user-approved context and preferences, not unsupervised profiling or model retraining. Forgetting memory removes it from this app's future context, not from existing chat text or provider logs. Clear conversation history separately if required. No raw microphone audio is stored by the app, but browser speech services may process it externally after consent.

Cloud AI transmits prompt, bounded recent history and approved shared context only after consent; store:false is set for the OpenAI request. Provider retention/security policies still apply. Local models contact the configured loopback Ollama service. Demo templates use no model provider. Typography currently requests Google Fonts with system fallbacks; self-host fonts if third-party browser requests are disallowed.

Export downloads private workspace data as JSON, including stored form responses, but excludes passwords, sessions and provider secrets. Typed confirmation is required to clear history or erase workspace content. Workspace erasure retains login and subscription records; this initial app does not implement full account deletion or automated statutory privacy-request handling. Payment/card information is handled by PayPal; this app stores plan/subscription identifiers and audit events, not card details.

This is an engineering description, not a completed commercial legal/privacy notice. Publish appropriate operator contact, retention, account-deletion and payment disclosures before inviting real customers.
