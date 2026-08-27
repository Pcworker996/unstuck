# Superseded: Use AWS App Runner for the MVP application runtime

Status: Superseded by ADR 0050.

The original decision selected AWS App Runner for the hackathon MVP. AWS stopped accepting new App Runner customers on April 30, 2026 and recommends Amazon ECS Express Mode for new containerized applications. The single-runtime and server-side credential boundaries remain valid, but ECS Express Mode replaces App Runner as the deployment platform.
