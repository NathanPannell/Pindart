CREATE TABLE IF NOT EXISTS oauth_attempts (
    state_hash BYTEA PRIMARY KEY,
    code_verifier TEXT NOT NULL,
    proof_challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tickets (
    ticket_hash BYTEA PRIMARY KEY,
    encrypted_token BYTEA NOT NULL,
    proof_challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

