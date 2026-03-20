# NYU树洞 (NYU Treehole)

NYU学生社区平台，集成了 **树洞**（匿名社交）、**博客**（文章发布）、**课评**（课程评价，开发中）三大功能模块。

**GitHub：** https://github.com/highplayerjason-max/nyu-treehole
**线上地址：** http://139.224.81.169
**开发文档：** [ARCHITECTURE.md](./ARCHITECTURE.md) | **更新日志：** [CHANGELOG.md](./CHANGELOG.md)

---

## 功能概览

### 树洞 (TreeHole)
- 类似微博/Twitter 的社交信息流
- 支持匿名发帖（登录后可选择是否匿名）
- `#话题标签` 自动提取和聚合
- 支持附带一张图片（JPEG/PNG/GIF/WebP，最大 5MB）
- 点赞、评论（支持嵌套回复）
- 举报机制：满 3 次举报自动进入人工审核队列

### 博客 (Blog)
- 个人文章发布与编辑（支持草稿、封面图）
- 支持连载/系列文章
- 标签分类与全文搜索
- 作者个人文章管理

### 课评 (Course Reviews)
- 目前为 Coming Soon 状态
- 预留了完整的路由和页面框架，方便后续开发

### 通用功能
- 用户注册/登录（仅限 `@nyu.edu` 邮箱，邮箱统一规范化存储）
- 账号注销（一键级联删除所有个人数据）
- 发帖频率限制（每用户每分钟最多1条，跨帖子/评论/博客共享）
- 用户/管理员角色区分
- 管理员后台（用户管理、内容审核队列、Hashtag 管理）
- 可插拔 LLM 内容审核（支持 OpenAI / Anthropic / DeepSeek，不配置则跳过）
- 举报系统（3 次举报自动标记进审核队列）
- 中英文多语言切换（i18n）
- 帖子内容一键翻译

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript 5 |
| UI | shadcn/ui v4 (@base-ui/react) + Tailwind CSS v4 |
| 数据库 | PostgreSQL 16 + Prisma v6 |
| 认证 | NextAuth.js v5 (Credentials, JWT) |
| 表单校验 | Zod v4 |
| 邮件发送 | Nodemailer v8 (SMTP) |
| 密码加密 | bcryptjs |
| 部署 | Docker Compose (standalone 模式) |
| CI/CD | GitHub Actions → GHCR → SSH 部署 |

---

## 项目结构

