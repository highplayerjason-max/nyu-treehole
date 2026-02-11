
import json
import re
import secrets
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from nyu_treehole.config import (
    ADMIN_TOKEN,
    ALLOWED_CATEGORIES,
    AUTO_BAN_ON_SENSITIVE,
    DB_PATH,
    HOST,
    MAX_COMMENT_LEN,
    MAX_CONTENT_LEN,
    PORT,
    POST_COOLDOWN_SECONDS,
    REQUIRE_LOGIN_TO_POST,
    SESSION_DAYS,
    SUPER_ADMIN_USERNAME,
)
from nyu_treehole.database import DB
from nyu_treehole.templates import BROADCAST_HTML, INDEX_HTML
from nyu_treehole.utils import (
    find_sensitive_hits,
    hash_password,
    verify_password,
)


class TreeholeHandler(BaseHTTPRequestHandler):
    db = DB(DB_PATH)
    post_limit = {}

    def _json(self, code: int, payload: dict, set_cookie: str = None):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(raw)

    def _html(self, code: int, content: str):
        raw = content.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _render_index(self, mode: str) -> str:
        return INDEX_HTML.replace("__PAGE_MODE__", mode)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _client_ip(self):
        forwarded = self.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0]

    def _is_admin(self):
        user = self._current_user()
        return bool(user and user.get("username", "").lower() == SUPER_ADMIN_USERNAME.lower())

    def _is_broadcast_host(self) -> bool:
        host = self.headers.get("Host", "").split(":")[0].lower()
        return host.startswith("broadcast.")

    def _is_banned_user(self, user: dict) -> bool:
        return bool(user and int(user.get("is_banned", 0)) == 1)

    def _unauthorized(self):
        self._json(HTTPStatus.UNAUTHORIZED, {"error": "admin token invalid"})

    def _cookie_dict(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        return cookie

    def _session_token(self):
        cookie = self._cookie_dict()
        morsel = cookie.get("session_token")
        return morsel.value if morsel else None

    def _current_user(self):
        token = self._session_token()
        if not token:
            return None
        return self.db.get_user_by_session(token)

    def _build_session_cookie(self, token: str, max_age: int) -> str:
        return f"session_token={token}; Max-Age={max_age}; Path=/; HttpOnly; SameSite=Lax"

    def _clear_session_cookie(self) -> str:
        return "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(INDEX_HTML.encode("utf-8"))))
            self.end_headers()
            return
        if parsed.path == "/api/posts":
            payload = json.dumps({"posts": []}).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            return
        self.send_response(HTTPStatus.NOT_FOUND)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            self._html(HTTPStatus.OK, BROADCAST_HTML if self._is_broadcast_host() else self._render_index("latest"))
            return

        if parsed.path == "/latest":
            self._html(HTTPStatus.OK, self._render_index("latest"))
            return
        if parsed.path == "/hot":
            self._html(HTTPStatus.OK, self._render_index("hot"))
            return
        if parsed.path == "/search":
            self._html(HTTPStatus.OK, self._render_index("search"))
            return
        if parsed.path == "/topic":
            self._html(HTTPStatus.OK, self._render_index("topic"))
            return

        if parsed.path == "/api/posts":
            posts = self.db.list_posts(status="approved")
            self._json(HTTPStatus.OK, {"posts": posts})
            return

        if parsed.path == "/api/search":
            q = (parse_qs(parsed.query).get("q", [""])[0] or "").strip()
            if not q:
                self._json(HTTPStatus.OK, {"posts": []})
                return
            self._json(HTTPStatus.OK, {"posts": self.db.search_posts(q=q)})
            return

        if parsed.path == "/api/hot":
            self._json(HTTPStatus.OK, {"posts": self.db.hot_posts()})
            return
        if parsed.path == "/api/topics":
            tag = (parse_qs(parsed.query).get("tag", [""])[0] or "").strip().lower()
            if not tag:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "tag required"})
                return
            self._json(HTTPStatus.OK, {"tag": tag, "posts": self.db.list_posts_by_tag(tag=tag)})
            return

        if parsed.path == "/broadcast":
            self._html(HTTPStatus.OK, BROADCAST_HTML)
            return

        if parsed.path == "/api/broadcasts":
            self._json(HTTPStatus.OK, {"broadcasts": self.db.list_broadcasts()})
            return

        if parsed.path.startswith("/api/posts/") and parsed.path.endswith("/comments"):
            chunks = parsed.path.split("/")
            if len(chunks) != 5:
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                post_id = int(chunks[3])
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid post id"})
                return
            if not self.db.is_post_approved(post_id):
                self._json(HTTPStatus.NOT_FOUND, {"error": "post not found or not approved"})
                return
            comments = self.db.list_comments(post_id=post_id)
            self._json(HTTPStatus.OK, {"comments": comments})
            return

        if parsed.path == "/api/auth/me":
            user = self._current_user()
            if not user:
                self._json(HTTPStatus.OK, {"logged_in": False})
            else:
                self._json(
                    HTTPStatus.OK,
                    {
                        "logged_in": True,
                        "user": {
                            "id": user["id"],
                            "username": user["username"],
                            "is_admin": bool(int(user.get("is_admin", 0))),
                            "is_banned": bool(int(user.get("is_banned", 0))),
                            "ban_reason": user.get("ban_reason"),
                        },
                    },
                )
            return

        if parsed.path == "/api/admin/posts":
            if not self._is_admin():
                self._unauthorized()
                return
            status = parse_qs(parsed.query).get("status", ["pending"])[0]
            if status not in {"pending", "approved", "hidden", "flagged"}:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid status"})
                return
            posts = self.db.list_posts(status=status)
            self._json(HTTPStatus.OK, {"posts": posts})
            return

        if parsed.path == "/api/admin/reports":
            if not self._is_admin():
                self._unauthorized()
                return
            reports = self.db.list_reports()
            self._json(HTTPStatus.OK, {"reports": reports})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/auth/register":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            username = (data.get("username") or "").strip()
            password = data.get("password") or ""
            if not re.fullmatch(r"[A-Za-z0-9_]{3,24}", username):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "username must be 3-24 chars: letters, numbers, underscore"})
                return
            if len(password) < 8:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "password must be at least 8 chars"})
                return
            created = self.db.create_user(username=username, password_hash=hash_password(password))
            if not created:
                self._json(HTTPStatus.CONFLICT, {"error": "username already exists"})
                return
            self._json(HTTPStatus.CREATED, {"ok": True, "user": created})
            return

        if parsed.path == "/api/auth/login":
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            username = (data.get("username") or "").strip()
            password = data.get("password") or ""
            user = self.db.get_user_by_username(username)
            if not user or not verify_password(password, user["password_hash"]):
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "invalid username or password"})
                return
            if int(user.get("is_banned", 0)) == 1:
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return
            token = secrets.token_urlsafe(32)
            max_age = SESSION_DAYS * 24 * 3600
            expires_at = int(time.time()) + max_age
            self.db.create_session(token=token, user_id=int(user["id"]), expires_at=expires_at)
            cookie = self._build_session_cookie(token, max_age)
            self._json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "is_admin": bool(int(user.get("is_admin", 0))),
                        "is_banned": bool(int(user.get("is_banned", 0))),
                    },
                },
                set_cookie=cookie,
            )
            return

        if parsed.path == "/api/auth/logout":
            token = self._session_token()
            if token:
                self.db.delete_session(token)
            self._json(HTTPStatus.OK, {"ok": True}, set_cookie=self._clear_session_cookie())
            return

        if parsed.path == "/api/posts":
            user = self._current_user()
            if REQUIRE_LOGIN_TO_POST and not user:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "login required"})
                return
            if self._is_banned_user(user):
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return

            ip = self._client_ip()
            now = time.time()
            last = self.post_limit.get(ip, 0)
            if now - last < POST_COOLDOWN_SECONDS:
                wait = int(POST_COOLDOWN_SECONDS - (now - last)) + 1
                self._json(HTTPStatus.TOO_MANY_REQUESTS, {"error": f"posting too fast, retry in {wait}s"})
                return

            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return

            content = (data.get("content") or "").strip()
            category = (data.get("category") or "general").strip().lower()
            tag = (data.get("tag") or "").strip()
            tag = tag[:30] if tag else None

            if not content:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "content required"})
                return
            if len(content) > MAX_CONTENT_LEN:
                self._json(HTTPStatus.BAD_REQUEST, {"error": f"content too long (max {MAX_CONTENT_LEN})"})
                return
            if category not in ALLOWED_CATEGORIES:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid category"})
                return

            sensitive_hits = find_sensitive_hits(content, tag)
            if sensitive_hits and AUTO_BAN_ON_SENSITIVE and user:
                reason = f"sensitive content: {', '.join(sensitive_hits[:10])}"
                self.db.ban_user(int(user["id"]), reason=reason)
                self._json(
                    HTTPStatus.FORBIDDEN,
                    {
                        "error": "post blocked due to sensitive content; account banned",
                        "flagged": True,
                        "sensitive_hits": sensitive_hits,
                    },
                    set_cookie=self._clear_session_cookie(),
                )
                return
            review_status = "flagged" if sensitive_hits else "pending"
            post_id = self.db.add_post(
                content=content,
                category=category,
                tag=tag,
                user_id=(int(user["id"]) if user else None),
                status=review_status,
                sensitive_hits=",".join(sensitive_hits) if sensitive_hits else None,
            )
            self.post_limit[ip] = now
            self._json(
                HTTPStatus.CREATED,
                {
                    "ok": True,
                    "id": post_id,
                    "status": review_status,
                    "flagged": bool(sensitive_hits),
                    "sensitive_hits": sensitive_hits,
                },
            )
            return

        if parsed.path.startswith("/api/posts/") and parsed.path.endswith("/comments"):
            user = self._current_user()
            if not user:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "login required"})
                return
            if self._is_banned_user(user):
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return
            chunks = parsed.path.split("/")
            if len(chunks) != 5:
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                post_id = int(chunks[3])
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid post id"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            content = (data.get("content") or "").strip()
            if not content:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "comment required"})
                return
            if len(content) > MAX_COMMENT_LEN:
                self._json(HTTPStatus.BAD_REQUEST, {"error": f"comment too long (max {MAX_COMMENT_LEN})"})
                return
            ok, comment_id = self.db.add_comment(post_id=post_id, user_id=int(user["id"]), content=content)
            if not ok:
                self._json(HTTPStatus.NOT_FOUND, {"error": "post not found or not approved"})
                return
            self._json(HTTPStatus.CREATED, {"ok": True, "id": comment_id})
            return

        if parsed.path.startswith("/api/posts/") and parsed.path.endswith("/vote"):
            user = self._current_user()
            if not user:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "login required"})
                return
            if self._is_banned_user(user):
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return
            chunks = parsed.path.split("/")
            if len(chunks) != 5:
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                post_id = int(chunks[3])
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid post id"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            vote_value = int(data.get("value") or 0)
            ok, updated = self.db.vote_post(post_id=post_id, user_id=int(user["id"]), value=vote_value)
            if not ok:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid vote or post not approved"})
                return
            self._json(HTTPStatus.OK, {"ok": True, "updated": updated})
            return

        if parsed.path == "/api/admin/broadcasts":
            if not self._is_admin():
                self._unauthorized()
                return
            user = self._current_user()
            if self._is_banned_user(user):
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            title = (data.get("title") or "").strip()
            content = (data.get("content") or "").strip()
            if not title or not content:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "title and content required"})
                return
            user = self._current_user()
            bid = self.db.add_broadcast(
                title=title[:120],
                content=content[:4000],
                created_by=(int(user["id"]) if user else None),
            )
            self._json(HTTPStatus.CREATED, {"ok": True, "id": bid})
            return

        if parsed.path.startswith("/api/posts/") and parsed.path.endswith("/report"):
            chunks = parsed.path.split("/")
            if len(chunks) != 5:
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                post_id = int(chunks[3])
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid post id"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            reason = (data.get("reason") or "").strip()[:120]
            reason = reason if reason else None
            user = self._current_user()
            if user and self._is_banned_user(user):
                self._json(HTTPStatus.FORBIDDEN, {"error": f"account banned: {user.get('ban_reason') or 'policy violation'}"})
                return
            ip = self._client_ip()
            ok, duplicate, auto_hidden, target_user_id = self.db.report_post(
                post_id=post_id,
                reporter_user_id=(int(user["id"]) if user else None),
                reporter_ip=ip,
                reason=reason,
            )
            if duplicate:
                self._json(HTTPStatus.CONFLICT, {"error": "already reported"})
                return
            if not ok:
                self._json(HTTPStatus.NOT_FOUND, {"error": "post not found or not approved"})
                return
            if target_user_id:
                self.db.ban_user(
                    user_id=target_user_id,
                    reason=f"reported post #{post_id}",
                )
            self._json(HTTPStatus.OK, {"ok": True, "auto_hidden": auto_hidden})
            return

        if parsed.path.startswith("/api/admin/posts/") and parsed.path.endswith("/moderate"):
            if not self._is_admin():
                self._unauthorized()
                return
            chunks = parsed.path.split("/")
            if len(chunks) != 6:
                self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                return
            try:
                post_id = int(chunks[4])
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid post id"})
                return
            try:
                data = self._read_json()
            except json.JSONDecodeError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
                return
            action = (data.get("action") or "").strip()
            ok, owner_id = self.db.moderate(post_id=post_id, action=action)
            if not ok:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid action or post not found"})
                return
            if action == "delete" and owner_id:
                self.db.ban_user(user_id=owner_id, reason=f"post deleted by admin #{post_id}")
            self._json(HTTPStatus.OK, {"ok": True})
            return

        self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def log_message(self, fmt, *args):
        return


def main():
    server = ThreadingHTTPServer((HOST, PORT), TreeholeHandler)
    print(f"Treehole running at http://{HOST}:{PORT} | ADMIN_TOKEN={ADMIN_TOKEN}")
    server.serve_forever()


if __name__ == "__main__":
    main()
