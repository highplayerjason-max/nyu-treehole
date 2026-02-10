import hashlib
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
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

INDEX_HTML = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NYU Treehole</title>
  <style>
    :root {
      --bg: #f5f1fb;
      --card: #ffffff;
      --ink: #231942;
      --muted: #6f668a;
      --accent: #57068c;
      --accent-2: #7c3aed;
      --warn: #b42318;
      --line: #ddd3f1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", "PingFang SC", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 18%, rgba(87,6,140,0.22) 0, rgba(87,6,140,0) 42%),
        radial-gradient(circle at 85% 12%, rgba(124,58,237,0.16) 0, rgba(124,58,237,0) 40%),
        var(--bg);
      min-height: 100vh;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 28px 16px 42px; }
    .title {
      font-size: clamp(30px, 5vw, 48px);
      letter-spacing: 2px;
      margin: 8px 0 4px;
      text-align: center;
      font-weight: 800;
      font-style: italic;
    }
    .sub { text-align: center; color: var(--muted); margin-bottom: 18px; }
    .grid { display: grid; gap: 14px; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 10px 26px rgba(87,6,140,0.08);
    }
    textarea {
      width: 100%;
      min-height: 110px;
      resize: vertical;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      font: inherit;
      background: #fff;
    }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
    input[type="text"], input[type="password"], select {
      flex: 1;
      min-width: 180px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      font: inherit;
      background: #fff;
    }
    button {
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      font: inherit;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #fff;
    }
    button.secondary { background: #3f2a63; }
    button.nav-active {
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 0 0 2px rgba(87, 6, 140, 0.18) inset;
    }
    button.warn { background: var(--warn); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .meta { color: var(--muted); font-size: 13px; }
    .post { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: #fff; }
    .post + .post { margin-top: 10px; }
    .post .content { white-space: pre-wrap; line-height: 1.6; margin: 10px 0; }
    .post .actions { display: flex; gap: 8px; }
    .comments { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
    .comment { margin-top: 8px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .comment-box { width: 100%; min-height: 64px; margin-top: 8px; }
    .hint { color: var(--muted); font-size: 13px; }
    .admin { margin-top: 18px; }
    .status { margin-top: 8px; min-height: 20px; }
    .hidden { display: none; }
    .auth-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--muted);
      font-size: 12px;
      background: #fff;
    }
    .tag-link { color: var(--accent); text-decoration: none; font-weight: 600; }
    .tag-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="row" style="justify-content: center; margin-top: 0;">
      <a href="/latest"><button id="navLatestBtn" class="secondary">Latest</button></a>
      <a href="/hot"><button id="navHotBtn" class="secondary">Hot</button></a>
      <a href="/search"><button id="navSearchBtn" class="secondary">Search</button></a>
      <a href="/topic"><button id="navTopicBtn" class="secondary">Topic</button></a>
      <a href="/broadcast"><button id="navBroadcastBtn" class="secondary">Broadcast</button></a>
    </div>
    <h1 class="title" data-i18n="title">Never Gonna Give You Up Treehole</h1>
    <p class="sub" data-i18n="subtitle">Anonymous feed, account login enabled, moderation-first.</p>
    <div class="row" style="justify-content: center; margin-top: 0;">
      <span class="meta" data-i18n="language_label">Language</span>
      <button id="langEnBtn" class="secondary">English</button>
      <button id="langZhBtn" class="secondary">中文</button>
    </div>

    <section id="authSection" class="card">
      <div class="row" style="margin-top: 0;">
        <strong data-i18n="account_title">Account</strong>
        <input id="username" type="text" maxlength="24" data-i18n-placeholder="username_placeholder" placeholder="Username (3-24 chars)" />
        <input id="password" type="password" maxlength="72" data-i18n-placeholder="password_placeholder" placeholder="Password (>=8 chars)" />
      </div>
      <div class="row">
        <button id="registerBtn" class="secondary" data-i18n="register_btn">Register</button>
        <button id="loginBtn" data-i18n="login_btn">Login</button>
        <button id="logoutBtn" class="warn" data-i18n="logout_btn">Logout</button>
      </div>
      <div class="auth-meta">
        <span class="pill" id="authState"></span>
        <span class="meta" data-i18n="auth_hint">Posting currently requires login.</span>
      </div>
      <div id="authStatus" class="status meta"></div>
    </section>

    <section id="composeSection" class="card">
      <textarea id="content" maxlength="500" data-i18n-placeholder="content_placeholder" placeholder="Write your message... (max 500 chars)"></textarea>
      <div class="row">
        <select id="category">
          <option value="general">General</option>
          <option value="study">Study</option>
          <option value="emotion">Emotion</option>
          <option value="career">Career</option>
          <option value="life">Life</option>
          <option value="other">Other</option>
        </select>
        <input id="tag" type="text" maxlength="30" data-i18n-placeholder="tag_placeholder" placeholder="Optional tag, e.g. study / rant / life" />
        <button id="submitBtn" data-i18n="submit_btn">Post Anonymously</button>
      </div>
      <div class="hint" data-i18n="post_hint">New posts go to moderation queue before they appear in public feed.</div>
      <div id="submitStatus" class="status meta"></div>
    </section>

    <section id="searchSection" class="card">
      <div class="row" style="margin-top: 0;">
        <strong data-i18n="search_title">Search</strong>
        <input id="searchQuery" type="text" data-i18n-placeholder="search_placeholder" placeholder="Search by username / tag / category / content / comments" />
        <button id="searchBtn" class="secondary" data-i18n="search_btn">Search</button>
      </div>
      <div id="searchResults" style="margin-top: 10px;"></div>
    </section>

    <section id="hotSection" class="card">
      <div class="row" style="justify-content: space-between; margin-top: 0;">
        <strong data-i18n="hot_title">Hot Ranking</strong>
        <button id="loadHotBtn" class="secondary" data-i18n="load_hot_btn">Load Hot</button>
      </div>
      <div id="hotList" style="margin-top: 10px;"></div>
    </section>

    <section id="latestSection" class="card">
      <div class="row" style="justify-content: space-between; margin-top: 0;">
        <strong data-i18n="feed_title">Latest Feed</strong>
        <button id="refreshBtn" class="secondary" data-i18n="refresh_btn">Refresh</button>
      </div>
      <div id="feed" class="grid" style="margin-top: 10px;"></div>
      <div id="feedStatus" class="meta" style="margin-top: 8px;"></div>
    </section>

    <section id="topicSection" class="card hidden">
      <div class="row" style="margin-top: 0;">
        <strong data-i18n="topic_title">Topic</strong>
        <input id="topicTag" type="text" maxlength="30" data-i18n-placeholder="topic_placeholder" placeholder="Tag, e.g. study" />
        <button id="loadTopicBtn" class="secondary" data-i18n="load_topic_btn">Load Topic</button>
      </div>
      <div id="topicList" style="margin-top: 10px;"></div>
    </section>

    <section id="adminPanel" class="card admin hidden">
      <div class="row" style="margin-top: 0;">
        <strong data-i18n="admin_title">Admin Moderation</strong>
        <input id="adminToken" type="text" data-i18n-placeholder="admin_token_placeholder" placeholder="Enter ADMIN_TOKEN" />
        <button id="loadPendingBtn" class="secondary" data-i18n="load_pending_btn">Load Pending</button>
        <button id="loadFlaggedBtn" class="secondary" data-i18n="load_flagged_btn">Load Flagged</button>
        <button id="loadReportsBtn" class="secondary" data-i18n="load_reports_btn">Load Reports</button>
      </div>
      <div id="pending" style="margin-top: 10px;"></div>
      <div class="meta" data-i18n="reports_title" style="margin-top: 10px;">Report Records</div>
      <div id="reports" style="margin-top: 6px;"></div>
      <div id="adminStatus" class="status meta"></div>
    </section>
  </div>

  <script>
    window.__PAGE_MODE__ = "__PAGE_MODE__";
    const feed = document.getElementById('feed');
    const feedStatus = document.getElementById('feedStatus');
    const searchResults = document.getElementById('searchResults');
    const hotList = document.getElementById('hotList');
    const submitStatus = document.getElementById('submitStatus');
    const adminStatus = document.getElementById('adminStatus');
    const authStatus = document.getElementById('authStatus');
    const authState = document.getElementById('authState');
    let currentLang = localStorage.getItem('treehole_lang') || 'en';
    let currentUser = null;

    const I18N = {
      en: {
        page_title: 'NYU Treehole',
        title: 'Never Gonna Give You Up Treehole',
        subtitle: 'This is weird, but you are welcome.',
        language_label: 'Language',
        account_title: 'Account',
        username_placeholder: 'Username (3-24 chars)',
        password_placeholder: 'Password (>=8 chars)',
        register_btn: 'Register',
        login_btn: 'Login',
        logout_btn: 'Logout',
        auth_hint: 'Posting currently requires login.',
        content_placeholder: 'Write your message... (max 500 chars)',
        tag_placeholder: 'Optional tag, e.g. study / rant / life',
        submit_btn: 'Post Anonymously',
        post_hint: 'New posts go to moderation queue before they appear in public feed.',
        search_title: 'Search',
        search_placeholder: 'Search by username / tag / category / content / comments',
        search_btn: 'Search',
        topic_title: 'Topic',
        topic_placeholder: 'Tag, e.g. study',
        load_topic_btn: 'Load Topic',
        hot_title: 'Hot Ranking',
        load_hot_btn: 'Load Hot',
        no_search_results: 'No matched posts.',
        no_hot_posts: 'No hot posts yet.',
        comments_count_label: 'comments',
        hot_score_label: 'score',
        feed_title: 'Latest Feed',
        refresh_btn: 'Refresh',
        admin_title: 'Admin Moderation',
        admin_token_placeholder: 'Enter ADMIN_TOKEN',
        load_pending_btn: 'Load Pending',
        load_flagged_btn: 'Load Flagged',
        load_reports_btn: 'Load Reports',
        reports_title: 'Report Records',
        no_reports: 'No report records.',
        no_tag: 'no-tag',
        post_prefix: 'Post',
        pending_prefix: 'Pending',
        flagged_prefix: 'Flagged',
        by_prefix: 'by',
        category_prefix: 'Category',
        sensitive_prefix: 'Sensitive',
        report_btn: 'Report',
        upvote_btn: 'Upvote',
        downvote_btn: 'Downvote',
        load_comments_btn: 'Load Comments',
        comment_btn: 'Comment',
        comment_prompt: 'Write a comment (max 200 chars)',
        comments_title: 'Comments',
        comment_placeholder: 'Write a comment (max 200 chars)',
        no_comments: 'No comments yet.',
        comment_required: 'Comment content is required',
        comment_failed: 'Comment failed',
        commented: 'Comment posted',
        report_prompt: 'Optional report reason (max 120 chars)',
        report_failed: 'Report failed',
        report_duplicate: 'You already reported this post',
        report_hidden: 'Post hidden after reaching report threshold',
        approve_btn: 'Approve',
        hide_btn: 'Hide',
        delete_btn: 'Delete',
        not_logged_in: 'Not logged in',
        logged_in_as: 'Logged in',
        registering: 'Registering...',
        register_failed: 'Register failed',
        registered_as: 'Registered',
        logging_in: 'Logging in...',
        login_failed: 'Login failed',
        welcome: 'Welcome',
        logout_failed: 'Logout failed',
        logged_out: 'Logged out',
        loading: 'Loading...',
        no_feed: 'No approved content yet.',
        total_count: 'Total',
        content_required: 'Content is required',
        posting: 'Posting...',
        post_failed: 'Post failed',
        posted_waiting: 'Posted #{id}, waiting moderation.',
        reported: 'Reported #{id}',
        voted: 'Vote updated',
        enter_admin_token: 'Enter admin token first',
        load_failed: 'Load failed',
        no_pending: 'No pending posts.',
        pending_count: 'Pending {n}',
        flagged_count: 'Flagged {n}',
        action_failed: 'Action failed',
        action_done: '#{id} {action}',
        action_approve: 'approved',
        action_hide: 'hidden',
        action_delete: 'deleted',
        sensitive_review_msg: 'Posted #{id}. Sensitive words detected, sent to flagged review.'
      },
      zh: {
        page_title: 'NYU 树洞',
        title: '扭打树洞',
        subtitle: '我是给，你也是给',
        language_label: '语言',
        account_title: '账号',
        username_placeholder: '用户名（3-24位）',
        password_placeholder: '密码（至少8位）',
        register_btn: '注册',
        login_btn: '登录',
        logout_btn: '退出',
        auth_hint: '当前需要登录后才能投稿。',
        content_placeholder: '写下你想说的话...（最多500字）',
        tag_placeholder: '可选标签，如 study / rant / life',
        submit_btn: '匿名投稿',
        post_hint: '新帖会先进入待审核队列，通过后才公开。',
        search_title: '搜索',
        search_placeholder: '按用户名/标签/主题/正文/评论搜索',
        search_btn: '搜索',
        topic_title: '话题',
        topic_placeholder: '标签，例如 study',
        load_topic_btn: '加载话题',
        hot_title: '热度排行榜',
        load_hot_btn: '加载热榜',
        no_search_results: '没有匹配结果。',
        no_hot_posts: '暂无热榜内容。',
        comments_count_label: '评论',
        hot_score_label: '热度',
        feed_title: '最新动态',
        refresh_btn: '刷新',
        admin_title: '管理员审核',
        admin_token_placeholder: '输入 ADMIN_TOKEN',
        load_pending_btn: '加载待审',
        load_flagged_btn: '加载敏感词待审',
        load_reports_btn: '加载举报记录',
        reports_title: '举报记录',
        no_reports: '暂无举报记录。',
        no_tag: '无标签',
        post_prefix: '洞',
        pending_prefix: '待审',
        flagged_prefix: '敏感待审',
        by_prefix: '发布者',
        category_prefix: '分类',
        sensitive_prefix: '敏感词',
        report_btn: '举报',
        upvote_btn: '点赞',
        downvote_btn: '点踩',
        load_comments_btn: '加载评论',
        comment_btn: '发表评论',
        comment_prompt: '输入评论（最多200字）',
        comments_title: '评论',
        comment_placeholder: '写下评论（最多200字）',
        no_comments: '暂无评论。',
        comment_required: '评论不能为空',
        comment_failed: '评论失败',
        commented: '评论已发布',
        report_prompt: '可选举报理由（最多120字）',
        report_failed: '举报失败',
        report_duplicate: '你已经举报过这条内容',
        report_hidden: '该内容达到举报阈值，已自动隐藏',
        approve_btn: '通过',
        hide_btn: '隐藏',
        delete_btn: '删除',
        not_logged_in: '未登录',
        logged_in_as: '已登录',
        registering: '注册中...',
        register_failed: '注册失败',
        registered_as: '注册成功',
        logging_in: '登录中...',
        login_failed: '登录失败',
        welcome: '欢迎',
        logout_failed: '退出失败',
        logged_out: '已退出',
        loading: '加载中...',
        no_feed: '暂无已通过内容。',
        total_count: '共',
        content_required: '内容不能为空',
        posting: '投稿中...',
        post_failed: '投稿失败',
        posted_waiting: '已投稿 #{id}，等待审核。',
        reported: '已举报 #{id}',
        voted: '投票已更新',
        enter_admin_token: '请先输入管理员令牌',
        load_failed: '加载失败',
        no_pending: '暂无待审内容。',
        pending_count: '待审 {n}',
        flagged_count: '敏感待审 {n}',
        action_failed: '操作失败',
        action_done: '#{id} 已{action}',
        action_approve: '通过',
        action_hide: '隐藏',
        action_delete: '删除',
        sensitive_review_msg: '已投稿 #{id}。检测到敏感词，已进入敏感词复核队列。'
      }
    };

    function t(key) {
      return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
    }

    function format(key, vars = {}) {
      let s = t(key);
      Object.keys(vars).forEach((k) => {
        s = s.replace(`{${k}}`, String(vars[k]));
        s = s.replace(`#{${k}}`, String(vars[k]));
      });
      return s;
    }

    function renderAuthState() {
      if (!currentUser) {
        authState.textContent = t('not_logged_in');
      } else {
        authState.textContent = `${t('logged_in_as')}: ${currentUser.username}`;
      }
      const adminPanel = document.getElementById('adminPanel');
      const isSuperAdmin = !!(currentUser && (currentUser.username || '').toLowerCase() === 'signupbook');
      adminPanel.classList.toggle('hidden', !isSuperAdmin);
    }

    function applyLang() {
      localStorage.setItem('treehole_lang', currentLang);
      document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
      document.title = t('page_title');
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.getAttribute('data-i18n'));
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
      });
      renderAuthState();
      const enBtn = document.getElementById('langEnBtn');
      const zhBtn = document.getElementById('langZhBtn');
      enBtn.style.opacity = currentLang === 'en' ? '1' : '0.7';
      zhBtn.style.opacity = currentLang === 'zh' ? '1' : '0.7';
    }

    function applyPageMode() {
      const p = String(window.__PAGE_MODE__ || window.location.pathname.toLowerCase()).toLowerCase();
      const auth = document.getElementById('authSection');
      const compose = document.getElementById('composeSection');
      const latest = document.getElementById('latestSection');
      const hot = document.getElementById('hotSection');
      const search = document.getElementById('searchSection');
      const topic = document.getElementById('topicSection');
      const navLatestBtn = document.getElementById('navLatestBtn');
      const navHotBtn = document.getElementById('navHotBtn');
      const navSearchBtn = document.getElementById('navSearchBtn');
      const navTopicBtn = document.getElementById('navTopicBtn');
      const navBroadcastBtn = document.getElementById('navBroadcastBtn');
      [navLatestBtn, navHotBtn, navSearchBtn, navTopicBtn, navBroadcastBtn].forEach((btn) => {
        if (btn) btn.classList.remove('nav-active');
      });
      auth.classList.remove('hidden');
      compose.classList.remove('hidden');
      latest.classList.remove('hidden');
      hot.classList.remove('hidden');
      search.classList.remove('hidden');
      topic.classList.remove('hidden');
      if (p === 'latest' || p === '/latest' || p === '/') {
        hot.classList.add('hidden');
        search.classList.add('hidden');
        topic.classList.add('hidden');
        navLatestBtn && navLatestBtn.classList.add('nav-active');
      } else if (p === 'hot' || p === '/hot') {
        compose.classList.add('hidden');
        latest.classList.add('hidden');
        search.classList.add('hidden');
        topic.classList.add('hidden');
        navHotBtn && navHotBtn.classList.add('nav-active');
      } else if (p === 'search' || p === '/search') {
        compose.classList.add('hidden');
        latest.classList.add('hidden');
        hot.classList.add('hidden');
        topic.classList.add('hidden');
        navSearchBtn && navSearchBtn.classList.add('nav-active');
      } else if (p === 'topic' || p === '/topic') {
        compose.classList.add('hidden');
        latest.classList.add('hidden');
        hot.classList.add('hidden');
        search.classList.add('hidden');
        navTopicBtn && navTopicBtn.classList.add('nav-active');
      } else if (p === 'broadcast' || p === '/broadcast') {
        topic.classList.add('hidden');
        navBroadcastBtn && navBroadcastBtn.classList.add('nav-active');
      }
    }

    function esc(s) {
      return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    function postCard(p, withAdmin = false) {
      const tag = p.tag
        ? `<a class="tag-link" href="/topic?tag=${encodeURIComponent(p.tag)}">#${esc(p.tag)}</a>`
        : t('no_tag');
      const category = esc(p.category || 'general');
      const username = esc(p.username || 'unknown');
      const sensitiveHits = p.sensitive_hits ? esc(p.sensitive_hits) : '';
      const likes = Number(p.like_count || 0);
      const dislikes = Number(p.dislike_count || 0);
      const canDirectDelete = !!(currentUser && (currentUser.username || '').toLowerCase() === 'signupbook');
      const base = `<div class="post">
        <div class="meta">${t('post_prefix')} #${p.id} · ${t('category_prefix')}: ${category} · ${tag} · ${t('by_prefix')}: ${username} · ${new Date(p.created_at).toLocaleString()}</div>
        <div class="content">${esc(p.content)}</div>
        <div class="meta">👍 ${likes} · 👎 ${dislikes}</div>
        <div class="actions">
          <button onclick="votePost(${p.id}, 1)">${t('upvote_btn')}</button>
          <button class="secondary" onclick="votePost(${p.id}, -1)">${t('downvote_btn')}</button>
          <button class="warn" onclick="reportPost(${p.id})">${t('report_btn')}</button>
          <button class="secondary" onclick="loadComments(${p.id})">${t('load_comments_btn')}</button>
          <button onclick="submitComment(${p.id})">${t('comment_btn')}</button>
          ${canDirectDelete ? `<button class="warn" onclick="adminDeleteDirect(${p.id})">${t('delete_btn')}</button>` : ''}
        </div>
        <div class="comments">
          <div class="meta">${t('comments_title')}</div>
          <div id="comments-${p.id}" class="meta" style="margin-top: 6px;"></div>
          <textarea id="comment-input-${p.id}" class="comment-box" placeholder="${t('comment_placeholder')}" maxlength="200"></textarea>
        </div>
      </div>`;
      if (!withAdmin) return base;
      const statusLabel = p.status === 'flagged' ? t('flagged_prefix') : t('pending_prefix');
      return `<div class="post">
        <div class="meta">${statusLabel} #${p.id} · ${t('category_prefix')}: ${category} · ${tag} · ${t('by_prefix')}: ${username} · ${new Date(p.created_at).toLocaleString()}</div>
        ${sensitiveHits ? `<div class="meta">${t('sensitive_prefix')}: ${sensitiveHits}</div>` : ''}
        <div class="content">${esc(p.content)}</div>
        <div class="actions">
          <button onclick="moderate(${p.id}, 'approve')">${t('approve_btn')}</button>
          <button class="secondary" onclick="moderate(${p.id}, 'hide')">${t('hide_btn')}</button>
          <button class="warn" onclick="moderate(${p.id}, 'delete')">${t('delete_btn')}</button>
        </div>
      </div>`;
    }

    function summaryCard(p, withScore = false) {
      const tag = p.tag
        ? `<a class="tag-link" href="/topic?tag=${encodeURIComponent(p.tag)}">#${esc(p.tag)}</a>`
        : t('no_tag');
      const category = esc(p.category || 'general');
      const username = esc(p.username || 'unknown');
      const cmt = Number(p.comment_count || 0);
      const score = Number(p.hot_score || 0);
      const likes = Number(p.like_count || 0);
      const dislikes = Number(p.dislike_count || 0);
      return `<div class="post">
        <div class="meta">#${p.id} · ${t('category_prefix')}: ${category} · ${tag} · ${t('by_prefix')}: ${username}</div>
        <div class="content">${esc(p.content || '')}</div>
        <div class="meta">${t('comments_count_label')}: ${cmt} · 👍 ${likes} · 👎 ${dislikes}${withScore ? ` · ${t('hot_score_label')}: ${score}` : ''}</div>
      </div>`;
    }

    async function fetchMe() {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.logged_in) {
        currentUser = data.user;
      } else {
        currentUser = null;
      }
      renderAuthState();
    }

    async function register() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      authStatus.textContent = t('registering');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if (!res.ok) {
        authStatus.textContent = data.error || t('register_failed');
        return;
      }
      authStatus.textContent = `${t('registered_as')} ${data.user.username}`;
      await fetchMe();
    }

    async function login() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      authStatus.textContent = t('logging_in');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      const data = await res.json();
      if (!res.ok) {
        authStatus.textContent = data.error || t('login_failed');
        return;
      }
      authStatus.textContent = `${t('welcome')} ${data.user.username}`;
      await fetchMe();
    }

    async function logout() {
      const res = await fetch('/api/auth/logout', {method: 'POST'});
      const data = await res.json();
      if (!res.ok) {
        authStatus.textContent = data.error || t('logout_failed');
        return;
      }
      authStatus.textContent = t('logged_out');
      await fetchMe();
    }

    async function fetchFeed() {
      feedStatus.textContent = t('loading');
      const res = await fetch('/api/posts');
      const data = await res.json();
      feed.innerHTML = data.posts.map((p) => postCard(p)).join('') || `<div class="meta">${t('no_feed')}</div>`;
      feedStatus.textContent = `${t('total_count')} ${data.posts.length}`;
    }

    async function doSearch() {
      const q = (document.getElementById('searchQuery').value || '').trim();
      if (!q) {
        searchResults.innerHTML = `<div class="meta">${t('no_search_results')}</div>`;
        return;
      }
      searchResults.innerHTML = `<div class="meta">${t('loading')}</div>`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        searchResults.innerHTML = `<div class="meta">${esc(data.error || t('load_failed'))}</div>`;
        return;
      }
      searchResults.innerHTML = (data.posts || []).map((p) => summaryCard(p, false)).join('') || `<div class="meta">${t('no_search_results')}</div>`;
    }

    async function loadHot() {
      hotList.innerHTML = `<div class="meta">${t('loading')}</div>`;
      const res = await fetch('/api/hot');
      const data = await res.json();
      if (!res.ok) {
        hotList.innerHTML = `<div class="meta">${esc(data.error || t('load_failed'))}</div>`;
        return;
      }
      hotList.innerHTML = (data.posts || []).map((p) => summaryCard(p, true)).join('') || `<div class="meta">${t('no_hot_posts')}</div>`;
    }

    async function submitPost() {
      const content = document.getElementById('content').value.trim();
      const category = document.getElementById('category').value;
      const tag = document.getElementById('tag').value.trim();
      if (!content) {
        submitStatus.textContent = t('content_required');
        return;
      }
      submitStatus.textContent = t('posting');
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({content, category, tag})
      });
      const data = await res.json();
      if (!res.ok) {
        submitStatus.textContent = data.error || t('post_failed');
        return;
      }
      document.getElementById('content').value = '';
      document.getElementById('category').value = 'general';
      document.getElementById('tag').value = '';
      submitStatus.textContent = data.flagged
        ? format('sensitive_review_msg', {id: data.id})
        : format('posted_waiting', {id: data.id});
    }

    async function loadComments(postId) {
      const box = document.getElementById(`comments-${postId}`);
      if (!box) return;
      box.textContent = t('loading');
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (!res.ok) {
        box.textContent = data.error || t('load_failed');
        return;
      }
      const html = (data.comments || []).map((c) =>
        `<div class="comment">
          <div class="meta">${esc(c.username)} · ${new Date(c.created_at).toLocaleString()}</div>
          <div class="content">${esc(c.content)}</div>
        </div>`
      ).join('');
      box.innerHTML = html || `<div class="meta">${t('no_comments')}</div>`;
    }

    async function submitComment(postId) {
      const input = document.getElementById(`comment-input-${postId}`);
      if (!input) return;
      const content = input.value.trim();
      if (!content) {
        feedStatus.textContent = t('comment_required');
        return;
      }
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({content})
      });
      const data = await res.json();
      if (!res.ok) {
        feedStatus.textContent = data.error || t('comment_failed');
        return;
      }
      input.value = '';
      feedStatus.textContent = t('commented');
      loadComments(postId);
    }

    async function votePost(id, value) {
      const res = await fetch(`/api/posts/${id}/vote`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({value})
      });
      const data = await res.json();
      if (!res.ok) {
        feedStatus.textContent = data.error || t('action_failed');
        return;
      }
      feedStatus.textContent = t('voted');
      await Promise.all([fetchFeed(), loadHot()]);
    }

    async function reportPost(id) {
      const reasonRaw = prompt(t('report_prompt')) || '';
      const reason = reasonRaw.trim().slice(0, 120);
      const res = await fetch(`/api/posts/${id}/report`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({reason})
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          feedStatus.textContent = t('report_duplicate');
        } else {
          feedStatus.textContent = data.error || t('report_failed');
        }
        return;
      }
      feedStatus.textContent = data.auto_hidden ? t('report_hidden') : format('reported', {id});
      fetchFeed();
    }

    async function loadPending() {
      const token = document.getElementById('adminToken').value.trim();
      if (!token) {
        adminStatus.textContent = t('enter_admin_token');
        return;
      }
      adminStatus.textContent = t('loading');
      const res = await fetch('/api/admin/posts?status=pending', {
        headers: {'X-Admin-Token': token}
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('load_failed');
        return;
      }
      document.getElementById('pending').innerHTML = data.posts.map((p) => postCard(p, true)).join('') || `<div class="meta">${t('no_pending')}</div>`;
      adminStatus.textContent = format('pending_count', {n: data.posts.length});
    }

    async function loadFlagged() {
      const token = document.getElementById('adminToken').value.trim();
      if (!token) {
        adminStatus.textContent = t('enter_admin_token');
        return;
      }
      adminStatus.textContent = t('loading');
      const res = await fetch('/api/admin/posts?status=flagged', {
        headers: {'X-Admin-Token': token}
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('load_failed');
        return;
      }
      document.getElementById('pending').innerHTML = data.posts.map((p) => postCard(p, true)).join('') || `<div class="meta">${t('no_pending')}</div>`;
      adminStatus.textContent = format('flagged_count', {n: data.posts.length});
    }

    async function loadReports() {
      const token = document.getElementById('adminToken').value.trim();
      if (!token) {
        adminStatus.textContent = t('enter_admin_token');
        return;
      }
      adminStatus.textContent = t('loading');
      const res = await fetch('/api/admin/reports', {
        headers: {'X-Admin-Token': token}
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('load_failed');
        return;
      }
      const html = (data.reports || []).map((r) =>
        `<div class="post">
          <div class="meta">#${r.id} · post ${r.post_id} · ${r.reporter_username} · ${new Date(r.created_at).toLocaleString()}</div>
          <div class="content">${esc(r.reason || '')}</div>
          <div class="meta">status=${esc(r.post_status || '')} · reports=${r.total_reports || 0} · ${esc(r.post_preview || '')}</div>
          <div class="actions">
            <button class="warn" onclick="deleteReportedPost(${r.post_id})">${t('delete_btn')}</button>
          </div>
        </div>`
      ).join('');
      document.getElementById('reports').innerHTML = html || `<div class="meta">${t('no_reports')}</div>`;
      adminStatus.textContent = `reports ${(data.reports || []).length}`;
    }

    async function deleteReportedPost(postId) {
      const token = document.getElementById('adminToken').value.trim();
      if (!token) {
        adminStatus.textContent = t('enter_admin_token');
        return;
      }
      const res = await fetch(`/api/admin/posts/${postId}/moderate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Admin-Token': token},
        body: JSON.stringify({action: 'delete'})
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('action_failed');
        return;
      }
      adminStatus.textContent = format('action_done', {id: postId, action: t('action_delete')});
      await Promise.all([loadReports(), fetchFeed()]);
    }

    async function moderate(id, action) {
      const token = document.getElementById('adminToken').value.trim();
      const res = await fetch(`/api/admin/posts/${id}/moderate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Admin-Token': token},
        body: JSON.stringify({action})
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('action_failed');
        return;
      }
      adminStatus.textContent = format('action_done', {id, action: t(`action_${action}`)});
      await Promise.all([loadPending(), fetchFeed()]);
    }

    async function adminDeleteDirect(postId) {
      const tokenEl = document.getElementById('adminToken');
      const token = tokenEl ? tokenEl.value.trim() : '';
      if (!token) {
        adminStatus.textContent = t('enter_admin_token');
        return;
      }
      const res = await fetch(`/api/admin/posts/${postId}/moderate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Admin-Token': token},
        body: JSON.stringify({action: 'delete'})
      });
      const data = await res.json();
      if (!res.ok) {
        adminStatus.textContent = data.error || t('action_failed');
        return;
      }
      adminStatus.textContent = format('action_done', {id: postId, action: t('action_delete')});
      await Promise.all([fetchFeed(), loadHot()]);
    }

    async function loadTopic() {
      const tag = (document.getElementById('topicTag').value || '').trim();
      const box = document.getElementById('topicList');
      if (!tag) {
        box.innerHTML = `<div class="meta">${t('load_failed')}: tag required</div>`;
        return;
      }
      box.innerHTML = `<div class="meta">${t('loading')}</div>`;
      const res = await fetch(`/api/topics?tag=${encodeURIComponent(tag)}`);
      const data = await res.json();
      if (!res.ok) {
        box.innerHTML = `<div class="meta">${esc(data.error || t('load_failed'))}</div>`;
        return;
      }
      box.innerHTML = (data.posts || []).map((p) => summaryCard(p, false)).join('') || `<div class="meta">${t('no_search_results')}</div>`;
    }

    function initTopicFromQuery() {
      const p = String(window.__PAGE_MODE__ || '').toLowerCase();
      if (!(p === 'topic' || p === '/topic')) return;
      const params = new URLSearchParams(window.location.search || '');
      const tag = (params.get('tag') || '').trim();
      if (!tag) return;
      const input = document.getElementById('topicTag');
      input.value = tag;
      loadTopic();
    }

    document.getElementById('langEnBtn').addEventListener('click', () => {
      currentLang = 'en';
      applyLang();
      fetchFeed();
    });
    document.getElementById('langZhBtn').addEventListener('click', () => {
      currentLang = 'zh';
      applyLang();
      fetchFeed();
    });
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('loadHotBtn').addEventListener('click', loadHot);
    document.getElementById('refreshBtn').addEventListener('click', fetchFeed);
    document.getElementById('submitBtn').addEventListener('click', submitPost);
    document.getElementById('loadPendingBtn').addEventListener('click', loadPending);
    document.getElementById('loadFlaggedBtn').addEventListener('click', loadFlagged);
    document.getElementById('loadReportsBtn').addEventListener('click', loadReports);
    document.getElementById('loadTopicBtn').addEventListener('click', loadTopic);

    applyLang();
    applyPageMode();
    Promise.all([fetchMe(), fetchFeed(), loadHot()]).then(initTopicFromQuery);
  </script>
</body>
</html>
"""

BROADCAST_HTML = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Broadcast</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", sans-serif; background: #f6f5fb; color: #1f1540; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 24px 14px; }
    .card { background: #fff; border: 1px solid #ddd3f1; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
    .meta { color: #6f668a; font-size: 13px; }
    h1 { margin: 0 0 10px; font-style: italic; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .toolbar input { flex: 1; min-width: 220px; border: 1px solid #ddd3f1; border-radius: 10px; padding: 9px 10px; }
    .toolbar button { border: 0; background: #4a2f72; color: #fff; border-radius: 10px; padding: 8px 12px; cursor: pointer; }
    .toolbar button.active { background: #57068c; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Broadcast</h1>
    <div class="toolbar">
      <input id="q" type="text" placeholder="Search title/content..." />
      <button class="range active" data-range="all">All</button>
      <button class="range" data-range="today">Today</button>
      <button class="range" data-range="week">This Week</button>
    </div>
    <div id="list"></div>
  </div>
  <script>
    let allBroadcasts = [];
    let range = 'all';

    function esc(s) {
      return (s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
    function inRange(ts, r) {
      if (r === 'all') return true;
      const d = new Date(ts);
      const now = new Date();
      if (r === 'today') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      }
      if (r === 'week') {
        return now.getTime() - d.getTime() <= 7 * 24 * 3600 * 1000;
      }
      return true;
    }
    function render() {
      const q = (document.getElementById('q').value || '').trim().toLowerCase();
      const list = document.getElementById('list');
      const filtered = allBroadcasts.filter((b) => {
        const text = `${b.title || ''} ${b.content || ''}`.toLowerCase();
        return inRange(b.created_at, range) && (!q || text.includes(q));
      });
      list.innerHTML = filtered.map((b) => `
        <div class="card">
          <div><strong>${esc(b.title)}</strong></div>
          <div style="margin:8px 0; white-space:pre-wrap;">${esc(b.content)}</div>
          <div class="meta">${new Date(b.created_at).toLocaleString()} · ${esc(b.author || 'system')}</div>
        </div>
      `).join('') || '<div class="meta">No matching broadcasts.</div>';
    }
    async function load() {
      const res = await fetch('/api/broadcasts');
      const data = await res.json();
      allBroadcasts = data.broadcasts || [];
      render();
    }
    document.getElementById('q').addEventListener('input', render);
    document.querySelectorAll('.range').forEach((btn) => {
      btn.addEventListener('click', () => {
        range = btn.dataset.range;
        document.querySelectorAll('.range').forEach((x) => x.classList.toggle('active', x === btn));
        render();
      });
    });
    load();
  </script>
</body>
</html>
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
                "SELECT u.id, u.username, u.is_admin, u.is_banned, u.ban_reason, u.banned_at "
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


def _hash_password(password: str, salt_hex: Optional[str] = None) -> str:
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"{salt_hex}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    calc = _hash_password(password, salt_hex=salt_hex)
    return secrets.compare_digest(calc.split("$", 1)[1], digest_hex)


def _find_sensitive_hits(*texts: Optional[str]) -> list[str]:
    merged = " ".join([(t or "") for t in texts]).lower()
    hits = []
    for word in SENSITIVE_WORDS:
        if word and word in merged:
            hits.append(word)
    return sorted(set(hits))


class TreeholeHandler(BaseHTTPRequestHandler):
    db = DB(DB_PATH)
    post_limit = {}

    def _json(self, code: int, payload: dict, set_cookie: Optional[str] = None):
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

    def _is_banned_user(self, user: Optional[dict]) -> bool:
        return bool(user and int(user.get("is_banned", 0)) == 1)

    def _unauthorized(self):
        self._json(HTTPStatus.UNAUTHORIZED, {"error": "admin token invalid"})

    def _cookie_dict(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        return cookie

    def _session_token(self) -> Optional[str]:
        cookie = self._cookie_dict()
        morsel = cookie.get("session_token")
        return morsel.value if morsel else None

    def _current_user(self) -> Optional[dict]:
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
            created = self.db.create_user(username=username, password_hash=_hash_password(password))
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
            if not user or not _verify_password(password, user["password_hash"]):
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

            sensitive_hits = _find_sensitive_hits(content, tag)
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