```
website/
├── prisma/
│   ├── schema.prisma          # 所有数据库表结构定义（唯一真相来源）
│   └── seed.ts                # 初始种子数据（创建默认管理员账号）
├── src/
│   ├── app/
│   │   ├── (auth)/            # 登录/注册页面（路由组，不影响URL）
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── admin/             # 管理员后台页面（需 ADMIN 角色）
│   │   │   ├── page.tsx       #   内容审核队列
│   │   │   ├── users/         #   用户管理
│   │   │   └── tags/          #   Hashtag 管理
│   │   ├── account/           # 用户个人主页 & 账号注销
│   │   ├── blog/              # 博客前端页面
│   │   ├── treehole/          # 树洞前端页面
│   │   ├── courses/           # 课评（Coming Soon 占位）
│   │   ├── verify-email/      # 邮箱验证码输入页
│   │   ├── api/               # 所有后端 API（Server 端，不打包到客户端）
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/   # NextAuth 内置路由
│   │   │   │   ├── register/        # POST 注册接口
│   │   │   │   ├── verify-email/    # POST 验证码校验接口
│   │   │   │   └── resend-verification/ # POST 重发验证码
│   │   │   ├── treehole/
│   │   │   │   ├── route.ts         # GET 帖子列表 / POST 发帖
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts     # GET 单帖 / DELETE 删除
│   │   │   │       ├── comments/    # POST 发评论
│   │   │   │       ├── like/        # POST 点赞/取消点赞
│   │   │   │       └── report/      # POST 举报
│   │   │   ├── blog/
│   │   │   │   ├── route.ts         # GET 文章列表 / POST 发文章
│   │   │   │   └── [slug]/
│   │   │   │       ├── route.ts     # GET/PUT/DELETE 文章
│   │   │   │       ├── comments/    # POST 发评论
│   │   │   │       └── report/      # POST 举报
│   │   │   ├── admin/
│   │   │   │   ├── moderation/      # GET 审核队列 / PATCH 执行审核
│   │   │   │   ├── users/           # GET 用户列表 / PATCH 修改角色封禁
│   │   │   │   └── tags/            # GET/POST/PATCH Hashtag 管理
│   │   │   ├── user/
│   │   │   │   └── delete/          # DELETE 账号注销
│   │   │   ├── upload/              # POST 图片上传
│   │   │   ├── hashtags/trending/   # GET 热门 hashtag
│   │   │   └── translate/           # POST 翻译接口
│   │   ├── layout.tsx               # 根布局（注入 SessionProvider + LanguageProvider）
│   │   └── page.tsx                 # 首页（重定向到树洞）
│   ├── components/
│   │   ├── ui/                # shadcn/ui 基础组件（Button、Input、Card 等）
│   │   ├── layout/            # Navbar、Sidebar
│   │   ├── treehole/          # 树洞业务组件（帖子卡片、评论区、发帖表单）
│   │   ├── blog/              # 博客业务组件（文章卡片、编辑器、评论）
│   │   ├── shared/            # 通用组件（LikeButton、ReportButton）
│   │   └── providers.tsx      # 客户端 Provider 包裹
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置核心（authorize 逻辑在这里）
│   │   ├── email.ts           # 邮件发送（验证码生成 + HTML 模板 + SMTP）
│   │   ├── prisma.ts          # Prisma 单例客户端（防止 dev 热重载多实例）
│   │   ├── rate-limit.ts      # 发帖频率限制（每分钟1条，跨三张表共享）
│   │   ├── moderation.ts      # LLM 内容审核（OpenAI/Anthropic/DeepSeek）
│   │   ├── validators.ts      # Zod 输入校验 schema（所有接口校验在这里）
│   │   ├── i18n.ts            # 中英文翻译字符串
│   │   ├── translate.ts       # 翻译 API 调用逻辑
│   │   └── utils.ts           # 工具函数（cn: Tailwind class 合并）
│   ├── types/
│   │   └── next-auth.d.ts     # 扩展 NextAuth Session 类型（添加 id、role 字段）
│   └── contexts/
│       └── language-context.tsx  # 语言切换全局 Context（存 localStorage）
├── public/
│   └── uploads/               # 用户上传图片（Docker volume 挂载，重启不丢失）
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD：构建 Docker 镜像推送 GHCR，SSH 部署服务器
├── Dockerfile                 # 多阶段构建（deps → builder → runner）
├── docker-compose.yml         # 服务编排：db（PostgreSQL）+ app（Next.js）
├── .env.example               # 环境变量模板（不含真实值，可安全提交 Git）
├── ARCHITECTURE.md            # 开发者详细文档（功能实现逻辑、DB 设计、部署）
└── CHANGELOG.md               # 版本更新日志
```

