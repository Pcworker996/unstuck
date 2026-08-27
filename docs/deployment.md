# Deploy Unstuck on Amazon ECS Express Mode

Unstuck runs as one containerized Next.js application on Amazon ECS Express
Mode. The browser receives the mobile-first UI and calls the authenticated
route handlers in the same container. Only the server process calls Amazon
Bedrock and CockroachDB.

AWS stopped accepting new AWS App Runner customers on April 30, 2026 and
recommends ECS Express Mode for new containerized applications. Existing App
Runner customers can continue operating their services, but App Runner is not
the deployment target for this project. See the
[AWS App Runner availability change](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
and [ECS Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html).

## Runtime shape

```text
Browser -> ECS Express Mode -> Next.js UI and authenticated API routes
                            -> Bedrock through the ECS task role
                            -> CockroachDB over a TLS connection

Docker build -> Amazon ECR -> ECS Express Mode on Fargate
```

Express Mode provisions and manages the Fargate service, HTTPS Application
Load Balancer, networking, auto scaling, CloudWatch integration, and deployment
alarms. The application remains responsible for Cognito verification, Bedrock
requests, CockroachDB ownership checks, migrations, and private-data handling.

## Prerequisites

- Docker and a current AWS CLI v2 installation
- An AWS account and Region with access to the selected Bedrock models
- An Amazon Cognito User Pool and app client without a client secret
- A CockroachDB connection URL with TLS enabled
- An Amazon ECR private repository
- A default VPC with public subnets, or explicitly selected subnets that have
  outbound access to Bedrock, Secrets Manager, and CockroachDB

Use one AWS Region for ECR, ECS, Secrets Manager, and Bedrock for the simplest
MVP deployment. ECS Express Mode requires a container image, task execution
role, and infrastructure role. This project also supplies a task role because
the application invokes Bedrock.

## Local setup

```sh
cp .env.example .env.local
npm install
npm run dev
```

The local development flag uses a fixed server-side subject and does not accept
an account ID from request JSON. Disable `UNSTUCK_DEV_AUTH` when testing real
Cognito. Local real-platform operation still requires a CockroachDB
`DATABASE_URL` and AWS credentials through the normal AWS SDK credential chain.

## Cognito

1. Create a User Pool with self-service email sign-up enabled.
2. Create a User Pool app client without a client secret.
3. Record the User Pool ID and app client ID.
4. Use those values for both `NEXT_PUBLIC_COGNITO_*` build arguments and
   `COGNITO_*` runtime environment variables.

The browser needs the public identifiers to sign in. The backend independently
verifies each ID token and derives account ownership from its `sub`; it never
trusts a browser-provided account ID. The `NEXT_PUBLIC_*` values are compiled
into the browser bundle, so changing the Cognito pool requires rebuilding the
image.

## CockroachDB schema

1. Apply `db/migrations/0001_unstuck_memory.sql` to a new database.
2. Apply `db/migrations/0002_titan_v2_embeddings.sql`.
3. Run `npm run db:reembed` if Derived memories existed before the Titan
   migration.
4. Verify that all `derived_memories.embedding` values are populated, then run:

```sql
ALTER TABLE derived_memories ALTER COLUMN embedding SET NOT NULL;
```

Run migrations as a separate release step before deploying an image that
depends on them. The web process never mutates the schema during startup.

For the staging-only Managed MCP workflow, see
[the Managed MCP staging runbook](managed-mcp-staging.md).

## Build and push the image

Create an ECR repository once:

```sh
aws ecr create-repository \
  --repository-name unstuck \
  --region us-east-1
```

Authenticate Docker, build the production image, and push it. Replace the
account, Region, Cognito, and image-tag placeholders:

```sh
aws ecr get-login-password --region us-east-1 | \
  docker login \
    --username AWS \
    --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_example \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=exampleclientid \
  --tag 123456789012.dkr.ecr.us-east-1.amazonaws.com/unstuck:IMAGE_TAG \
  .

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/unstuck:IMAGE_TAG
```

Use a unique immutable tag such as the Git commit SHA for each release. Do not
pass `DATABASE_URL` or AWS credentials as Docker build arguments.

The explicit `linux/amd64` target is required when building on an Apple Silicon
Mac for the default ECS Express Mode Fargate runtime. Without it, the task exits
with `exec format error` before Next.js starts.

## Create the ECS IAM roles

ECS Express Mode uses three distinct roles for this application:

| Role | Trusted service | Purpose |
| --- | --- | --- |
| Task execution role | `ecs-tasks.amazonaws.com` | Pull the ECR image, publish logs, and inject `DATABASE_URL` from Secrets Manager |
| Infrastructure role | `ecs.amazonaws.com` | Let Express Mode provision and manage its load balancer, networking, scaling, and deployment resources |
| Task role | `ecs-tasks.amazonaws.com` | Give the running Next.js process permission to invoke only the approved Bedrock models |

In the ECS Express Mode console, AWS can create the first two roles and attach
`AmazonECSTaskExecutionRolePolicy` and
`AmazonECSInfrastructureRoleforExpressGatewayServices`. If you create them
manually, follow the
[official Express Mode IAM walkthrough](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html).

As of August 18, 2026, the AWS-managed Express infrastructure policy can omit
`ec2:DescribeInternetGateways` even though public Express Mode provisioning
calls it. If the resource monitor reports that exact denial, add this narrowly
scoped inline policy to the infrastructure role and redeploy the service so ECS
assumes a fresh role session:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DescribeInternetGatewaysForExpressMode",
      "Effect": "Allow",
      "Action": "ec2:DescribeInternetGateways",
      "Resource": "*"
    }
  ]
}
```

Add `secretsmanager:GetSecretValue` for the single `DATABASE_URL` secret to the
task execution role. If the secret uses a customer-managed KMS key, also allow
`kms:Decrypt` for that key. Secret retrieval belongs to the execution role
because ECS injects the value when the task starts.

Create a separate task role with this least-privilege policy, replacing the
Region if needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeApprovedUnstuckModels",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
      ]
    }
  ]
}
```

