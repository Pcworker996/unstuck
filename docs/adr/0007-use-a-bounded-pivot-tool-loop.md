# Use a bounded Pivot tool loop

The Pivot Guide will use one bounded tool-calling loop: the model may request user-scoped memory retrieval and then return a structured recommendation from the approved Pivot library. The backend retains control of identity, consent, safety, ownership, persistence, and final validation; the model cannot issue arbitrary SQL, take external actions, or bypass the safety interruption.
