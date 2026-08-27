# Deploying Unstuck with Amazon ECS Express Mode

_Researched August 18, 2026. All references are official AWS sources._

## Decision

Use Amazon ECS Express Mode for a new deployment of this Next.js application. AWS App Runner stopped accepting new customers on April 30, 2026; existing App Runner services remain operational, but AWS recommends ECS Express Mode for containerized applications. [AWS App Runner product notice](https://aws.amazon.com/apprunner/) and [AWS migration guidance](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html).

Express Mode starts from a container image, a task execution role, and an infrastructure role. It provisions a Fargate-backed ECS service, task definition, HTTPS Application Load Balancer and certificate, networking and security groups, CloudWatch logging and deployment alarms, and Application Auto Scaling. The resources remain visible in this AWS account. [Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html) and [resources created by Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html).

## Project requirements

### Container and ECR

Unlike an App Runner source deployment, Express Mode requires a container image. For Unstuck, build the Next.js production image from a Dockerfile and push it to a private Amazon ECR repository before creating the service. Express Mode can also use another private registry when registry credentials are stored in Secrets Manager, but ECR is the direct AWS-native path. [App Runner source migration](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html) and [Express Mode creation prerequisites](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-create-full.html).

Set the Express Mode `containerPort` to the port exposed by the production image. The container must listen on that port and on an interface reachable outside the container.

### IAM roles

Use three separate roles:

| Role | Requirement for Unstuck | Purpose and permissions |
| --- | --- | --- |
| Task execution role | Required | Trusted by `ecs-tasks.amazonaws.com`. Attach `AmazonECSTaskExecutionRolePolicy` so ECS/Fargate can pull the ECR image and publish logs. Because `DATABASE_URL` is injected from Secrets Manager, add least-privilege `secretsmanager:GetSecretValue`; add `kms:Decrypt` only when the secret uses a customer-managed KMS key. [Task execution role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html). |
| Express infrastructure role | Required | Trusted by `ecs.amazonaws.com`. Attach `AmazonECSInfrastructureRoleforExpressGatewayServices`; ECS uses it to provision and manage the Express Mode infrastructure. [Express Mode CLI setup](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html). |
| Application task role | Required by this project | Trusted by `ecs-tasks.amazonaws.com`. Grant the application least-privilege `bedrock:InvokeModel` access to the configured Titan and Nova model resources. ECS makes task-role credentials available to application code in the container; Bedrock `Converse` also requires `bedrock:InvokeModel`. [ECS task role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) and [Bedrock Converse authorization](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html). |

The execution and infrastructure roles must exist before service creation. The task role is optional to Express Mode itself, but not to this application because its backend calls Bedrock. Do not put Bedrock application permissions on the task execution role.

### Environment variables and secrets

Configure ordinary values as environment variables, including the AWS Region, Cognito IDs, Bedrock model IDs and timeout, database pool size, and retrieval threshold. Configure `DATABASE_URL` as an ECS container secret whose `valueFrom` is its Secrets Manager ARN. The console exposes these as the `Environment variable` and `Secret` value types; the CLI uses the primary container's `environment` and `secrets` arrays. [Express Mode console flow](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-first-run.html) and [Express Mode update parameters](https://docs.aws.amazon.com/cli/latest/reference/ecs/update-express-gateway-service.html).

Secrets are injected into the container when a task starts. Rotating a Secrets Manager value does not update already-running containers; start a new deployment so replacement tasks receive the new value. Environment variables are visible to the process and may be visible through logs or debugging tools, so only inject secrets the process actually needs. [ECS Secrets Manager environment behavior](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html).

For production, do not set `UNSTUCK_DEV_AUTH`; configure both public and server-side Cognito identifiers instead.

### Public URL and health checks

The default deployment creates an internet-facing Application Load Balancer and returns a unique HTTPS URL in the form `servicename.ecs.region.on.aws`. A default VPC deployment needs public subnets; AWS documents at least two public subnets in two Availability Zones, each with sufficient free IP addresses. [Express Mode CLI prerequisites](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html) and [network defaults](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html).

Express Mode enables Application Load Balancer health checks. Set `--health-check-path` to a lightweight endpoint that returns HTTP 200 without authentication. The target group sends checks to the configured container port, every 30 seconds by default. This project provides `/api/health`, which checks that the Next.js process can serve requests without making Bedrock or CockroachDB availability part of the load balancer's liveness decision. [Express Mode load balancer and target-group defaults](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html) and [health-check guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-best-practices.html).

## Deployment flow

Replace placeholders before running these commands. Use immutable image tags or image digests for repeatable releases.

```bash
aws ecr create-repository --repository-name unstuck --region <region>
aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID=<pool-id> \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<client-id> \
  -t unstuck:<release> .
docker tag unstuck:<release> <account-id>.dkr.ecr.<region>.amazonaws.com/unstuck:<release>
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/unstuck:<release>
```

This follows the official ECR create, authenticate, tag, and push workflow. [Amazon ECR CLI getting started](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html).

After creating the IAM roles and Secrets Manager secret, create the service:

```bash
aws ecs create-express-gateway-service \
  --region <region> \
  --service-name unstuck \
  --primary-container '{
    "image":"<account-id>.dkr.ecr.<region>.amazonaws.com/unstuck:<release>",
    "containerPort":<container-port>,
    "environment":[
      {"name":"AWS_REGION","value":"<region>"},
      {"name":"COGNITO_USER_POOL_ID","value":"<pool-id>"},
      {"name":"COGNITO_USER_POOL_CLIENT_ID","value":"<client-id>"},
      {"name":"BEDROCK_EMBEDDING_MODEL_ID","value":"amazon.titan-embed-text-v2:0"},
      {"name":"BEDROCK_GENERATION_MODEL_ID","value":"amazon.nova-lite-v1:0"}
    ],
    "secrets":[
      {"name":"DATABASE_URL","valueFrom":"<database-secret-arn>"}
    ]
  }' \
  --execution-role-arn <task-execution-role-arn> \
  --infrastructure-role-arn <express-infrastructure-role-arn> \
  --task-role-arn <application-task-role-arn> \
  --health-check-path "/api/health" \
  --monitor-resources
```

The public client also needs `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` available when `next build` creates the production image. Values prefixed with `NEXT_PUBLIC_` are therefore build inputs for this project, not secrets to defer until ECS starts the container.

To deploy a later image or configuration, call the update API with the service ARN and changed primary-container configuration:

```bash
aws ecs update-express-gateway-service \
  --region <region> \
  --service-arn <express-service-arn> \
  --primary-container '<complete-updated-primary-container-json>' \
  --monitor-resources
```

Express Mode creates a new service revision and deploys updates using its managed canary process with health checks and alarm-based rollback. Status can also be inspected with `aws ecs monitor-express-gateway-service` and `aws ecs describe-express-gateway-service`. [Updating an Express Mode service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-update-full.html) and [CLI deployment monitoring](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html).

The equivalent console flow is **Amazon ECS console → Express mode → specify the ECR image → select or create the infrastructure and task execution roles → Additional configurations → set the container port, health path, environment variables, secrets, and application task role → Create**. After deployment reaches `ACTIVE`, use the Application URL shown by ECS. For an update, open the Express service in its cluster, choose **Update service**, select the new ECR image (AWS recommends selecting by digest), adjust configuration, and choose **Update**. [Create in the ECS console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-first-run.html) and [update in the ECS console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-update-full.html).

## Official AWS sources

- [AWS App Runner product notice](https://aws.amazon.com/apprunner/)
- [AWS App Runner availability and migration guidance](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
- [Amazon ECS Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
- [Resources created by Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html)
- [Create an Express Mode service using the AWS CLI](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html)
- [Create an Express Mode service using the console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-first-run.html)
- [Update an Express Mode service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-update-full.html)
- [Amazon ECS task execution role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
- [Amazon ECS task role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Amazon ECR CLI workflow](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html)
- [Amazon ECS Secrets Manager environment variables](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)
- [Amazon Bedrock Converse API authorization](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
