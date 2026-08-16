-- Synthetic fixtures for the Managed MCP staging validation only.
-- Never run this file against a production database or with real Private entries.

INSERT INTO personal_accounts (account_id)
VALUES ('mcp-fixture-owner'), ('mcp-fixture-other')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO check_ins (
    check_in_id,
    account_id,
    quick_dump,
    emotional_state,
    consent_given,
    save_requested
)
VALUES
    (
        '00000000-0000-0000-0000-0000000000a1',
        'mcp-fixture-owner',
        'I am stuck starting a project.',
        4,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-0000000000a2',
        'mcp-fixture-owner',
        'I am hungry and need water.',
        3,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-0000000000a3',
        'mcp-fixture-owner',
        'I keep circling the same project.',
        4,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-0000000000b1',
        'mcp-fixture-other',
        'I am stuck starting a project.',
        4,
        true,
        true
    )
ON CONFLICT (check_in_id) DO NOTHING;

INSERT INTO private_entries (account_id, check_in_id, quick_dump)
VALUES
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a1',
        'I am stuck starting a project.'
    ),
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a2',
        'I am hungry and need water.'
    ),
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a3',
        'I keep circling the same project.'
    ),
    (
        'mcp-fixture-other',
        '00000000-0000-0000-0000-0000000000b1',
        'I am stuck starting a project.'
    )
ON CONFLICT (account_id, check_in_id) DO NOTHING;

INSERT INTO derived_memories (
    account_id,
    check_in_id,
    derived_context,
    selected_pivot_kind,
    selected_pivot_title,
    outcome_kind,
    pivot_time_seconds,
    embedding
)
VALUES
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a1',
        'stuck project start',
        'task-first-step',
        'Make the next step visible',
        'completed',
        90,
        '[1.0, 0.0, 0.0, 0.0, 0.0, 0.0]'
    ),
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a2',
        'basic needs water',
        'basic-needs-reset',
        'Make one basic reset',
        'skipped',
        60,
        '[0.0, 1.0, 0.0, 0.0, 0.0, 0.0]'
    ),
    (
        'mcp-fixture-owner',
        '00000000-0000-0000-0000-0000000000a3',
        'forgotten stuck project',
        'task-first-step',
        'Make the next step visible',
        'completed',
        120,
        '[1.0, 0.0, 0.0, 0.0, 0.0, 0.0]'
    ),
    (
        'mcp-fixture-other',
        '00000000-0000-0000-0000-0000000000b1',
        'other account stuck project',
        'task-first-step',
        'Make the next step visible',
        'completed',
        90,
        '[1.0, 0.0, 0.0, 0.0, 0.0, 0.0]'
    )
ON CONFLICT (account_id, check_in_id) DO NOTHING;

UPDATE derived_memories
SET forgotten_at = now()
WHERE account_id = 'mcp-fixture-owner'
  AND check_in_id = '00000000-0000-0000-0000-0000000000a3';
