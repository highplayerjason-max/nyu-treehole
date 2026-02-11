
LOGIN_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login - NYU Treehole</title>
  <style>
    :root {
      --bg: #f5f1fb;
      --card: #ffffff;
      --ink: #231942;
      --muted: #6f668a;
      --accent: #57068c;
      --accent-2: #7c3aed;
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
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 10px 26px rgba(87,6,140,0.08);
      width: 100%;
      max-width: 360px;
    }
    h2 { text-align: center; margin-top: 0; margin-bottom: 20px; }
    input {
      width: 100%;
      margin-bottom: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font: inherit;
    }
    button {
      width: 100%;
      padding: 12px;
      border: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #fff;
      font: inherit;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { opacity: 0.9; }
    .meta { text-align: center; margin-top: 16px; font-size: 14px; color: var(--muted); }
    .status { margin-top: 12px; text-align: center; font-size: 14px; min-height: 20px; color: var(--accent); }
    a { color: var(--accent); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Login</h2>
    <input id="username" type="text" placeholder="Username" maxlength="24" />
    <input id="password" type="password" placeholder="Password" maxlength="72" />
    <button id="loginBtn">Login</button>
    <div class="status" id="status"></div>
    <div class="meta">
      <a href="/register">No account? Register</a>
    </div>
  </div>
  <script>
    const status = document.getElementById('status');
    const loginBtn = document.getElementById('loginBtn');
    
    async function login() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) {
        status.textContent = "Username and password required";
        return;
      }
      status.textContent = "Logging in...";
      loginBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({username, password})
        });
        const data = await res.json();
        if (!res.ok) {
          status.textContent = data.error || "Login failed";
          loginBtn.disabled = false;
        } else {
          status.textContent = "Success! Redirecting...";
          window.location.href = '/';
        }
      } catch (e) {
        status.textContent = "Network error";
        loginBtn.disabled = false;
      }
    }

    loginBtn.addEventListener('click', login);
    document.getElementById('password').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') login();
    });
  </script>
