
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import (
    ADMIN_USERNAMES,
    PAGE_SIZE,
    REPORT_HIDE_THRESHOLD,
    PROTECTED_USERNAMES,
)

CREATE_POSTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    tag TEXT,
    sensitive_hits TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reports INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    approved_at TEXT
);
"""

CREATE_USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT,
    banned_at TEXT,
    created_at TEXT NOT NULL
);
"""

CREATE_SESSIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""

CREATE_REPORTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    reporter_user_id INTEGER,
    reporter_ip TEXT,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(reporter_user_id) REFERENCES users(id)
);
"""

CREATE_COMMENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""

CREATE_BROADCASTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id)
);
"""

CREATE_POST_VOTES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS post_votes (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""


class DB:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self._init()

    def _conn(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self):
        with self._conn() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(CREATE_POSTS_TABLE_SQL)
            conn.execute(CREATE_USERS_TABLE_SQL)
            conn.execute(CREATE_SESSIONS_TABLE_SQL)
            conn.execute(CREATE_REPORTS_TABLE_SQL)
            conn.execute(CREATE_COMMENTS_TABLE_SQL)
            conn.execute(CREATE_BROADCASTS_TABLE_SQL)
            conn.execute(CREATE_POST_VOTES_TABLE_SQL)
            user_cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
            if "is_admin" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
            if "is_banned" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0")
            if "ban_reason" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN ban_reason TEXT")
            if "banned_at" not in user_cols:
                conn.execute("ALTER TABLE users ADD COLUMN banned_at TEXT")
            cols = {r[1] for r in conn.execute("PRAGMA table_info(posts)").fetchall()}
            if "user_id" not in cols:
                conn.execute("ALTER TABLE posts ADD COLUMN user_id INTEGER")
            if "category" not in cols:
                conn.execute("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'general'")
            if "sensitive_hits" not in cols:
                conn.execute("ALTER TABLE posts ADD COLUMN sensitive_hits TEXT")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_post_id ON reports(post_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(reporter_user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_ip ON reports(reporter_ip)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_post_votes_post_id ON post_votes(post_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_post_votes_user_id ON post_votes(user_id)")
            try:
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique ON users(lower(username))")
            except sqlite3.IntegrityError:
                pass
            if ADMIN_USERNAMES:
                placeholders = ",".join(["?"] * len(ADMIN_USERNAMES))
                conn.execute(
                    f"UPDATE users SET is_admin = 1 WHERE lower(username) IN ({placeholders})",
                    tuple(sorted(ADMIN_USERNAMES)),
                )
            conn.commit()

    def add_post(
        self,
        content: str,
        category: str,
        tag: Optional[str],
        user_id: Optional[int],
        status: str = "pending",
        sensitive_hits: Optional[str] = None,
    ) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self.lock, self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO posts (user_id, category, content, tag, sensitive_hits, status, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, category, content, tag, sensitive_hits, status, now),
            )
            conn.commit()
            return int(cur.lastrowid)

    def list_posts(self, status: str, limit: int = PAGE_SIZE):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT p.id, p.category, p.content, p.tag, p.sensitive_hits, p.status, p.reports, p.created_at, p.approved_at, "
                "COALESCE(v.like_count, 0) AS like_count, COALESCE(v.dislike_count, 0) AS dislike_count, "
                "COALESCE(v.vote_score, 0) AS vote_score, "
                "COALESCE(u.username, 'anonymous') AS username "
                "FROM posts p "
                "LEFT JOIN users u ON p.user_id = u.id "
                "LEFT JOIN ("
                "  SELECT post_id, "
                "         SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS like_count, "
                "         SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS dislike_count, "
                "         SUM(value) AS vote_score "
                "  FROM post_votes GROUP BY post_id"
                ") v ON v.post_id = p.id "
                "WHERE p.status = ? ORDER BY p.id DESC LIMIT ?",
                (status, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def search_posts(self, q: str, limit: int = 50):
        q_like = f"%{q.lower()}%"
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT p.id, p.category, p.content, p.tag, p.status, p.reports, p.created_at, "
                "COALESCE(u.username, 'anonymous') AS username, "
                "COALESCE(cc.comment_count, 0) AS comment_count, "
                "COALESCE(v.like_count, 0) AS like_count, COALESCE(v.dislike_count, 0) AS dislike_count, "
                "COALESCE(v.vote_score, 0) AS vote_score "
                "FROM posts p "
                "LEFT JOIN users u ON p.user_id = u.id "
                "LEFT JOIN (SELECT post_id, COUNT(1) AS comment_count FROM comments GROUP BY post_id) cc ON cc.post_id = p.id "
                "LEFT JOIN ("
                "  SELECT post_id, "
                "         SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS like_count, "
                "         SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS dislike_count, "
                "         SUM(value) AS vote_score "
                "  FROM post_votes GROUP BY post_id"
                ") v ON v.post_id = p.id "
                "WHERE p.status = 'approved' AND ("
                "lower(COALESCE(p.content, '')) LIKE ? OR "
                "lower(COALESCE(p.tag, '')) LIKE ? OR "
                "lower(COALESCE(p.category, '')) LIKE ? OR "
                "lower(COALESCE(u.username, '')) LIKE ? OR "
                "EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND lower(COALESCE(c.content, '')) LIKE ?)"
                ") "
                "ORDER BY p.id DESC LIMIT ?",
                (q_like, q_like, q_like, q_like, q_like, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def hot_posts(self, limit: int = 20):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT p.id, p.category, p.content, p.tag, p.status, p.reports, p.created_at, "
                "COALESCE(u.username, 'anonymous') AS username, "
                "COALESCE(cc.comment_count, 0) AS comment_count, "
                "COALESCE(v.like_count, 0) AS like_count, COALESCE(v.dislike_count, 0) AS dislike_count, "
                "COALESCE(v.vote_score, 0) AS vote_score, "
                "(COALESCE(cc.comment_count, 0) * 3 + COALESCE(v.vote_score, 0) * 4 + COALESCE(p.reports, 0) * 2) AS hot_score "
                "FROM posts p "
                "LEFT JOIN users u ON p.user_id = u.id "
                "LEFT JOIN (SELECT post_id, COUNT(1) AS comment_count FROM comments GROUP BY post_id) cc ON cc.post_id = p.id "
                "LEFT JOIN ("
                "  SELECT post_id, "
                "         SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS like_count, "
                "         SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS dislike_count, "
                "         SUM(value) AS vote_score "
                "  FROM post_votes GROUP BY post_id"
                ") v ON v.post_id = p.id "
                "WHERE p.status = 'approved' "
                "ORDER BY hot_score DESC, p.id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def list_posts_by_tag(self, tag: str, limit: int = 100):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT p.id, p.category, p.content, p.tag, p.status, p.reports, p.created_at, "
                "COALESCE(u.username, 'anonymous') AS username, "
                "COALESCE(cc.comment_count, 0) AS comment_count, "
                "COALESCE(v.like_count, 0) AS like_count, COALESCE(v.dislike_count, 0) AS dislike_count, "
                "COALESCE(v.vote_score, 0) AS vote_score "
                "FROM posts p "
                "LEFT JOIN users u ON p.user_id = u.id "
                "LEFT JOIN (SELECT post_id, COUNT(1) AS comment_count FROM comments GROUP BY post_id) cc ON cc.post_id = p.id "
                "LEFT JOIN ("
                "  SELECT post_id, "
                "         SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS like_count, "
                "         SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS dislike_count, "
                "         SUM(value) AS vote_score "
                "  FROM post_votes GROUP BY post_id"
                ") v ON v.post_id = p.id "
                "WHERE p.status = 'approved' AND lower(COALESCE(p.tag, '')) = ? "
                "ORDER BY p.id DESC LIMIT ?",
                (tag.lower(), limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def is_post_approved(self, post_id: int) -> bool:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM posts WHERE id = ? AND status = 'approved' LIMIT 1",
                (post_id,),
            ).fetchone()
            return row is not None

    def list_comments(self, post_id: int, limit: int = 100):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT c.id, c.post_id, c.content, c.created_at, COALESCE(u.username, 'anonymous') AS username "
                "FROM comments c LEFT JOIN users u ON c.user_id = u.id "
                "WHERE c.post_id = ? ORDER BY c.id ASC LIMIT ?",
                (post_id, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def add_comment(self, post_id: int, user_id: int, content: str) -> tuple[bool, int]:
        now = datetime.now(timezone.utc).isoformat()
        with self.lock, self._conn() as conn:
            post = conn.execute(
                "SELECT id FROM posts WHERE id = ? AND status = 'approved'",
                (post_id,),
            ).fetchone()
            if not post:
                return False, 0
            cur = conn.execute(
                "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
                (post_id, user_id, content, now),
            )
            conn.commit()
            return True, int(cur.lastrowid)

    def report_post(
        self,
        post_id: int,
        reporter_user_id: Optional[int],
        reporter_ip: str,
        reason: Optional[str],
    ) -> tuple[bool, bool, bool, Optional[int]]:
        with self.lock, self._conn() as conn:
            post = conn.execute(
                "SELECT id, status, user_id FROM posts WHERE id = ?",
                (post_id,),
            ).fetchone()
            if not post or post["status"] != "approved":
                return False, False, False, None

            if reporter_user_id is not None:
                exists = conn.execute(
                    "SELECT 1 FROM reports WHERE post_id = ? AND reporter_user_id = ? LIMIT 1",
                    (post_id, reporter_user_id),
                ).fetchone()
            else:
                exists = conn.execute(
                    "SELECT 1 FROM reports WHERE post_id = ? AND reporter_ip = ? LIMIT 1",
                    (post_id, reporter_ip),
                ).fetchone()
            if exists:
                return True, True, False, None

            conn.execute(
                "INSERT INTO reports (post_id, reporter_user_id, reporter_ip, reason, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (post_id, reporter_user_id, reporter_ip, reason, datetime.now(timezone.utc).isoformat()),
            )
            count_row = conn.execute(
                "SELECT COUNT(1) AS c FROM reports WHERE post_id = ?",
                (post_id,),
            ).fetchone()
            count = int(count_row["c"]) if count_row else 0
            conn.execute("UPDATE posts SET reports = ? WHERE id = ?", (count, post_id))
            auto_hidden = False
            if count >= REPORT_HIDE_THRESHOLD:
                hidden_cur = conn.execute(
                    "UPDATE posts SET status='hidden' WHERE id = ? AND status = 'approved'",
                    (post_id,),
                )
                auto_hidden = hidden_cur.rowcount > 0
            conn.commit()
            return True, False, auto_hidden, (int(post["user_id"]) if post["user_id"] is not None else None)

    def list_reports(self, limit: int = 100):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT r.id, r.post_id, r.reason, r.reporter_ip, r.created_at, "
                "COALESCE(u.username, 'anonymous') AS reporter_username, "
                "p.status AS post_status, p.reports AS total_reports, substr(p.content, 1, 120) AS post_preview "
                "FROM reports r "
                "LEFT JOIN users u ON r.reporter_user_id = u.id "
                "LEFT JOIN posts p ON r.post_id = p.id "
                "ORDER BY r.id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def moderate(self, post_id: int, action: str) -> tuple[bool, Optional[int]]:
        with self.lock, self._conn() as conn:
            owner = conn.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,)).fetchone()
            owner_id = int(owner["user_id"]) if owner and owner["user_id"] is not None else None
            if action == "approve":
                cur = conn.execute(
                    "UPDATE posts SET status='approved', approved_at=? WHERE id=?",
                    (datetime.now(timezone.utc).isoformat(), post_id),
                )
            elif action == "hide":
                cur = conn.execute("UPDATE posts SET status='hidden' WHERE id=?", (post_id,))
            elif action == "delete":
                cur = conn.execute("DELETE FROM posts WHERE id=?", (post_id,))
            else:
                return False, owner_id
            conn.commit()
            return cur.rowcount > 0, owner_id

    def create_user(self, username: str, password_hash: str) -> Optional[dict]:
        now = datetime.now(timezone.utc).isoformat()
        is_admin = 1 if username.lower() in ADMIN_USERNAMES else 0
        with self.lock, self._conn() as conn:
            exists = conn.execute(
                "SELECT 1 FROM users WHERE lower(username) = lower(?) LIMIT 1",
                (username,),
            ).fetchone()
            if exists:
                return None
            try:
                cur = conn.execute(
                    "INSERT INTO users (username, password_hash, is_admin, is_banned, created_at) VALUES (?, ?, ?, 0, ?)",
                    (username, password_hash, is_admin, now),
                )
                conn.commit()
                user_id = int(cur.lastrowid)
                return {"id": user_id, "username": username, "is_admin": bool(is_admin), "is_banned": False}
            except sqlite3.IntegrityError:
                return None

    def get_user_by_username(self, username: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT id, username, password_hash, is_admin, is_banned, ban_reason, banned_at "
                "FROM users WHERE lower(username) = lower(?) LIMIT 1",
                (username,),
            ).fetchone()
            return dict(row) if row else None

    def create_session(self, token: str, user_id: int, expires_at: int):
        now = datetime.now(timezone.utc).isoformat()
        with self.lock, self._conn() as conn:
            conn.execute(
                "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (token, user_id, expires_at, now),
            )
            conn.commit()

    def get_user_by_session(self, token: str) -> Optional[dict]:
        now_ts = int(time.time())
        with self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now_ts,))
            row = conn.execute(
                "SELECT u.id, u.username, u.is_admin, u.is_banned, u.ban_reason, u.banned_at, u.created_at "
                "FROM sessions s JOIN users u ON s.user_id = u.id "
                "WHERE s.token = ? AND s.expires_at > ?",
                (token, now_ts),
            ).fetchone()
            conn.commit()
            return dict(row) if row else None

    def ban_user(self, user_id: int, reason: str):
        if self.is_protected_user(user_id):
            return
        with self.lock, self._conn() as conn:
            conn.execute(
                "UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = ? WHERE id = ?",
                (reason, datetime.now(timezone.utc).isoformat(), user_id),
            )
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            conn.commit()

    def is_protected_user(self, user_id: int) -> bool:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT lower(username) AS uname FROM users WHERE id = ? LIMIT 1",
                (user_id,),
            ).fetchone()
            if not row:
                return False
            return (row["uname"] or "") in PROTECTED_USERNAMES

    def vote_post(self, post_id: int, user_id: int, value: int) -> tuple[bool, bool]:
        if value not in (-1, 1):
            return False, False
        now = datetime.now(timezone.utc).isoformat()
        with self.lock, self._conn() as conn:
            post = conn.execute("SELECT id FROM posts WHERE id = ? AND status = 'approved'", (post_id,)).fetchone()
            if not post:
                return False, False
            conn.execute(
                "INSERT INTO post_votes (post_id, user_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(post_id, user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                (post_id, user_id, value, now, now),
            )
            conn.commit()
            return True, True

    def list_broadcasts(self, limit: int = 100):
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT b.id, b.title, b.content, b.created_at, COALESCE(u.username, 'system') AS author "
                "FROM broadcasts b LEFT JOIN users u ON b.created_by = u.id "
                "ORDER BY b.id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def add_broadcast(self, title: str, content: str, created_by: Optional[int]) -> int:
        with self.lock, self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO broadcasts (title, content, created_by, created_at) VALUES (?, ?, ?, ?)",
                (title, content, created_by, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
            return int(cur.lastrowid)

    def delete_session(self, token: str):
        with self.lock, self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