Do not place long-lived AWS access keys in the image or ECS environment. The
AWS SDK automatically uses credentials supplied through the task role.

## Store the CockroachDB URL

Create one Secrets Manager secret whose entire value is the TLS-enabled
CockroachDB connection URL. Name it something scoped, such as
`unstuck/production/database-url`. Configure the ECS container environment so
`DATABASE_URL` is a **Secret** value referencing that ARN.

ECS injects secrets when a task starts. After rotating the value, deploy or
restart the tasks so they receive the new version. See
[passing Secrets Manager values to ECS containers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html).

## Create the Express Mode service

Open **Amazon ECS -> Express mode -> Create** and configure:

- Image: the immutable ECR image URI or digest
- Service name: `unstuck`
- Container port: `3000`
- Health check path: `/api/health`
- Task execution role: the ECS execution role described above
- Infrastructure role: the Express Mode infrastructure role described above
- Task role: the Unstuck Bedrock task role
- Minimum tasks: `1` for the hackathon MVP

Set these non-secret runtime environment variables:

```text
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_example
COGNITO_USER_POOL_CLIENT_ID=exampleclientid
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0
BEDROCK_GENERATION_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_TIMEOUT_MS=12000
MEMORY_SIMILARITY_THRESHOLD=0.5
DATABASE_POOL_MAX=5
```

Add `DATABASE_URL` separately as the Secrets Manager value. Do not set
`UNSTUCK_DEV_AUTH` or `UNSTUCK_DEV_SUBJECT` in ECS.

The default VPC/public-subnet setup is sufficient for a public hackathon MVP
when outbound traffic is allowed. If you select private subnets, provide NAT or
the required VPC endpoints and a route to CockroachDB. Keep security-group
rules limited to the traffic required by the generated load balancer and the
application's outbound dependencies.

Create the service and wait until its status is `ACTIVE`. Express Mode returns
an HTTPS URL in the form `https://SERVICE_NAME.ecs.REGION.on.aws/`. Verify:

```sh
curl https://SERVICE_NAME.ecs.REGION.on.aws/api/health
```

The response should be `{"status":"ok"}`. Then test Cognito sign-in and the
complete Pivot protocol. For later releases, push a new immutable image and use
the service's **Deploy -> Update service** action to select it. Keep the prior
image available until the canary deployment and application checks pass.

## Runtime proof for the hackathon

1. Open the ECS application URL and sign in with Cognito.
2. Submit a consented Check-in and record a helpful Pivot outcome.
3. Submit a differently worded but similar Check-in.
4. Show the memory explanation and changed recommendation.
5. Inspect, forget, and delete the saved memory.
6. Capture the ECS Express Mode service, Bedrock invocation evidence, and
   CockroachDB vector retrieval evidence without exposing private values.

This demonstrates that ECS hosts the actual application, Bedrock performs
generation and embedding, CockroachDB Distributed Vector Indexing affects the
agent's recommendation, and the person retains memory control.
