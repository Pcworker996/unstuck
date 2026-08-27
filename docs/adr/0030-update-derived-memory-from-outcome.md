# ADR 0030: Update Derived memory from the outcome

When a user submits a Check-in outcome, the backend updates the existing Derived memory using its current factual context, the selected Pivot, and the outcome. It does not send the original raw Quick dump again for this update. The refreshed context is re-embedded with Titan and replaces the pending memory representation so future retrieval can learn whether the Pivot helped.