</body>
</html>
"""

REGISTER_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Register - NYU Treehole</title>
  <style>
    :root {
      --bg: #f5f1fb;
      --card: #ffffff;
      --ink: #231942;
      --muted: #6f668a;
      --accent: #57068c;
      --accent-2: #7c3aed;
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
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 10px 26px rgba(87,6,140,0.08);
      width: 100%;
      max-width: 360px;
    }
    h2 { text-align: center; margin-top: 0; margin-bottom: 20px; }
    input {
      width: 100%;
      margin-bottom: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font: inherit;
    }
    button {
      width: 100%;
      padding: 12px;
      border: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #fff;
      font: inherit;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary { background: #3f2a63; }
    button:hover { opacity: 0.9; }
    .meta { text-align: center; margin-top: 16px; font-size: 14px; color: var(--muted); }
    .status { margin-top: 12px; text-align: center; font-size: 14px; min-height: 20px; color: var(--accent); }
    a { color: var(--accent); text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Register</h2>
    <input id="username" type="text" placeholder="Username (3-24 chars)" maxlength="24" />
    <input id="password" type="password" placeholder="Password (>=8 chars)" maxlength="72" />
    <button id="regBtn" class="secondary">Register</button>
    <div class="status" id="status"></div>
    <div class="meta">
      <a href="/login">Have account? Login</a>
    </div>
  </div>
  <script>
    const status = document.getElementById('status');
    const regBtn = document.getElementById('regBtn');
    
    async function register() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) {
        status.textContent = "Username and password required";
        return;
      }
      status.textContent = "Registering...";
      regBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({username, password})
        });
        const data = await res.json();
        if (!res.ok) {
          status.textContent = data.error || "Register failed";
          regBtn.disabled = false;
        } else {
          status.textContent = "Success! Logging in...";
          // Auto login or redirect
          window.location.href = '/';
        }
      } catch (e) {
        status.textContent = "Network error";
        regBtn.disabled = false;
      }
    }

    regBtn.addEventListener('click', register);
    document.getElementById('password').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') register();
    });
  </script>
</body>
</html>
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

    <section id="userBar" class="card hidden">
      <div class="row" style="margin-top: 0; justify-content: space-between; align-items: center;">
        <div id="userBarInfo" class="meta"></div>
        <div style="display: flex; gap: 8px;">
          <a href="/profile"><button class="secondary" style="padding: 6px 12px; font-size: 13px;" data-i18n="profile_btn">Profile</button></a>
          <button id="doLogoutBtn" class="warn" style="padding: 6px 12px; font-size: 13px;" data-i18n="logout_btn">Logout</button>
        </div>
      </div>
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

    <section id="profileSection" class="card hidden">
      <div class="row" style="margin-top: 0;">
        <strong data-i18n="profile_title">My Profile</strong>
      </div>
      <div id="profileInfo" class="meta" style="margin-top: 10px;"></div>
      <div style="margin-top: 14px;">
        <strong data-i18n="my_posts_title">My Posts</strong>
        <div id="myPostsList" style="margin-top: 10px;"></div>
      </div>
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
    let currentLang = localStorage.getItem('treehole_lang') || 'en';
    let currentUser = null;

    const I18N = {
      en: {
        page_title: 'NYU Treehole',
        title: 'Never Gonna Give You Up Treehole',
        subtitle: 'This is weird, but you are welcome.',
        language_label: 'Language',
        account_title: 'Account',
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
        sensitive_review_msg: 'Posted #{id}. Sensitive words detected, sent to flagged review.',
        profile_title: 'My Profile',
        my_posts_title: 'My Posts',
        profile_btn: 'Profile',
        joined_at: 'Joined at',
        role_label: 'Role',
        role_admin: 'Admin',
        role_user: 'User',
        role_banned: 'Banned'
      },
      zh: {
        page_title: 'NYU 树洞',
        title: '扭打树洞',
        subtitle: '我是给，你也是给',
        language_label: '语言',
        account_title: '账号',
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
        sensitive_review_msg: '已投稿 #{id}。检测到敏感词，已进入敏感词复核队列。',
        profile_title: '我的资料',
        my_posts_title: '我的投稿',
        profile_btn: '个人资料',
        joined_at: '注册时间',
        role_label: '角色',
        role_admin: '管理员',
        role_user: '普通用户',
        role_banned: '已封禁'
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
      if (currentUser) {
        document.getElementById('userBarInfo').textContent = `${t('logged_in_as')}: ${esc(currentUser.username)}`;
        const adminPanel = document.getElementById('adminPanel');
        const isSuperAdmin = !!(currentUser && (currentUser.username || '').toLowerCase() === 'signupbook');
        adminPanel.classList.toggle('hidden', !isSuperAdmin);
      }
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
      // Sections
      const userBar = document.getElementById('userBar');
      const compose = document.getElementById('composeSection');
      const latest = document.getElementById('latestSection');
      const hot = document.getElementById('hotSection');
      const search = document.getElementById('searchSection');
      const topic = document.getElementById('topicSection');
      const profile = document.getElementById('profileSection');
      
      // Nav
      const navLatestBtn = document.getElementById('navLatestBtn');
      const navHotBtn = document.getElementById('navHotBtn');
      const navSearchBtn = document.getElementById('navSearchBtn');
      const navTopicBtn = document.getElementById('navTopicBtn');
      const navBroadcastBtn = document.getElementById('navBroadcastBtn');
      const navContainer = navLatestBtn ? navLatestBtn.parentElement.parentElement : null; // .row

      // Reset Nav Active
      [navLatestBtn, navHotBtn, navSearchBtn, navTopicBtn, navBroadcastBtn].forEach((btn) => {
        if (btn) btn.classList.remove('nav-active');
      });

      // Hide All First
      if (userBar) userBar.classList.add('hidden');
      if (compose) compose.classList.add('hidden');
      if (latest) latest.classList.add('hidden');
      if (hot) hot.classList.add('hidden');
      if (search) search.classList.add('hidden');
      if (topic) topic.classList.add('hidden');
      if (profile) profile.classList.add('hidden');
      if (navContainer) navContainer.style.display = 'flex';

      // App Modes
      if (userBar) userBar.classList.remove('hidden');
      
      if (p === 'profile' || p === '/profile') {
        if (profile) {
          profile.classList.remove('hidden');
          if (typeof loadProfile === 'function') loadProfile();
        }
      } else if (p === 'latest' || p === '/latest' || p === '/') {
        if (compose) compose.classList.remove('hidden');
        if (latest) latest.classList.remove('hidden');
        navLatestBtn && navLatestBtn.classList.add('nav-active');
      } else if (p === 'hot' || p === '/hot') {
        if (hot) hot.classList.remove('hidden');
        navHotBtn && navHotBtn.classList.add('nav-active');
      } else if (p === 'search' || p === '/search') {
        if (search) search.classList.remove('hidden');
        navSearchBtn && navSearchBtn.classList.add('nav-active');
      } else if (p === 'topic' || p === '/topic') {
        if (topic) topic.classList.remove('hidden');
        navTopicBtn && navTopicBtn.classList.add('nav-active');
      } else if (p === 'broadcast' || p === '/broadcast') {
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
        // Force redirect if not logged in and not on a special page, but this logic is mostly backend now.
      }
      renderAuthState();
    }

    async function logout() {
      const res = await fetch('/api/auth/logout', {method: 'POST'});
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || t('logout_failed'));
        return;
      }
      await fetchMe();
      window.location.href = '/login';
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

    async function loadProfile() {
      if (!currentUser) {
        document.getElementById('profileInfo').innerHTML = `<div class="meta">${t('not_logged_in')}</div>`;
        return;
      }
      const role = currentUser.is_banned ? t('role_banned') : (currentUser.is_admin ? t('role_admin') : t('role_user'));
      const created = currentUser.created_at ? new Date(currentUser.created_at).toLocaleString() : '-';
      
      let html = `
        <div><strong>${t('account_title')}</strong>: ${esc(currentUser.username)}</div>
        <div class="meta">ID: ${currentUser.id} · ${t('role_label')}: ${role} · ${t('joined_at')}: ${created}</div>
      `;
      document.getElementById('profileInfo').innerHTML = html;

      const box = document.getElementById('myPostsList');
      box.innerHTML = `<div class="meta">${t('loading')}</div>`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      if (!res.ok) {
        box.innerHTML = `<div class="meta">${esc(data.error || t('load_failed'))}</div>`;
        return;
      }
      const myPosts = (data.posts || []).filter(p => p.username === currentUser.username);
      box.innerHTML = myPosts.map((p) => summaryCard(p, false)).join('') || `<div class="meta">${t('no_search_results')}</div>`;
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
    document.getElementById('doLogoutBtn').addEventListener('click', logout);
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
