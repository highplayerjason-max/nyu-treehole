# 更新日志 / Changelog

所有重要变更均记录于此，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [未发布] - 进行中

---

### Documentation
- documented the current email-verification blocker in `README.md`
- clarified that `@nyu.edu` restriction already exists, but the verification
  flow is still not unified
- recorded the two valid next directions: token-link verification or 6-digit
  code verification

### Changed
- removed the in-progress email-verification flow from the live auth path
- registration now creates accounts that can log in directly again
- kept the `@nyu.edu` registration restriction in place

### Removed
- removed `/verify-email` page from the active auth flow
- removed resend-verification and verify-email API routes
- removed login-time blocking for unverified email addresses

### Known issue
- `src/lib/email.ts` is still being experimented on locally, but it is no longer
  part of the active registration/login flow

## [0.4.0] - 2026-03-18

### 新增
- **管理后台 · 标签管理**（`/admin/tags`）
  - 列出所有 hashtag，显示「已发布帖数」与「全部帖数」
  - 支持关键词搜索及状态筛选（全部 / 正常 / 已屏蔽）
  - **屏蔽**：将标签从热门话题中隐藏，且新帖无法再使用该标签
  - **删除**：从数据库及所有帖子中永久移除标签（不可撤销）
  - 管理侧边栏新增「标签管理」入口
- **首页介绍区块**：在 Hero 与功能卡片之间新增「为什么是树洞？」说明段落，含三枚价值标签徽章（匿名安全 / AI 智能审核 / 开放自由讨论）
- **侧边栏「首页」链接**：导航列表首项直接回到主页

### 变更
- **热门话题**：只统计 `status = PUBLISHED` 的帖子，已屏蔽标签不再出现
- **发帖逻辑**：创建帖子时跳过已屏蔽的 hashtag，保留正文原文但不建立标签关联

### 数据库迁移
```sql
ALTER TABLE "Hashtag" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;
```

---

## [0.3.0] - 2026-03-18

### 新增
- **中英双语界面**（博客 & 树洞页面全面接入 i18n）
  - 所有页面文案、相对时间戳（"刚刚" ↔ "just now"）随语言切换
- **PC 侧边栏**（`lg` 断点以上）：导航、热门话题（实时拉取）、关于三个面板，`sticky top-20` 粘性定位
- **帖子翻译按钮**：每条树洞卡片操作栏新增翻译图标，点击调用 LLM 将帖子内容翻译到当前界面语言，支持切换「显示原文」
- **`GET /api/hashtags/trending`**：热门话题接口，按帖子数降序返回前 15 个 hashtag
- **`POST /api/translate`**：翻译接口，复用已配置的 LLM provider（DeepSeek / OpenAI / Anthropic），10 秒超时保护
- 站点名称恢复为 **NYU树洞 / NYU Treehole**

### 修复
- 博客与树洞页面在切换语言后文案不刷新

---

## [0.2.0] - 2026-03-18

### 新增
- **评论预览**：树洞 Feed 每条帖子最多显示前 3 条顶层评论，超出时显示「查看全部 N 条评论 →」
- **中英双语切换**：Navbar 新增 `EN` / `中` 切换按钮，语言偏好存储于 `localStorage`；移动端侧边栏同步支持
- **移动端侧边栏重构**：修复内容被截断、空白区域过多的问题，底部固定用户信息区

### 修复
- **评论提交卡在「发送中...」**：为 DeepSeek、OpenAI、Anthropic 三个 LLM provider 的 `fetch()` 均添加 `AbortController` + 8 秒超时，彻底解决无响应挂起问题

---

## [0.1.0] - 2026-03-17

### 新增
- **树洞**：匿名发帖，#话题 标签聚合，点赞，嵌套评论，AI 内容审核（LLM 自动标记违规内容）
- **博客**：富文本编辑，标签分类，连载系列，评论互动
- **课评**：页面占位（功能即将上线）
- **管理后台**：数据概览、用户管理（封禁 / 改权限）、内容审核队列（通过 / 拒绝 / 删除）
- **认证系统**：邮箱 + 密码注册登录，bcrypt 加密，NextAuth Session
- **CI/CD**：GitHub Actions 自动构建 Docker 镜像推送至 GHCR，SSH 部署至阿里云服务器
- **Docker 部署**：Next.js standalone + PostgreSQL，端口映射 `80:3000`，`HOSTNAME=0.0.0.0`
