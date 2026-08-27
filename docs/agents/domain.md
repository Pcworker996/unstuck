# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root.
- `docs/adr/` entries that touch the area being worked on.

## File structure

This is a single-context repository:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept in issues, plans, tests, or implementation, use the term defined in `CONTEXT.md`; do not drift to a synonym the glossary explicitly avoids.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.
