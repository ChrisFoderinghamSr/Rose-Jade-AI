# Privacy — cloud-only revision

Accounts, conversations, memory, workspace records, form responses, documents and payment identifiers are stored in Aurora PostgreSQL. Model inference is cloud-based. Private data is isolated per account; read-only portfolio embedding exposes only explicitly published title/summary/link fields.

Memory remains Pending until approval. Global pause and individual cloud-sharing flags control future model context. This is personalization, not autonomous retraining or hidden profiling. Cloud prompts, bounded history and selected approved context are sent to the configured model only after consent; store:false does not override provider security/retention policy. Forgetting memory cannot retract material already sent to a provider or remove copies from old conversations.

Conversation retention is 7/30/90 days (30 by default), pruned on that account's access rather than a guaranteed background deletion schedule. Memory and records persist until removed. Workspace export/erasure is user-scoped. Login and subscription records remain after workspace erasure; full account deletion and statutory request handling are not yet implemented. PayPal processes payment details; the app stores subscription identifiers and plan/audit data, not card numbers.

Browser speech services may receive audio after voice consent; the app does not save raw audio. Fonts may load from Google Fonts. This is a technical description, not a completed commercial legal notice. Publish operator contact, retention/deletion and payment policies before inviting real customers.
