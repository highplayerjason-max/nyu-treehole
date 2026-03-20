# Changelog

所有重要改动均记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [0.8.0] — 2026-03-20

### 移除
- **邮箱验证系统完全移除**：删除 `src/lib/email.ts`、三个空的验证路由目录（`verify-email/`、`resend-verification/`）
- `nodemailer` 和 `@types/nodemailer` 依赖已从 `package.json` 中删除
- `.env.example` 中移除 SMTP 配置段

### 数据库变更（需执行 migration）
- `User` 表移除 `emailVerified` 字段（从未被鉴权逻辑检查过）
- 移除 `VerificationToken` 表（从未被写入过）
- Migration 文件：`prisma/migrations/20260320000000_remove_email_verification/migration.sql`

### 修复
- **邮箱大小写/空格导致登录失败**：注册和登录时统一对邮箱做 `trim().toLowerCase()`
  - `src/lib/validators.ts`：`registerSchema` 和 `loginSchema` 的 email 字段加 `.trim().toLowerCase()` transform
  - `src/lib/auth.ts`：`authorize()` 中对 credentials.email 做规范化再查库

### 文档
- `ARCHITECTURE.md` 更新：移除邮箱验证相关章节，修正认证流程描述
- `README.md` 更新：移除 SMTP 配置说明，移除邮箱验证功能描述

---

## [未发布] — 进行中

### 待完成
- GitHub Actions 构建失败问题修复
- 服务器数据库 `imageUrl` 字段迁移（及新的 email verification migration）

---

## [0.7.0] — 2026-03-19

### 新增
- **ARCHITECTURE.md**：完整的开发者文档，覆盖 14 个功能模块的实现逻辑、数据库设计、API 路由、部署流程、环境变量说明及常见问题

### 变更
- **邮箱验证方式重构**：从"链接跳转"改为"6位数字验证码"
  - `src/lib/email.ts`：新增 `generateVerificationCode()`（生成6位随机数字）、`sendVerificationCode()`（发送带样式的中文 HTML 邮件），验证码10分钟有效
  - 原 `sendVerificationEmail()` 已删除

---

## [0.6.0] — 2026-03-18

### 新增
- **账号注销**（`DELETE /api/user/delete`）：事务性级联删除用户所有数据（帖子、评论、文章、点赞、举报、审核日志），前端有二次确认弹窗
- **图片上传**（`POST /api/upload`）：支持 JPEG/PNG/GIF/WebP，最大 5MB，存储到 `/public/uploads/`，Docker volume 持久化
  - 树洞发帖、博客发文章均支持附带一张图片
  - `TreeholePost` 表新增 `imageUrl TEXT` 字段
- **发帖频率限制**（`src/lib/rate-limit.ts`）：每用户每分钟最多发1条内容，跨树洞帖子/评论/博客文章共享计数池

### 修复
- 注册时 SMTP 不可用导致页面卡在"注册中..."：改为 fire-and-forget 发送邮件，不阻塞注册流程

---

## [0.5.0] — 2026-03-17

### 新增
- **多语言支持（i18n）**：中文/英文切换，`src/lib/i18n.ts` 维护翻译字符串，`src/contexts/language-context.tsx` 管理全局语言状态，偏好存 localStorage
- **翻译功能**（`POST /api/translate`）：树洞帖子内容一键翻译

### 变更
- 注册限制改为仅允许 `@nyu.edu` 邮箱

---

## [0.4.0] — 2026-03-16

### 新增
- **管理员 Hashtag 管理**：查看所有 hashtag 使用量、封禁/解禁（`/api/admin/tags/`）
- **Auth Guard**：未登录用户访问需要认证的页面时自动跳转 `/login`
- **邮箱验证流程**（初版，链接形式）：注册后发送验证链接，`VerificationToken` 表存储 token

---

## [0.3.0] — 2026-03-14

### 新增
- **管理员后台**：内容审核队列（APPROVE/REJECT/DELETE）、用户管理（角色修改、封禁）
- **LLM 内容审核**（`src/lib/moderation.ts`）：支持 OpenAI/Anthropic/DeepSeek，发帖时自动检测，不可用时降级跳过
- **举报系统**：满3次举报自动标记 FLAGGED，进入审核队列
- **Sidebar**：热门 Hashtag 展示、快捷导航

---

## [0.2.0] — 2026-03-12

### 新增
- **树洞（TreeHole）**：匿名/实名发帖、`#hashtag` 自动提取、嵌套评论、点赞、cursor 分页
- **博客（Blog）**：文章发布（支持草稿）、Tag、Series、评论、全文搜索、举报
- **匿名处理**：前端不返回匿名作者信息，数据库保留 `authorId` 供管理员追查

---

## [0.1.0] — 2026-03-10

### 新增
- **项目初始化**：Next.js 16 App Router + TypeScript + Tailwind CSS v4 + shadcn/ui
- **用户注册/登录**：NextAuth v5 Credentials Provider，bcrypt 密码哈希，JWT 会话
- **数据库**：PostgreSQL + Prisma v6，User/Role/ContentStatus 基础模型
- **Docker 部署**：多阶段 Dockerfile、docker-compose（db + app），standalone 模式
- **CI/CD**：GitHub Actions 自动构建推送 GHCR，SSH 部署到服务器（139.224.81.169）
- **种子数据**：默认管理员账号 `admin@example.com` / `admin123`
