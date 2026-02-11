
import hashlib
import os
import secrets
from typing import Optional
from .config import SENSITIVE_WORDS_FILE

def _load_sensitive_words() -> list[str]:
    words: list[str] = []
    if SENSITIVE_WORDS_FILE.exists():
        paths = []
        if SENSITIVE_WORDS_FILE.is_file():
            paths = [SENSITIVE_WORDS_FILE]
        elif SENSITIVE_WORDS_FILE.is_dir():
            paths = sorted([p for p in SENSITIVE_WORDS_FILE.rglob("*") if p.is_file()])

        for p in paths:
            for line in p.read_text(encoding="utf-8").splitlines():
                item = line.strip()
                if not item or item.startswith("#"):
                    continue
                words.append(item.lower())
    if not words:
        words = [
            w.strip().lower()
            for w in os.environ.get("SENSITIVE_WORDS", "spamword1,spamword2").split(",")
            if w.strip()
        ]
    return sorted(set(words))


SENSITIVE_WORDS = _load_sensitive_words()


def hash_password(password: str, salt_hex: Optional[str] = None) -> str:
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"{salt_hex}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    calc = hash_password(password, salt_hex=salt_hex)
    return secrets.compare_digest(calc.split("$", 1)[1], digest_hex)


def find_sensitive_hits(*texts: Optional[str]) -> list[str]:
    return []
