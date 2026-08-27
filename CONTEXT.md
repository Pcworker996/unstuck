# Unstuck

Unstuck is a non-clinical self-regulation companion for people who want help responding to moments of elevated distress. It helps a person recognize their own patterns and regain agency through a next action without diagnosing or providing emergency care.

## Language

**Self-regulation companion**:
A user-controlled, non-clinical product that supports a person in responding to their emotional state. It does not diagnose, predict a crisis, or replace professional or emergency care.
_Avoid_: therapist, mental-health provider, crisis predictor

**Check-in**:
A voluntary report by a person about their current emotional state and relevant context.
_Avoid_: assessment, diagnosis

**Stuck situation**:
A person's messy, incomplete account of what is preventing forward movement in a non-clinical, everyday scenario. It may include their own description and supporting artifacts.
_Avoid_: work packet, case, clinical presentation

**Situation map**:
A person-editable representation of a stuck situation's relevant facts, uncertainties, constraints, attempted pivots, and feedback. It keeps the person's statements distinct from the pivot guide's interpretations.
_Avoid_: work map, assessment, psychological profile

**Activity trace**:
A concise record of the pivot guide's observable actions and situation-map changes during a pivot protocol. It does not expose hidden reasoning.
_Avoid_: chain of thought, reasoning trace

**Supporting artifact**:
Optional material a person chooses to add to a stuck situation, such as a document, image, or recording. A quick dump remains sufficient to continue without one.
_Avoid_: required evidence, intake requirement

**Pivot**:
A small, concrete action a person chooses to shift or stabilize their immediate state. A pivot may be a grounding action, a connection action, or the first step of a daunting task.
_Avoid_: treatment, intervention

**Quick dump**:
A low-friction, text-first capture of the thought, task, or situation contributing to a person's immediate distress.
_Avoid_: journal entry, clinical note

**Pivot protocol**:
The guided sequence from a check-in and quick dump to one selected pivot and its outcome.
_Avoid_: treatment plan, intervention

**Pivot recommendation**:
The agent's suggested best-fit pivot for a person's current moment, accompanied by alternatives they may choose, regenerate, or dismiss.
_Avoid_: prescription, automatic intervention

**Pivot library**:
The intentionally bounded set of pivot types Unstuck may recommend: grounding, breathing or focus, reaching out, basic-needs reset, and a task first step. The pivot guide personalizes within these types rather than inventing unbounded guidance.
_Avoid_: treatment catalog, open-ended advice

**Pivot guide**:
The single Unstuck agent that turns a current check-in and relevant prior memories into pivot recommendations while respecting the safety interruption and memory controls.
_Avoid_: agent swarm, therapist

**Model provider**:
The managed AI service that generates derived memories, semantic embeddings, and pivot recommendations from a private entry.
_Avoid_: decision-maker, safety system

**Pivot time**:
The elapsed time between a person identifying as stuck or overwhelmed and recording the outcome of their selected pivot.
_Avoid_: recovery time

**Pivot outcome**:
A person's optional report of whether a selected pivot was completed, partly helpful, not a fit, or skipped, with an optional agency shift.
_Avoid_: treatment outcome, recovery measure

**Agency shift**:
A person's optional report that, after a pivot, they feel more able, about as able, or less able to continue. It describes one immediate moment rather than measuring overall wellness.
_Avoid_: wellness score, recovery score, emotional-state rating

**Pivot rate**:
A view of a person's pivot history over time, including outcomes, pivot time, and recurring context patterns.
_Avoid_: wellness score

**Your Patterns**:
The focused history view that shows a person's helpful pivots, typical pivot time, and recurring self-reported contexts, with links back to the memories behind each signal.
_Avoid_: health dashboard, diagnostic analytics

## Memory

**Derived memory**:
A compact, searchable representation of a prior check-in's relevant context, pivot, and reported outcome, used to recognize similar moments over time.
_Avoid_: diagnosis, psychological profile

**Semantic retrieval**:
Finding prior derived memories by similarity of meaning to a current check-in, rather than only matching exact words or fixed tags.
_Avoid_: keyword search, psychological inference

**Private entry**:
The original quick-dump text supplied by a person. It is distinct from derived memory and remains under that person's control.
_Avoid_: clinical record, journal data

**Memory control**:
A person's ability to decide whether an entry is saved, inspect and delete stored entries or derived memories, and remove a remembered pattern.
_Avoid_: privacy setting

**Saved check-in**:
A check-in retained as private entry and derived memory after the person has consented and left its visible save control enabled. A person may instead process a check-in without saving it.
_Avoid_: automatic surveillance record

**Memory explanation**:
An optional, factual account of the prior user-owned patterns that informed a pivot recommendation. It does not make psychological claims about the person.
_Avoid_: diagnosis, hidden reasoning

**Guidance preference**:
A person's explicit, inspectable choice about how the pivot guide should support them, such as favoring concrete steps or avoiding a pivot type. It is not an inferred personality trait.
_Avoid_: personality profile, hidden preference, psychological inference

**Safety interruption**:
A dedicated path for a person who indicates immediate danger to themselves or another person. It replaces the normal pivot flow with encouragement to seek urgent, human, local support.
_Avoid_: crisis counseling, emergency intervention

## People

**Starting persona**:
An early-career engineer or comparable knowledge worker who becomes overwhelmed by ambiguous, high-stakes work and wants private, immediate support to regain agency.
_Avoid_: patient, customer segment

**Mobile-first experience**:
The primary Unstuck interface, designed for short, interruption-prone check-ins on a phone while remaining usable in a web browser on larger screens.
_Avoid_: desktop dashboard

**Personal account**:
The authenticated identity through which a person owns and accesses their Unstuck history across devices.
_Avoid_: anonymous session, shared profile

**Self-reported context**:
The information a person voluntarily provides through check-ins, chosen pivots, and outcomes. It is the MVP's only source of personal context.
_Avoid_: passive tracking, inferred surveillance

**User-initiated support**:
Support that begins when a person opens Unstuck and chooses to make a check-in. The MVP does not send reminders or use passive monitoring.
_Avoid_: proactive monitoring, intervention
