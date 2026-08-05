# Deploy Unstuck on AWS Amplify

Ticket #2 uses **AWS Amplify Hosting** for the Next.js application and **Amazon Cognito** for Personal accounts. This keeps AWS credentials on the deployment side: the browser receives only Cognito's public User Pool identifiers.

## One-time AWS setup

1. Create an Amazon Cognito User Pool with self-service email sign-up enabled.
2. Create a User Pool app client with no client secret and the same sign-in settings.
3. In AWS Amplify, create a new app from this GitHub repository. Select the Next.js build preset.
4. Add `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` from the User Pool to Amplify's environment variables.
5. Deploy the `main` branch. Amplify provides the public URL.

## Local setup

Copy `.env.example` to `.env.local`, replace the placeholder identifiers, install dependencies with `npm install`, and run `npm run dev`.

The initial home is deliberately empty and private. The next ticket adds the Quick dump and curated Pivot flow; Bedrock and CockroachDB credentials will remain in backend-only configuration when those integrations are introduced.
