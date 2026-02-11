
import os
from pathlib import Path

# Adjust ROOT to point to the repository root (parent of this package)
ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "treehole.db"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")
POST_COOLDOWN_SECONDS = 15
MAX_CONTENT_LEN = 500
MAX_COMMENT_LEN = 200
PAGE_SIZE = 20
SESSION_DAYS = 7
REQUIRE_LOGIN_TO_POST = True
ALLOWED_CATEGORIES = {"general", "study", "emotion", "career", "life", "other"}
REPORT_HIDE_THRESHOLD = 5
SUPER_ADMIN_USERNAME = "signupbook"
AUTO_BAN_ON_SENSITIVE = True
PROTECTED_USERNAMES = {SUPER_ADMIN_USERNAME.lower()}
ADMIN_USERNAMES = {
    u.strip().lower()
    for u in os.environ.get("ADMIN_USERNAMES", "").split(",")
    if u.strip()
}
SENSITIVE_WORDS_FILE = Path(os.environ.get("SENSITIVE_WORDS_FILE", str(ROOT / "sensitive_words.txt")))
