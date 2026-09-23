import base64
import hashlib
import re
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


CHALLENGE_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}\Z")
VERIFIER_PATTERN = re.compile(r"[A-Za-z0-9._~-]{43,128}\Z")
TICKET_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}\Z")


def random_urlsafe() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> bytes:
    return hashlib.sha256(value.encode("ascii")).digest()


def challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(digest(verifier)).rstrip(b"=").decode("ascii")


def encrypt_token(key: bytes, ticket_hash: bytes, token: str) -> bytes:
    nonce = secrets.token_bytes(12)
    return nonce + AESGCM(key).encrypt(nonce, token.encode("utf-8"), ticket_hash)


def decrypt_token(key: bytes, ticket_hash: bytes, ciphertext: bytes) -> str:
    return AESGCM(key).decrypt(ciphertext[:12], ciphertext[12:], ticket_hash).decode("utf-8")
