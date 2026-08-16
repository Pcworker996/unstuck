-- Unstuck staging schema contract.
-- Apply this migration to the selected Unstuck staging database only.
-- VECTOR(6) matches the deterministic MVP embedding adapter. A Bedrock model
-- with a different dimension must be introduced through a reviewed migration.

CREATE TABLE personal_accounts (
    account_id STRING PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE check_ins (
    check_in_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id STRING NOT NULL REFERENCES personal_accounts (account_id),
    quick_dump STRING NOT NULL,
    emotional_state INT8 NOT NULL CHECK (emotional_state BETWEEN 1 AND 5),
    consent_given BOOL NOT NULL,
    save_requested BOOL NOT NULL,
    pivot_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, check_in_id)
);

CREATE TABLE private_entries (
    private_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id STRING NOT NULL REFERENCES personal_accounts (account_id),
    check_in_id UUID NOT NULL,
    quick_dump STRING NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT private_entries_owned_check_in_fk
        FOREIGN KEY (account_id, check_in_id)
        REFERENCES check_ins (account_id, check_in_id)
        ON DELETE CASCADE,
    UNIQUE (account_id, check_in_id)
);

CREATE TABLE derived_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id STRING NOT NULL REFERENCES personal_accounts (account_id),
    check_in_id UUID NOT NULL,
    derived_context STRING NOT NULL,
    selected_pivot_kind STRING CHECK (
        selected_pivot_kind IS NULL OR selected_pivot_kind IN (
            'grounding',
            'breathing-focus',
            'reaching-out',
            'basic-needs-reset',
            'task-first-step'
        )
    ),
    selected_pivot_title STRING,
    outcome_kind STRING CHECK (
        outcome_kind IS NULL OR outcome_kind IN (
            'completed',
            'partly-helpful',
            'not-a-fit',
            'skipped'
        )
    ),
    pivot_time_seconds INT8 CHECK (pivot_time_seconds IS NULL OR pivot_time_seconds >= 0),
    updated_emotional_state INT8 CHECK (
        updated_emotional_state IS NULL OR updated_emotional_state BETWEEN 1 AND 5
    ),
    embedding VECTOR(6) NOT NULL,
    forgotten_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT derived_memories_owned_check_in_fk
        FOREIGN KEY (account_id, check_in_id)
        REFERENCES check_ins (account_id, check_in_id)
        ON DELETE CASCADE,
    UNIQUE (account_id, check_in_id)
);

CREATE TABLE pivot_outcomes (
    pivot_outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id STRING NOT NULL REFERENCES personal_accounts (account_id),
    check_in_id UUID NOT NULL,
    selected_pivot_kind STRING NOT NULL,
    outcome_kind STRING NOT NULL CHECK (
        outcome_kind IN ('completed', 'partly-helpful', 'not-a-fit', 'skipped')
    ),
    updated_emotional_state INT8 CHECK (
        updated_emotional_state IS NULL OR updated_emotional_state BETWEEN 1 AND 5
    ),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pivot_outcomes_owned_check_in_fk
        FOREIGN KEY (account_id, check_in_id)
        REFERENCES check_ins (account_id, check_in_id)
        ON DELETE CASCADE,
    UNIQUE (account_id, check_in_id)
);

CREATE INDEX check_ins_account_created_idx
    ON check_ins (account_id, created_at DESC);

CREATE INDEX derived_memories_account_status_idx
    ON derived_memories (account_id, forgotten_at, created_at DESC);

-- The account_id prefix keeps vector retrieval inside one Personal account.
CREATE VECTOR INDEX derived_memories_account_embedding_idx
    ON derived_memories (account_id, embedding vector_cosine_ops);
