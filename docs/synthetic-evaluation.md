# Synthetic evaluation data

The repository contains no copied production or personal data. Any demo or
evaluation Quick dumps, supporting artifacts, saved Check-ins, and Guidance
preferences must be synthetic and clearly labeled as synthetic before use.

The Google-native runtime starts with an empty Firestore database. It creates
owner-scoped protocol, memory, preference, and quota documents on demand; no
database migration or import from the former runtime is supported.

## Reproduce the evaluation

Run the deterministic suite locally. It uses only in-memory Google adapters,
committed synthetic cases, and no Vertex call:

~~~bash
npm run eval:deterministic
~~~

The command writes the concise, content-free result artifact to
`evaluation-results/deterministic.json`. The artifact is ignored because it is
generated evidence, not product data.

The live evaluation is opt-in and must use synthetic input only:

~~~bash
npm run eval:live
~~~

It writes a separate `evaluation-results/live-vertex.json` artifact containing
the prompt version, model ID, schema and invariant results, latency, observed
token use, and an estimated cost. It never writes the Quick dump, model output,
artifact content, prompts, credentials, or other personal content. Cost is
estimated from `GOOGLE_EVAL_INPUT_USD_PER_MILLION_TOKENS` and
`GOOGLE_EVAL_OUTPUT_USD_PER_MILLION_TOKENS`, with documented code defaults that
should be updated for the chosen Vertex model's current pricing.

The deterministic suite remains the build gate; a passing live model run does
not replace its invariant checks.
