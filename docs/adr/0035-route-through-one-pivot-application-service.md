# ADR 0035: Route requests through one Pivot application service

The HTTP handlers remain thin adapters that authenticate the request, validate its transport shape, invoke one internal `runPivotProtocol` application service, and map the service result to HTTP. The application service owns consent, safety, Derived-memory preparation, retrieval, Bedrock orchestration, persistence, and output validation. This gives browser routes a narrow contract and keeps the domain workflow reusable by tests and future interfaces.
