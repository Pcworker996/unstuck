# 09 — Contract to the sole Google Cloud runtime

**What to build:** After every required behavior runs through the Google-native path, remove the inactive AWS, Bedrock, Cognito, CockroachDB, and ECS implementation from the submitted working tree. The application has one understandable production composition while Git history preserves the earlier runtime as prior art.

**Blocked by:** 08 — Make failures observable, private, and bounded.

**Status:** ready-for-agent

- [ ] The production application composes only Cloud Run, Firebase Authentication, Firestore, Genkit with Gemini on Vertex AI, the embedding service, and private temporary Cloud Storage.
- [ ] No active route, runtime composition, dependency, deployment manifest, environment requirement, or documentation instructs the submitted application to use Cognito, Bedrock, CockroachDB, ECS, or another AWS service.
- [ ] Existing protocol behavior proven by prior tests remains represented through the Google-native Pivot Protocol and deterministic adapters before old implementation is removed.
- [ ] The application starts from empty Firestore and contains no account, Check-in, Private-entry, or Derived-memory migration from the former database.
- [ ] Synthetic demo and evaluation data are clearly labeled and do not contain copied production or personal data.
- [ ] Build, type checking, deterministic tests, and local startup succeed with only the documented Google-native configuration.
- [ ] Repository history remains intact; contraction removes only inactive working-tree implementation and does not rewrite prior commits.
- [ ] Architecture and setup documentation describe one active runtime and distinguish application-owned protocol behavior from Google service adapters.

