# Cloud AI and workflow connections

Rose Jade is cloud-only. Configure OPENAI_API_KEY and OPENAI_MODEL in the server's application secret. Each user must enable explicit cloud sharing before sending prompts. The request contains the prompt, bounded recent history, configured name/goals/style and only approved memories separately marked for cloud use. store:false is used; provider retention/security policies still apply. No Ollama, model download, offline inference or demo-answer path remains.

Cloud provider transport is tested with mocks, not a real paid model account. Source: https://developers.openai.com/api/docs/quickstart

Voice dictation uses the browser's SpeechRecognition service after consent and a microphone click. That service may process audio remotely. The app stores only submitted message text, not raw audio. Optional speech synthesis is separate from model inference. Browser microphone support/permissions require real-device testing.

Email drafts live in the cloud database and can be exported as MIME. Owner-only SMTP sends still require configured server credentials, recipient allowlisting, an exact reviewed revision and explicit confirmation. No mailbox reading or per-user OAuth mail integration is included. Calendar exports are ICS, not live synchronization. Live-chat management currently stores private conversation notes; external messaging and third-party form submission are not connected.

Text, Markdown, Word, PDF, JSON, CSV, HTML and code files can be created from cloud-generated drafts or exact user content. PDF has a basic Latin-1 font. Downloads are user-controlled; cloud-only does not prohibit exporting a file to the user's computer.
