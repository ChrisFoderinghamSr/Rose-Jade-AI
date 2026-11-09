# Cloud-only architecture

Browser → Amplify Next.js API → authenticated, asynchronous service operations → Aurora PostgreSQL through AWS RDS Data API.

The model path is server-only OpenAI Responses API with store:false, explicit cloud-data consent and only approved individually shared memories. Missing/unavailable providers never fall back to templates. PayPal remains a separately confirmed payment flow.

packages/core/src/db.mjs is a parameterized PostgreSQL Data API adapter. It binds values by type, preserves quoted SQL strings, and uses AsyncLocalStorage to attach a separate transaction ID to every transaction scope. There is no SQLite import, disk database or filesystem credential generation. Operators initialize schema through scripts/cloud-migrate.mjs; runtime requests do not run migrations. Timestamp counters use BIGINT. Rate-limit increments use one PostgreSQL upsert and revisions are conditional at the database write boundary.

Every private record is user-scoped before reads/changes/downloads. Public portfolio output projects only published title, summary and HTTPS link. Model text has no shell/tool privileges. File content is stored as text in the cloud database and exported as attachments on demand; generated code is never run. No persistent local server filesystem is needed. SQL results and exports remain subject to AWS Data API/HTTP response limits; large datasets require pagination/export jobs before operating at substantial scale.

Secrets Manager supplies server provider settings through the compute IAM role. Connection ARNs and origin are the only values written into the build's runtime-reference file. Next.js 15.5.29 with Node middleware targets Amplify's documented support. The app remains a working initial implementation, not an audited commercial service.
