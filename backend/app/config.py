import base64
import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse


EXTENSION_REDIRECT_PATTERN = re.compile(r"https://[a-p]{32}\.chromiumapp\.org/github\Z")


def decode_key(value: str) -> bytes:
    try:
        key = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError("TOKEN_ENCRYPTION_KEY must be base64url encoded") from exc
    if len(key) != 32:
        raise ValueError("TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes")
    return key


@dataclass(frozen=True)
class Settings:
    database_url: str
    github_client_id: str
    github_client_secret: str
    public_base_url: str
    extension_redirect_uri: str
    token_encryption_key: bytes
    git_sha: str = "unknown"

    def __post_init__(self) -> None:
        base = urlparse(self.public_base_url)
        if base.scheme != "https" or not base.netloc or base.path not in ("", "/") or base.query or base.fragment:
            raise ValueError("PUBLIC_BASE_URL must be an HTTPS origin")
        if not EXTENSION_REDIRECT_PATTERN.fullmatch(self.extension_redirect_uri):
            raise ValueError("EXTENSION_REDIRECT_URI must be the exact Chrome identity redirect URL ending in /github")
        if len(self.token_encryption_key) != 32:
            raise ValueError("TOKEN_ENCRYPTION_KEY must contain 32 bytes")
        if not self.database_url or not self.github_client_id or not self.github_client_secret:
            raise ValueError("DATABASE_URL and GitHub OAuth credentials are required")

    @classmethod
    def from_env(cls) -> "Settings":
        required = ["DATABASE_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "PUBLIC_BASE_URL", "EXTENSION_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"]
        missing = [name for name in required if not os.getenv(name)]
        if missing:
            raise ValueError(f"Missing configuration: {', '.join(missing)}")
        return cls(
            database_url=os.environ["DATABASE_URL"],
            github_client_id=os.environ["GITHUB_CLIENT_ID"],
            github_client_secret=os.environ["GITHUB_CLIENT_SECRET"],
            public_base_url=os.environ["PUBLIC_BASE_URL"].rstrip("/"),
            extension_redirect_uri=os.environ["EXTENSION_REDIRECT_URI"],
            token_encryption_key=decode_key(os.environ["TOKEN_ENCRYPTION_KEY"]),
            git_sha=os.getenv("RAILWAY_GIT_COMMIT_SHA", os.getenv("GIT_SHA", "unknown")),
        )
