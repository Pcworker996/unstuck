# Superseded: Use an App Runner role and Secrets Manager

Status: Superseded by ADR 0051.

The original decision assigned both platform permissions to App Runner. ECS Express Mode replaces App Runner and separates permissions between an ECS task role and task execution role. The least-privilege and no-long-lived-credentials constraints remain unchanged.
