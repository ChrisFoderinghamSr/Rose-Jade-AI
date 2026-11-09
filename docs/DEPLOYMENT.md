# Deployment

The active deployment target is AWS Amplify with Aurora PostgreSQL Data API and cloud AI only. Follow [CLOUD-SETUP.md](CLOUD-SETUP.md). The committed amplify.yml owns build settings. No local database volume, generated account file or offline provider is supported.

GitHub CI builds, typechecks, tests PostgreSQL behavior with controlled cloud transports and audits dependencies. A push is not proof that your AWS resources, DNS, HTTPS, secrets or PayPal account are configured.
