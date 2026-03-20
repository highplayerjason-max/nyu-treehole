# NYU 树洞 — 开发者文档

> 本文档面向接手此项目的开发者，系统地描述每一个功能的实现逻辑、对应文件、数据库设计，以及网站上线流程。

---

## 目录

1. [技术栈](#1-技术栈)
2. [项目结构](#2-项目结构)
3. [数据库设计](#3-数据库设计)
4. [功能模块详解](#4-功能模块详解)
   - 4.1 [用户注册与登录](#41-用户注册与登录)
   - 4.2 [树洞（匿名社区）](#42-树洞匿名社区)
   - 4.3 [博客](#43-博客)
   - 4.4 [图片上传](#44-图片上传)
   - 4.5 [发帖频率限制](#45-发帖频率限制)
   - 4.6 [内容审核（LLM）](#46-内容审核llm)
   - 4.7 [举报系统](#47-举报系统)
   - 4.8 [点赞系统](#48-点赞系统)
   - 4.9 [Hashtag 系统](#49-hashtag-系统)
   - 4.10 [管理员后台](#410-管理员后台)
   - 4.11 [账号注销](#411-账号注销)
   - 4.12 [多语言支持（i18n）](#412-多语言支持i18n)
   - 4.13 [翻译功能](#413-翻译功能)
5. [环境变量说明](#5-环境变量说明)
6. [上线部署流程](#6-上线部署流程)
7. [常见问题与注意事项](#7-常见问题与注意事项)

---

## 1. 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router + Turbopack） |
| 语言 | TypeScript 5 |
| UI | shadcn/ui v4（@base-ui/react）+ Tailwind CSS v4 |
| 数据库 | PostgreSQL 16 + Prisma v6 ORM |
| 认证 | NextAuth.js v5（Credentials Provider，JWT 会话） |
| 表单验证 | Zod v4 |
| 密码加密 | bcryptjs |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions → GHCR → 服务器 SSH 部署 |

---

## 2. 项目结构

```
website/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义（所有表结构都在这里）
│   └── seed.ts                # 初始种子数据（创建默认管理员账号）
├── src/
│   ├── app/                   # Next.js App Router 页面和 API
│   │   ├── (auth)/            # 登录/注册页面（路由组，不影响URL）
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── admin/             # 管理员后台页面
│   │   │   ├── page.tsx       # 内容审核
│   │   │   ├── users/         # 用户管理
│   │   │   └── tags/          # Hashtag 管理
│   │   ├── account/page.tsx   # 用户个人主页 & 账号注销
│   │   ├── blog/              # 博客前端页面
│   │   ├── treehole/          # 树洞前端页面
│   │   ├── api/               # 所有 API 路由（纯服务端）
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts      # NextAuth 内置路由
│   │   │   │   └── register/route.ts           # 注册接口
│   │   │   ├── treehole/
│   │   │   │   ├── route.ts                    # 获取列表/发帖
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts                # 获取单帖/删除
│   │   │   │       ├── comments/route.ts       # 发评论
│   │   │   │       ├── like/route.ts           # 点赞
│   │   │   │       └── report/route.ts         # 举报
│   │   │   ├── blog/
│   │   │   │   ├── route.ts                    # 文章列表/发文章
│   │   │   │   └── [slug]/
│   │   │   │       ├── route.ts                # 获取/更新/删除文章
│   │   │   │       ├── comments/route.ts       # 发评论
│   │   │   │       └── report/route.ts         # 举报
│   │   │   ├── admin/
│   │   │   │   ├── moderation/route.ts         # 审核队列（查看被举报/标记内容）
│   │   │   │   ├── moderation/[id]/route.ts    # 执行审核操作
│   │   │   │   ├── users/route.ts              # 用户列表
│   │   │   │   ├── users/[id]/route.ts         # 修改用户角色/封禁
│   │   │   │   ├── tags/route.ts               # Hashtag 列表/创建
│   │   │   │   └── tags/[id]/route.ts          # 封禁/解禁 hashtag
│   │   │   ├── user/
│   │   │   │   └── delete/route.ts             # 账号注销
│   │   │   ├── upload/route.ts                 # 图片上传
│   │   │   ├── hashtags/trending/route.ts      # 热门 hashtag
│   │   │   └── translate/route.ts              # 翻译接口
│   │   ├── layout.tsx                          # 根布局（注入 Providers）
│   │   └── page.tsx                            # 首页（重定向到树洞）
│   ├── components/
│   │   ├── ui/                # shadcn/ui 基础组件（按钮、输入框、卡片等）
│   │   ├── layout/            # Navbar、Sidebar
│   │   ├── treehole/          # 树洞相关组件（帖子卡片、评论区、发帖表单）
│   │   ├── blog/              # 博客组件（文章卡片、富文本编辑器、评论）
│   │   ├── shared/            # 通用组件（点赞按钮、举报按钮）
│   │   └── providers.tsx      # 客户端 Provider 包裹（SessionProvider + LanguageProvider）
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置（认证逻辑核心）
│   │   ├── prisma.ts          # Prisma 单例客户端
│   │   ├── rate-limit.ts      # 发帖频率限制（每分钟1条）
│   │   ├── moderation.ts      # LLM 内容审核
│   │   ├── validators.ts      # Zod 输入校验 schema
│   │   ├── i18n.ts            # 翻译字符串（中英文）
│   │   ├── translate.ts       # 翻译 API 调用逻辑
│   │   └── utils.ts           # 工具函数（cn: Tailwind class 合并）
│   ├── types/
│   │   └── next-auth.d.ts     # 扩展 NextAuth Session 类型（添加 id 和 role 字段）
│   └── contexts/
│       └── language-context.tsx # 语言切换全局状态
├── public/
│   └── uploads/               # 上传图片存储目录（Docker volume 挂载）
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD 自动部署配置
├── Dockerfile                 # 多阶段 Docker 构建
├── docker-compose.yml         # 服务编排（数据库 + 应用）
└── .env.example               # 环境变量模板
```

---

## 3. 数据库设计

数据库定义文件：`prisma/schema.prisma`

### 用户相关

#### `User` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| email | String (unique) | 必须是 @nyu.edu 邮箱，存储时已 lowercase |
| passwordHash | String | bcrypt 哈希，cost=10 |
| displayName | String | 显示名称（2-20字符） |
| role | Enum(Role) | USER 或 ADMIN |
| isBanned | Boolean | 是否封禁，默认 false |
| avatarUrl | String? | 头像 URL（可选） |
| createdAt | DateTime | 注册时间 |
| updatedAt | DateTime | 最后更新时间 |

### 树洞相关

#### `TreeholePost` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| content | String | 帖子内容（1-2000字） |
| imageUrl | String? | 图片 URL（可选） |
| isAnonymous | Boolean | 是否匿名，默认 true |
| status | Enum(ContentStatus) | PUBLISHED/FLAGGED/REJECTED/DELETED |
| authorId | String | 外键 → User.id（匿名时也保存，不对前端暴露） |
| createdAt | DateTime | 发帖时间 |
| updatedAt | DateTime | 更新时间 |

#### `TreeholeComment` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| content | String | 评论内容（1-500字） |
| isAnonymous | Boolean | 是否匿名 |
| status | Enum(ContentStatus) | 审核状态 |
| authorId | String | 外键 → User.id |
| postId | String | 外键 → TreeholePost.id |
| parentId | String? | 外键 → TreeholeComment.id（用于嵌套回复） |

#### `Hashtag` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| name | String (unique) | Hashtag 名称（不含 # 号） |
| isBanned | Boolean | 是否被封禁 |

#### `HashtagOnPost` 表（多对多中间表）
| 字段 | 类型 | 说明 |
|------|------|------|
| postId | String | 外键 → TreeholePost.id |
| hashtagId | String | 外键 → Hashtag.id |

### 博客相关

#### `BlogArticle` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| slug | String (unique) | URL 友好标识符（自动生成） |
| title | String | 文章标题 |
| content | String | 文章正文（Markdown/富文本） |
| excerpt | String? | 摘要（可选） |
| coverImage | String? | 封面图 URL（可选） |
| isDraft | Boolean | 是否草稿 |
| status | Enum(ContentStatus) | 审核状态 |
| authorId | String | 外键 → User.id |
| seriesId | String? | 外键 → BlogSeries.id（可选） |

#### `BlogComment` / `BlogSeries` / `Tag` / `TagOnArticle`
与树洞类似，见 `prisma/schema.prisma` 中完整定义。

### 共用功能相关

#### `Like` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| userId | String | 外键 → User.id |
| postId | String | 外键 → TreeholePost.id |
| 联合唯一 | (userId, postId) | 防止重复点赞 |

#### `Report` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| reason | String? | 举报理由（最多500字） |
| contentType | Enum(ContentType) | TREEHOLE_POST/TREEHOLE_COMMENT/BLOG_ARTICLE |
| contentId | String | 被举报内容的 ID |
| reporterId | String | 举报人 ID |

#### `ModerationLog` 表（审核日志）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| contentType | Enum(ContentType) | 内容类型 |
| contentId | String | 内容 ID |
| action | Enum(ModerationAction) | APPROVE/REJECT/DELETE |
| reason | String? | 审核原因 |
| isAutomatic | Boolean | true=LLM自动，false=管理员手动 |
| moderatorId | String? | 操作管理员 ID（自动审核时为 null） |

### 枚举类型
```prisma
enum Role             { USER  ADMIN }
enum ContentStatus    { PUBLISHED  FLAGGED  REJECTED  DELETED }
enum ContentType      { TREEHOLE_POST  TREEHOLE_COMMENT  BLOG_ARTICLE }
enum ModerationAction { APPROVE  REJECT  DELETE }
```

---

## 4. 功能模块详解

### 4.1 用户注册与登录

**注册流程：**
1. 用户填写邮箱（必须 `@nyu.edu`）、密码（≥6位）、显示名称
2. 前端提交到 `POST /api/auth/register`
3. 服务端用 Zod `registerSchema` 校验（`src/lib/validators.ts`）——邮箱自动 `trim().toLowerCase()`
4. 检查邮箱是否已注册（用规范化后的邮箱查库）
5. 用 `bcryptjs.hash(password, 10)` 生成密码哈希
6. 创建 User 记录，跳转到登录页

**相关文件：**
- `src/app/(auth)/register/page.tsx` — 注册表单 UI
- `src/app/api/auth/register/route.ts` — 注册接口
- `src/lib/validators.ts` — registerSchema（@nyu.edu 限制 + email normalize）

**登录流程：**
1. 用户填写邮箱和密码
2. NextAuth Credentials provider 的 `authorize()` 函数处理
3. 对 email 做 `trim().toLowerCase()` 规范化，查库找用户
4. `bcryptjs.compare()` 验密 → 检查是否被封禁
5. 成功后返回用户对象，NextAuth 生成 JWT
6. Session 包含 `id`、`email`、`name`、`role` 字段

**相关文件：**
- `src/app/(auth)/login/page.tsx` — 登录表单 UI
- `src/lib/auth.ts` — NextAuth 配置核心，email normalize + `authorize` 逻辑在这里
- `src/types/next-auth.d.ts` — 扩展 Session 类型以包含 `id` 和 `role`

---

### 4.2 树洞（匿名社区）

**核心概念：** 用户可以发布匿名或实名帖子，支持 hashtag、图片、评论、点赞、举报。

**发帖流程：**
1. 用户填写内容（1-2000字），可选图片、可选 hashtag
2. 前端提交到 `POST /api/treehole`
3. 频率限制检查（每分钟1条）
4. 从内容中提取 `#hashtag`（正则 `/#[\w\u4e00-\u9fa5]+/g`）
5. 检查提取出的 hashtag 是否被封禁，被封禁则拒绝发帖
6. LLM 内容审核（异步，不阻塞）
7. 创建 TreeholePost 记录
8. Upsert Hashtag 记录并创建 HashtagOnPost 关联

**匿名处理：**
- 数据库始终存储 `authorId`（不会删除，管理员可追查）
- API 返回时：`author: isAnonymous ? null : post.author`
- 前端收到 `author: null` 时显示"匿名用户"

**获取帖子列表（`GET /api/treehole`）：**
- 支持 cursor 分页（`cursor` 参数）
- 支持按 hashtag 过滤（`hashtag` 参数）
- 只返回 status=PUBLISHED 的帖子（被标记/拒绝的不显示）
- 每页20条

**相关文件：**
- `src/app/treehole/page.tsx` — 树洞首页
- `src/app/treehole/[id]/page.tsx` — 单帖详情页
- `src/app/api/treehole/route.ts` — 列表获取 & 发帖
- `src/app/api/treehole/[id]/route.ts` — 单帖获取 & 删除
- `src/app/api/treehole/[id]/comments/route.ts` — 发评论
- `src/components/treehole/` — 所有树洞相关 UI 组件

---

### 4.3 博客

**核心概念：** 用户可以发布署名文章，支持标签（Tag）、系列（Series）、评论、举报。

**与树洞的主要区别：**
- 文章有 `slug`（URL标识符，自动从标题生成）
- 文章有 `isDraft` 状态（草稿不公开）
- 支持富文本内容
- 有 Tag 系统（与树洞的 Hashtag 独立）
- 有 Series（系列）功能

**Slug 生成：** 从标题提取，转小写，替换空格为"-"，加随机后缀保证唯一。

**相关文件：**
- `src/app/blog/page.tsx` — 博客列表页
- `src/app/blog/[slug]/page.tsx` — 文章详情页
- `src/app/api/blog/route.ts` — 文章列表 & 创建
- `src/app/api/blog/[slug]/route.ts` — 获取/更新/删除单篇文章

---

### 4.4 图片上传

**设计方案：** 图片上传到服务器本地目录（`/public/uploads/`），URL 以 `/uploads/filename` 形式返回。

**上传限制：**
- 支持格式：JPEG、PNG、GIF、WebP
- 最大体积：5MB
- 每次只能上传1张

**上传流程（`POST /api/upload`）：**
1. 接收 multipart/form-data
2. 校验 MIME 类型（必须是允许的图片格式）
3. 校验文件大小（≤5MB）
4. 生成文件名：`{timestamp}-{random}.{ext}`（扩展名从 MIME 获取，不信任客户端）
5. 写入 `/public/uploads/` 目录
6. 返回 `{ url: "/uploads/filename" }`

**Docker 中的持久化：** `docker-compose.yml` 中将 `uploads_data` volume 挂载到容器的 `/app/public/uploads`，重启/更新不会丢失图片。

**相关文件：**
- `src/app/api/upload/route.ts` — 上传接口
- `docker-compose.yml` — volumes 配置（`uploads_data`）
- 发帖/博客表单中调用此接口并将返回的 URL 存入 `imageUrl` 或 `coverImage` 字段

---

### 4.5 发帖频率限制

**规则：** 每个用户每分钟最多发1条内容（跨树洞帖子、树洞评论、博客文章共用同一个计数池）。

**实现（`src/lib/rate-limit.ts`）：**
```typescript
export async function isRateLimited(userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  // 查询该用户在过去1分钟内是否有发帖/评论/文章
  const [post, comment, article] = await Promise.all([
    prisma.treeholePost.findFirst({ where: { authorId: userId, createdAt: { gte: oneMinuteAgo } } }),
    prisma.treeholeComment.findFirst({ where: { authorId: userId, createdAt: { gte: oneMinuteAgo } } }),
    prisma.blogArticle.findFirst({ where: { authorId: userId, createdAt: { gte: oneMinuteAgo } } }),
  ]);
  return !!(post || comment || article);
}
```

调用方式：在 POST 接口中，创建内容前先 `await isRateLimited(userId)`，返回 true 则返回 429 错误。

**相关文件：**
- `src/lib/rate-limit.ts` — 频率检查函数
- `src/app/api/treehole/route.ts` — 发树洞帖时调用
- `src/app/api/treehole/[id]/comments/route.ts` — 发评论时调用
- `src/app/api/blog/route.ts` — 发博客时调用

---

### 4.6 内容审核（LLM）

**设计方案：** 使用 LLM API 对发帖/评论内容进行自动审核，不合规内容标记为 FLAGGED 进入人工审核队列（不直接删除）。

**实现（`src/lib/moderation.ts`）：**
- 支持 3 个 LLM 提供商：OpenAI、Anthropic（claude-haiku-4-5）、DeepSeek
- 通过环境变量 `LLM_MODERATION_PROVIDER` 和 `LLM_MODERATION_API_KEY` 配置
- 请求超时：8秒（避免阻塞）
- 如果未配置 API Key 或请求失败，自动降级为 `{ flagged: false }`（不影响发帖）

**流程：**
```typescript
const { flagged, reason } = await checkContent(content);
if (flagged) {
  status = "FLAGGED";
  // 创建 ModerationLog 记录（isAutomatic: true）
}
// 无论结果如何，都创建内容（只是 status 不同）
```

**配置方式（`.env`）：**
```
LLM_MODERATION_PROVIDER=anthropic   # 或 openai / deepseek
LLM_MODERATION_API_KEY=sk-ant-xxx
```

**相关文件：**
- `src/lib/moderation.ts` — 审核逻辑
- `src/app/api/treehole/route.ts` — 发帖时调用
- `src/app/api/treehole/[id]/comments/route.ts` — 评论时调用
- `src/app/api/blog/route.ts` — 发博客时调用

---

### 4.7 举报系统

**举报流程：**
1. 用户点击举报按钮，填写理由（可选，最多500字）
2. 提交到对应 report 接口（`/api/treehole/[id]/report` 或 `/api/blog/[slug]/report`）
3. 创建 Report 记录
4. 如果该内容的举报数达到3条，状态改为 FLAGGED

**管理员审核（`GET /api/admin/moderation`）：**
- 返回所有 status=FLAGGED 的内容，以及有 Report 记录的内容
- 管理员可执行 APPROVE（恢复显示）、REJECT（隐藏）、DELETE（删除）

**相关文件：**
- `src/app/api/treehole/[id]/report/route.ts`
- `src/app/api/blog/[slug]/report/route.ts`
- `src/app/api/admin/moderation/route.ts` — 审核队列
- `src/app/api/admin/moderation/[id]/route.ts` — 执行审核操作
- `src/components/shared/` — 举报按钮组件

---

### 4.8 点赞系统

**规则：** 每个用户对每条帖子只能点赞一次（`Like` 表有 `(userId, postId)` 联合唯一约束）。

**流程（`POST /api/treehole/[id]/like`）：**
1. 检查 Like 记录是否存在
2. 存在 → 删除（取消点赞）
3. 不存在 → 创建（点赞）
4. 返回当前点赞数和用户是否已点赞

**相关文件：**
- `src/app/api/treehole/[id]/like/route.ts`
- `src/components/shared/` — 点赞按钮组件

---

### 4.9 Hashtag 系统

**提取逻辑（在 `POST /api/treehole` 中）：**
```typescript
const hashtags = [...content.matchAll(/#[\w\u4e00-\u9fa5]+/g)].map(m => m[0].slice(1));
```

**封禁检查：** 提取 hashtag 后，查询 DB 中是否有 `isBanned=true` 的同名 hashtag，有则拒绝发帖。

**热门 Hashtag（`GET /api/hashtags/trending`）：** 统计最近帖子中各 hashtag 出现次数，返回 top 10。

**管理员管理（`src/app/admin/tags/`）：**
- 查看所有 hashtag 及使用次数
- 可封禁/解禁任意 hashtag

**相关文件：**
- `src/app/api/treehole/route.ts` — hashtag 提取和关联
- `src/app/api/hashtags/trending/route.ts` — 热门 hashtag
- `src/app/api/admin/tags/route.ts` — 管理列表
- `src/app/api/admin/tags/[id]/route.ts` — 封禁/解禁

---

### 4.10 管理员后台

**访问控制：** 所有 `/api/admin/*` 接口都检查 `session.user.role === "ADMIN"`，否则返回 403。前端 `/admin` 页面也有 role 检查。

**功能模块：**

| 功能 | 路由 | 说明 |
|------|------|------|
| 内容审核 | `GET/PATCH /api/admin/moderation` | 查看被标记内容，执行审核操作 |
| 用户管理 | `GET /api/admin/users` | 搜索用户，查看统计 |
| 角色/封禁 | `PATCH /api/admin/users/[id]` | 修改用户角色或封禁状态 |
| Hashtag 管理 | `GET/POST /api/admin/tags` | 查看所有 hashtag |
| 封禁 Hashtag | `PATCH /api/admin/tags/[id]` | 封禁或解禁 hashtag |

**默认管理员账号：** 通过 `prisma/seed.ts` 创建，邮箱 `admin@example.com`，密码 `admin123`（**上线前务必修改**）。

**相关文件：**
- `src/app/admin/` — 管理员页面（客户端）
- `src/app/api/admin/` — 管理员 API（服务端，均含 role 检查）

---

### 4.11 账号注销

**流程（`DELETE /api/user/delete`）：**
使用 Prisma 事务（`$transaction`）按顺序删除：
1. 该用户发出的举报（Report）
2. 对该用户内容的举报（Report）
3. 审核日志（ModerationLog）
4. 树洞评论（TreeholeComment）
5. 树洞帖子（TreeholePost）
6. 博客评论（BlogComment）
7. 博客文章（BlogArticle）
8. 点赞记录（Like）
9. 验证 Token（VerificationToken）
10. 用户本身（User）

> ⚠️ 注意：账号注销操作不可逆，所有内容会被永久删除。前端有二次确认弹窗。

**相关文件：**
- `src/app/api/user/delete/route.ts`
- `src/app/account/page.tsx` — 账号页面（含注销入口）

---

### 4.12 多语言支持（i18n）

**支持语言：** 中文（简体）和英文

**实现方式：**
- `src/lib/i18n.ts` — 所有 UI 字符串的中英文对照表（键值对）
- `src/contexts/language-context.tsx` — React Context，全局存储当前语言（`zh` 或 `en`）
- 组件中用 `useLanguage()` hook 获取当前语言，再用 `t(key)` 获取对应字符串
- 语言偏好存储在 localStorage，刷新后保持

**Navbar 切换：** Navbar 右上角有语言切换按钮（🌐），点击切换 context 中的语言。

**相关文件：**
- `src/lib/i18n.ts` — 翻译字符串
- `src/contexts/language-context.tsx` — Context 定义
- `src/components/layout/Navbar.tsx` — 语言切换按钮
- `src/components/providers.tsx` — LanguageProvider 在这里注入

---

### 4.13 翻译功能

**功能：** 用户可以翻译树洞帖子内容（调用外部翻译 API）。

**实现（`src/app/api/translate/route.ts`）：**
- 接收 `{ text, targetLang }`
- 调用 `src/lib/translate.ts` 中封装的翻译函数
- 支持的目标语言：`en`（英文）、`zh`（中文）

**相关文件：**
- `src/app/api/translate/route.ts` — 翻译接口
- `src/lib/translate.ts` — 翻译 API 调用逻辑

---

## 5. 环境变量说明

文件位置：服务器上 `/app/.env`（不提交到 Git，见 `.env.example` 模板）

```bash
# 数据库（必填）
DATABASE_URL="postgresql://user:password@db:5432/nyu_treehole"

# NextAuth（必填）
AUTH_SECRET="your-strong-random-secret"  # 用 openssl rand -base64 32 生成
AUTH_URL="https://你的域名"

# Docker PostgreSQL 密码
POSTGRES_PASSWORD="your-db-password"

# LLM 内容审核（可选，不配置则不审核）
LLM_MODERATION_PROVIDER="anthropic"   # 或 openai / deepseek
LLM_MODERATION_API_KEY="sk-ant-xxx"
```

---

## 6. 上线部署流程

### 服务器环境
- 服务器 IP：`139.224.81.169`
- 运行方式：Docker Compose（PostgreSQL + Next.js 应用容器）
- 镜像托管：GitHub Container Registry（GHCR）

### 自动部署（GitHub Actions）

每次 push 到 `main`/`master` 分支时，自动触发：

```
代码 push → GitHub Actions 触发
→ docker build（多阶段构建）
→ docker push 到 ghcr.io/highplayerjason-max/nyu-treehole:latest
→ SSH 到服务器执行：
   docker compose pull
   docker compose up -d
   docker compose exec app npx prisma migrate deploy  # 自动迁移 DB
```

配置文件：`.github/workflows/deploy.yml`

**需要在 GitHub Secrets 中配置：**
- `SERVER_HOST` — 服务器 IP
- `SERVER_USER` — SSH 用户名
- `SERVER_SSH_KEY` — SSH 私钥（对应服务器 authorized_keys）
- `GHCR_TOKEN` — GitHub Personal Access Token（packages write 权限）

### 手动部署

如需在服务器上手动操作：
```bash
ssh user@139.224.81.169
cd /path/to/app
docker compose pull
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

### 数据库迁移

修改 `prisma/schema.prisma` 后：
1. 本地运行：`npx prisma migrate dev --name 描述`（生成迁移文件）
2. 将迁移文件提交到 Git
3. 部署时 `prisma migrate deploy` 自动应用到服务器

### Docker 文件说明

**Dockerfile（多阶段构建）：**
```
阶段1 deps:    安装 npm 依赖（npm ci）
阶段2 builder: Prisma generate + npm run build（生成 standalone 输出）
阶段3 runner:  精简生产镜像，只包含运行必需文件
```

**docker-compose.yml：**
```yaml
services:
  db:      # PostgreSQL 16，数据持久化到 postgres_data volume
  app:     # Next.js 应用，80:3000 端口映射
volumes:
  postgres_data:   # 数据库数据
  uploads_data:    # 用户上传图片
```

---

## 7. 常见问题与注意事项

### 邮件发送失败
- 检查 SMTP 环境变量是否正确配置
- Gmail 需要"应用专用密码"，不能用账户原始密码
- 检查防火墙是否允许出站 587/465 端口

### GitHub Actions 构建失败
- 检查 Dockerfile 语法（特别是 `npx prisma generate` 步骤）
- 检查 GitHub Secrets 是否都配置了
- 查看 Actions 日志定位具体错误步骤

### 数据库迁移问题
- 直接 SQL 修改（如 `ALTER TABLE`）不会生成 Prisma 迁移文件，下次 `migrate deploy` 可能冲突
- 应始终通过 `prisma migrate dev` 生成迁移文件

### imageUrl 字段
- 如果服务器数据库还没有 `imageUrl` 列，需要运行：
  ```sql
  ALTER TABLE "TreeholePost" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
  ```
  或通过 Prisma 迁移（推荐）

### 默认管理员账号
上线前必须修改 `prisma/seed.ts` 中的默认管理员密码，或通过管理员后台修改。
默认账号：`admin@example.com` / `admin123`

### 匿名帖子隐私
- 匿名帖子在数据库中仍保存 `authorId`
- 管理员通过后台 API 可以看到真实作者
- 前端永远不会返回匿名帖子的作者信息

### 内容审核降级
- 如果未配置 `LLM_MODERATION_API_KEY`，内容审核会直接跳过（返回 `flagged: false`）
- 这意味着所有内容都会直接发布，依靠人工举报和人工审核

### 本地开发
```bash
# 启动本地 PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16

# 配置 .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/nyu_treehole"
AUTH_SECRET="local-dev-secret"

# 初始化数据库
npx prisma migrate dev
npx prisma db seed

# 启动开发服务器
npm run dev
```
