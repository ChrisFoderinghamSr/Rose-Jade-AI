# Security

Implemented: salted scrypt passwords; random eight-hour HttpOnly/SameSite=Strict session cookies with hashed server tokens; same-origin writes; account-level ownership checks; bounded JSON inputs; persistent login/chat/signup quotas; public/private data separation; reviewed external-email actions; no model shell/tool access; explicit cloud/microphone consent; signed-provider webhook verification and action audit events.

Use HTTPS, COOKIE_SECURE=true and the exact APP_ORIGIN on a network host. The server needs a persistent private ROSE_DATA_DIR, a strong owner bootstrap password and OS/file-volume controls. Secrets and runtime data must stay outside source control and deployment source archives. Back up SQLite consistently with its WAL; stop the server for a simple whole-directory backup. Test restores.

## Limits before public paid service

This is an initial working application, not a penetration-tested or compliance-certified service. Email verification, automated password recovery, MFA/SSO, distributed rate limiting, mature account administration, payment dispute/refund support, provider spending caps, data encryption/key management, monitoring, backups, migrations and operational incident response need further work. The signup cap is global (30/day), login limits are per normalized email and private chat is 60/hour; a reverse proxy/WAF should add trusted network/IP limits. Plan cloud limits use a calendar-month key and provider attempts count toward them; provider-side budgets remain necessary.

Request-size checks occur after reading bodies and do not substitute for streaming proxy limits. SQLite/private files are not application-encrypted. No real documents or secrets belong in the public demo. Models can still produce harmful or incorrect text: there is no guarantee that prompt instructions eliminate injection. The structural mitigation is no model execution privileges and separate reviewed application actions.

Public preview defaults to seven days from first database creation; set PUBLIC_ACCESS_UNTIL explicitly on the host. Expiry closes guest chat, registration and public portfolio display; existing users can still sign in. The public demo is template-only and has a global request cap. No unattended admin powers, covert monitoring or absolute user-protection promises are implemented.

Default frame policy denies embedding owner pages. Only /embed permits configured HTTPS EMBED_ORIGINS; it never exposes private account data. Production domain ownership and TLS must be verified by the operator.