---

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 20
- [PostgreSQL](https://www.postgresql.org/) >= 14（或使用 Docker）
- [Git](https://git-scm.com/)

### 方式一：本地开发（推荐新手）

**1. 克隆项目**

```bash
git clone https://github.com/highplayerjason-max/nyu-treehole.git
cd nyu-treehole
```

**2. 安装依赖**

```bash
npm install
```

**3. 配置环境变量**

```bash
cp .env.example .env
```

`.env` 文件内容说明：

```env
# 数据库连接（必填）
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/student_community"

# NextAuth 密钥（必填，生产环境请更换为随机字符串）
AUTH_SECRET="change-this-to-a-random-secret-in-production"
AUTH_URL="http://localhost:3000"

# LLM 内容审核（选填，不填则跳过自动审核）
LLM_MODERATION_PROVIDER=""   # "openai" 或 "anthropic" 或 "deepseek"
LLM_MODERATION_API_KEY=""
```

**4. 启动 PostgreSQL 数据库**

如果本地没有 PostgreSQL，用 Docker 快速启动：

```bash
docker run -d \
  --name student-community-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=student_community \
  -p 5432:5432 \
  postgres:16-alpine
```

**5. 初始化数据库**

```bash
npx prisma generate          # 生成 Prisma 客户端
npx prisma migrate dev       # 创建所有数据表
npx prisma db seed           # 创建初始管理员账号
```

> 默认管理员账号：`admin@example.com` / `admin123`
> ⚠️ 生产环境请立即修改此密码！

**6. 启动开发服务器**

```bash
npm run dev
```

打开浏览器访问 http://localhost:3000

---

### 方式二：VPS 服务器部署（生产环境）

适合部署到阿里云、腾讯云等 Linux 服务器。

**服务器要求：** Ubuntu 22.04+，最低 2核2G（需要添加 swap）

#### 第一步：准备服务器

SSH 登录服务器后，先添加 2GB swap 防止内存溢出：

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

#### 第二步：安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

如果在国内服务器，配置镜像加速：

```bash
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
systemctl daemon-reload && systemctl restart docker
```

#### 第三步：部署应用

```bash
git clone https://github.com/highplayerjason-max/nyu-treehole.git /root/nyu-treehole
cd /root/nyu-treehole

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实值

# 拉取预构建镜像并启动
docker compose pull
docker compose up -d

# 初始化数据库（首次）
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

#### 常用运维命令

```bash
docker compose logs -f app        # 查看实时日志
docker compose restart app        # 重启应用
docker compose exec db pg_dump -U postgres student_community > backup.sql  # 备份数据库
```

---

### 方式三：Docker 本地一键启动

```bash
git clone https://github.com/highplayerjason-max/nyu-treehole.git
cd nyu-treehole
cp .env.example .env
docker compose up -d
sleep 30
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

访问 http://localhost 即可。

---

## 开发指南

### 添加新的 API 路由

```typescript
// src/app/api/your-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 你的逻辑...
  return NextResponse.json({ data: "hello" });
}
```

### 修改数据库模型

```bash
# 1. 编辑 prisma/schema.prisma
# 2. 生成迁移文件（提交到 Git）
npx prisma migrate dev --name describe-your-change
# 3. Prisma 客户端自动更新，无需手动操作
```

> ⚠️ 直接执行 SQL（如 `ALTER TABLE`）会绕过 Prisma 迁移系统，下次 `migrate deploy` 可能报冲突。始终通过 `prisma migrate dev` 生成迁移文件。

### 开发课评模块（参考思路）

课评路由已预留在 `src/app/courses/`，开发步骤：

1. **数据模型** — 在 `prisma/schema.prisma` 添加 `Course`、`CourseReview` 等模型，运行迁移
2. **API** — 在 `src/app/api/courses/` 参照 `treehole/` 结构添加 CRUD 路由
3. **频率限制** — 在 `src/lib/rate-limit.ts` 中加入 CourseReview 表查询
4. **前端页面** — 在 `src/app/courses/` 开发列表页、详情页
5. **复用组件** — `ReportButton`、`LikeButton` 可直接复用
6. **接入审核** — 调用 `checkContent()` 即可，Report 模型的 `ContentType` enum 需新增 `COURSE_REVIEW`

### 配置 LLM 内容审核

```env
# DeepSeek（推荐，国内速度快、费用低）
LLM_MODERATION_PROVIDER="deepseek"
LLM_MODERATION_API_KEY="sk-..."

# OpenAI
LLM_MODERATION_PROVIDER="openai"
LLM_MODERATION_API_KEY="sk-..."

# Anthropic Claude
LLM_MODERATION_PROVIDER="anthropic"
LLM_MODERATION_API_KEY="sk-ant-..."
```

不配置时系统正常运行，仅跳过自动审核，依赖用户举报 + 管理员人工处理。

### shadcn/ui v4 注意事项

本项目使用 shadcn/ui v4，底层基于 `@base-ui/react`（非 Radix UI）。
Button 组件渲染为链接时，**必须加 `nativeButton={false}`**：

```tsx
// ✅ 正确
<Button nativeButton={false} render={<Link href="/path" />}>
  点击跳转
</Button>

// ❌ 错误（会有控制台警告）
<Button render={<Link href="/path" />}>
  点击跳转
</Button>
```

---

## 常用命令速查

```bash
# 开发
npm run dev              # 启动开发服务器（localhost:3000）
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 数据库
npx prisma generate      # 生成 Prisma 客户端
npx prisma migrate dev   # 创建并执行迁移（开发环境）
npx prisma migrate deploy # 执行迁移（生产环境）
npx prisma studio        # 数据库可视化管理界面
npx prisma db seed       # 执行种子数据

# Docker
docker compose up -d     # 后台启动所有服务
docker compose down      # 停止所有服务
docker compose logs -f   # 查看实时日志
docker compose ps        # 查看容器状态
```

---

## 注意事项

- `.env` 包含敏感信息，已被 `.gitignore` 排除，**绝不要提交到 Git**
- 生产环境务必将 `AUTH_SECRET` 改为强随机字符串（`openssl rand -hex 32`）
- 种子数据中的管理员密码 `admin123` 仅供开发，**生产环境请立即修改**
- 匿名帖子在数据库中仍保存 `authorId`，管理员始终可查看真实身份
- 2GB 内存服务器部署时**必须配置 swap**，否则 Docker 构建会 OOM
- 图片上传存在 `public/uploads/`，Docker volume `uploads_data` 保证重启不丢失

---

## 在线测试指南

> 适合任何人，无需懂代码。

### 访问地址

| 环境 | 地址 |
|------|------|
| 线上（生产） | http://139.224.81.169 |
| 本地开发 | http://localhost:3000 |

### 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@example.com | admin123 |

> ⚠️ 生产环境请在测试完成后立即修改密码。

### 功能测试清单

#### ✅ 1. 注册 / 登录

1. 打开网站，点击右上角 **注册**
2. 填写显示名称、`@nyu.edu` 邮箱、密码（≥6位），提交
3. 注册成功后直接跳转登录页，用相同邮箱密码登录
4. 登录后右上角显示用户名
5. 用管理员账号登录，导航栏出现红色 **管理后台** 链接

#### ✅ 2. 树洞 — 发帖

1. 点击导航栏 **树洞** → **发布**
2. 输入内容（如 `今天天气不错 #NYU #随笔`），可选上传图片、勾选匿名
3. 发布后帖子出现在列表顶部，`#NYU` 变成可点击标签

#### ✅ 3. 树洞 — 互动

- **评论/嵌套回复**：进入帖子详情页发送评论
- **点赞**：点击 ♡ 图标，数字+1；再点取消
- **举报**：点击 ⚠ 按钮，同一内容举报3次后进入审核队列

#### ✅ 4. 博客

1. 点击 **博客** → **写文章**，填写标题和正文，添加标签，发布
2. 在文章详情页底部发表评论
3. 博客列表支持关键词搜索

#### ✅ 5. 管理员后台

- **用户管理**：修改角色（USER ↔ ADMIN）、封禁账号
- **内容审核**：查看被举报/LLM标记的内容，执行通过/拒绝/删除
- **Hashtag 管理**：封禁违规 hashtag（封禁后无法发含该标签的帖子）

#### ✅ 6. 账号注销

- 个人主页 → **账号设置** → **注销账号**（二次确认后删除所有数据）

#### ✅ 7. 发帖频率限制

- 快速连续发两条帖子，第二条应返回"操作太频繁"提示（每分钟限1条）

---

## License

MIT

---

> 详细的功能实现逻辑、数据库设计、API 说明请阅读 [ARCHITECTURE.md](./ARCHITECTURE.md)。
> 各版本变更记录请查看 [CHANGELOG.md](./CHANGELOG.md)。
