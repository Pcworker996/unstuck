# Unstuck

Unstuck is a non-clinical, user-controlled self-regulation companion. It helps a person turn a voluntary Check-in into a small, concrete Pivot without diagnosing or offering emergency care.

## Foundation

The initial application uses Amazon Cognito for Personal accounts and is designed to deploy through AWS Amplify Hosting. It keeps AWS credentials out of the browser; only Cognito's public identifiers are configured client-side.

For local setup and AWS deployment, see [the deployment guide](docs/deployment.md).

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and enter the public Amazon Cognito User Pool identifiers first.
