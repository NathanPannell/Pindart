import secrets
from datetime import datetime, timedelta, timezone

from psycopg_pool import ConnectionPool


class OAuthStore:
    def __init__(self, database_url: str):
        self.pool = ConnectionPool(database_url, min_size=0, max_size=5, open=False)

    def open(self) -> None:
        self.pool.open(wait=True)

    def close(self) -> None:
        self.pool.close()

    def ready(self) -> bool:
        with self.pool.connection() as conn:
            conn.execute("SELECT 1 FROM oauth_attempts LIMIT 0")
            conn.execute("SELECT 1 FROM oauth_tickets LIMIT 0")
        return True

    def create_attempt(self, state_hash: bytes, code_verifier: str, proof_challenge: str) -> None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        with self.pool.connection() as conn:
            conn.execute("DELETE FROM oauth_attempts WHERE expires_at <= now()")
            conn.execute("DELETE FROM oauth_tickets WHERE expires_at <= now()")
            conn.execute(
                "INSERT INTO oauth_attempts (state_hash, code_verifier, proof_challenge, expires_at) VALUES (%s, %s, %s, %s)",
                (state_hash, code_verifier, proof_challenge, expires_at),
            )

    def take_attempt(self, state_hash: bytes) -> tuple[str, str] | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "DELETE FROM oauth_attempts WHERE state_hash = %s AND expires_at > now() RETURNING code_verifier, proof_challenge",
                (state_hash,),
            ).fetchone()
        return (row[0], row[1]) if row else None

    def create_ticket(self, ticket_hash: bytes, encrypted_token: bytes, proof_challenge: str) -> None:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO oauth_tickets (ticket_hash, encrypted_token, proof_challenge, expires_at) VALUES (%s, %s, %s, %s)",
                (ticket_hash, encrypted_token, proof_challenge, expires_at),
            )

    def take_ticket(self, ticket_hash: bytes, proof_challenge: str) -> bytes | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT encrypted_token, proof_challenge FROM oauth_tickets WHERE ticket_hash = %s AND expires_at > now() FOR UPDATE",
                (ticket_hash,),
            ).fetchone()
            if not row or not secrets.compare_digest(row[1], proof_challenge):
                return None
            conn.execute("DELETE FROM oauth_tickets WHERE ticket_hash = %s", (ticket_hash,))
        return bytes(row[0])
