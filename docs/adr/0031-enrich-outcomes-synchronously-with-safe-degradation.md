# ADR 0031: Enrich outcomes synchronously with safe degradation

`POST /api/pivot/outcome` saves the selected Pivot and outcome synchronously so the next Check-in can observe the result immediately. The backend then attempts to regenerate and re-embed the Derived memory in the same request. If enrichment fails, the saved outcome remains authoritative, the previous Derived context and embedding are retained, and the response reports that enrichment was unavailable; a CockroachDB write failure still means the outcome is not saved.
