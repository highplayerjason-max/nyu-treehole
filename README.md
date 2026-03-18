# NYU树洞 (NYU Treehole)

NYU学生社区平台，集成了 **树洞**（匿名社交）、**博客**（文章发布）、**课评**（课程评价，开发中）三大功能模块。

**GitHub：** https://github.com/highplayerjason-max/nyu-treehole

---

## 功能概览

### 树洞 (TreeHole)
- 类似微博/Twitter 的社交信息流
- 支持匿名发帖（登录后可选择是否匿名）
- `#话题标签` 自动提取和聚合
- 点赞、评论（支持嵌套回复）
- 举报机制：满 3 次举报自动进入人工审核队列

### 博客 (Blog)
- 个人文章发布与编辑
- 支持连载/系列文章
- 标签分类与全文搜索
- 作者个人文章管理

### 课评 (Course Reviews)
- 目前为 Coming Soon 状态
- 预留了完整的路由和页面框架，方便后续开发

### 通用功能
- 用户注册/登录（邮箱 + 密码）
- 用户/管理员角色区分
- 管理员后台（数据统计、用户管理、内容审核队列）
- 可插拔的 LLM 内容审核（支持 OpenAI / Anthropic，不配置则跳过审核）
- 举报系统（3 次举报自动标记，进入审核队列）

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript |
| UI | shadcn/ui v4 (@base-ui/react) + Tailwind CSS v4 |
| 数据库 | PostgreSQL + Prisma v6 |
| 认证 | NextAuth.js v5 (Credentials) |
| 校验 | Zod v4 |
| 部署 | Docker Compose (standalone 模式) |

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
LLM_MODERATION_PROVIDER=""   # "openai" 或 "anthropic"
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
# 添加 2GB swap（防止 Docker 构建时 OOM）
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
# 克隆代码
git clone https://github.com/highplayerjason-max/nyu-treehole.git /root/nyu-treehole
cd /root/nyu-treehole

# 配置环境变量（根据实际情况修改）
cat > .env <<EOF
DATABASE_URL=postgresql://postgres:SecurePass2024@db:5432/student_community
POSTGRES_PASSWORD=SecurePass2024
AUTH_SECRET=$(openssl rand -hex 32)
AUTH_URL=http://你的服务器IP
LLM_MODERATION_API_KEY=sk-...       # DeepSeek/OpenAI API Key（可选）
LLM_MODERATION_PROVIDER=deepseek
PORT=3000
HOSTNAME=0.0.0.0
EOF

# 拉取预构建镜像并启动（无需本地编译，速度快，不会 OOM）
docker compose pull
docker compose up -d
```

> **提示**：本项目通过 GitHub Actions 在云端构建 Docker 镜像，服务器只需 `docker pull`，**不需要本地编译**，2GB 内存完全够用。

初始化数据库（首次部署）：
```bash
# 手动执行 SQL 迁移（Prisma CLI 未包含在生产镜像中）
for f in prisma/migrations/*/migration.sql; do
  docker exec nyu-treehole-db-1 psql -U postgres -d student_community < "$f"
done

# 创建管理员账号（邮箱：admin@example.com 密码：admin123）
HASH=$(docker run --rm node:20-alpine node -e \
  "const b=require('bcryptjs');b.hash('admin123',10).then(h=>process.stdout.write(h))")
docker exec nyu-treehole-db-1 psql -U postgres -d student_community -c \
  "INSERT INTO \"User\" (id,email,\"passwordHash\",\"displayName\",role,\"createdAt\",\"updatedAt\") \
   VALUES (gen_random_uuid(),'admin@example.com','$HASH','管理员','ADMIN',NOW(),NOW()) \
   ON CONFLICT (email) DO NOTHING;"
```

#### 第四步：验证部署

```bash
docker compose ps           # 确认两个容器都是 running
curl http://localhost        # 应返回 HTML 内容
```

访问 `http://你的服务器IP` 即可使用。

#### 常用运维命令

```bash
# 查看日志
docker compose logs -f app

# 更新代码后重新部署
git pull origin master
docker compose up -d --build

# 重启应用
docker compose restart app

# 备份数据库
docker compose exec db pg_dump -U postgres student_community > backup.sql
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

## 项目结构

```
student-community/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 种子数据（初始管理员）
├── src/
│   ├── app/
│   │   ├── (auth)/            # 登录/注册页面
│   │   ├── admin/             # 管理员后台
│   │   │   ├── moderation/    #   内容审核队列
│   │   │   └── users/         #   用户管理
│   │   ├── api/               # API 路由
│   │   │   ├── auth/          #   认证
│   │   │   ├── admin/         #   管理员接口
│   │   │   ├── treehole/      #   树洞接口
│   │   │   └── blog/          #   博客接口
│   │   ├── blog/              # 博客前端页面
│   │   ├── treehole/          # 树洞前端页面
│   │   ├── courses/           # 课评页面（Coming Soon）
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/
│   │   ├── ui/                # shadcn/ui 基础组件
│   │   ├── layout/            # 导航栏等布局组件
│   │   ├── treehole/          # 树洞业务组件
│   │   ├── blog/              # 博客业务组件
│   │   └── shared/            # 共享组件（点赞、举报）
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置
│   │   ├── prisma.ts          # Prisma 客户端单例
│   │   ├── moderation.ts      # LLM 内容审核服务
│   │   └── validators.ts      # Zod 表单校验
│   └── types/
│       └── next-auth.d.ts     # NextAuth 类型扩展
├── docker-compose.yml         # Docker 编排
├── Dockerfile                 # 生产镜像（standalone 模式）
├── .env.example               # 环境变量示例
└── DEVLOG.md                  # 开发日志
```

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
# 2. 生成迁移
npx prisma migrate dev --name describe-your-change
# 3. Prisma 客户端自动更新
```

### 开发课评模块（参考思路）

课评的路由已预留在 `src/app/courses/`，开发步骤：

1. **数据模型** — 在 `prisma/schema.prisma` 添加 `Course`、`CourseReview` 等 Model
2. **API** — 在 `src/app/api/courses/` 添加 CRUD 路由
3. **前端页面** — 在 `src/app/courses/` 开发列表页、详情页
4. **复用组件** — `ReportButton`、`LikeButton` 可直接使用
5. **接入审核** — 调用 `checkContent()` + 复用 `Report` 模型

### 配置 LLM 内容审核

```env
# 使用 DeepSeek（推荐，国内速度快、费用低）
LLM_MODERATION_PROVIDER="deepseek"
LLM_MODERATION_API_KEY="sk-..."

# 使用 OpenAI
LLM_MODERATION_PROVIDER="openai"
LLM_MODERATION_API_KEY="sk-..."

# 使用 Anthropic Claude
LLM_MODERATION_PROVIDER="anthropic"
LLM_MODERATION_API_KEY="sk-ant-..."
```

不配置时系统正常运行，仅跳过自动审核，由用户举报 + 管理员人工处理。

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
- 富文本编辑器目前为 textarea + HTML 预览，后续可升级为所见即所得编辑器

---

## 在线测试指南

> 适合任何人，无需懂代码。按顺序走完下面的步骤，就能验证所有功能是否正常。

### 访问地址

| 环境 | 地址 |
|------|------|
| 线上（生产） | http://139.224.81.169 |
| 本地开发 | http://localhost:3000 |

---

### 测试账号（由种子数据自动创建）

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin@example.com | admin123 | 可访问管理后台 |
> ⚠️ 生产环境请在测试完成后立即修改密码。

---

### 功能测试清单

#### ✅ 1. 注册 / 登录

1. 打开网站，点击右上角 **注册**
2. 填写用户名、邮箱、密码（≥8位），提交
3. 注册成功后会自动跳转到首页，右上角显示用户头像
4. 点击头像 → **退出登录**，再用管理员账号登录：
   - 邮箱：`admin@example.com` 密码：`admin123`
5. 登录后导航栏出现红色 **管理后台** 链接 → 说明管理员权限正常

---

#### ✅ 2. 树洞 — 发帖

1. 点击导航栏 **树洞**
2. 点击 **发布** 按钮，在弹框中输入内容，例如：
   ```
   今天天气不错 #NYU #随笔
   ```
3. 可以勾选 **匿名** 开关（匿名帖子显示"匿名用户"，但管理员后台仍可查看真实作者）
4. 点击 **发布** → 帖子出现在列表顶部
5. 验证：帖子里的 `#NYU`、`#随笔` 变成蓝色可点击链接，点击后可筛选同话题的帖子

---

#### ✅ 3. 树洞 — 评论 / 点赞 / 举报

1. 点击任意一条帖子，进入详情页
2. **评论**：在评论框手动输入文字，点击 **发送**，评论出现在列表
3. **嵌套回复**：点击某条评论下的 **回复**，输入内容发送
4. **点赞**：点击帖子左下角的 ♡ 图标，数字加 1
5. **举报**：点击 ⚠ 举报按钮，选择原因提交
   - 同一内容被举报 **3 次**后，会自动进入管理员审核队列

---

#### ✅ 4. 博客 — 写文章 / 评论

1. 点击导航栏 **博客** → **写文章**
2. 填写标题和正文，添加标签（如 `学习,经验`），点击 **发布文章**
3. 文章发布后跳转到详情页，页面底部有 **评论区**
4. 在评论框输入内容，点击 **发表评论**，评论出现在列表
5. 回到博客列表，可以用搜索框按关键词查找文章

---

#### ✅ 5. 管理员后台

用管理员账号登录后：

1. 点击红色 **管理后台** 链接

2. **数据概览**：查看注册用户数、帖子数、文章数、举报数

3. **用户管理**：
   - 可以修改用户角色（`USER` ↔ `ADMIN`）
   - 可以禁用/激活账号

4. **内容审核**（举报队列）：
   - 对任意帖子举报 3 次后，刷新此页面，该帖子出现在审核队列
   - 可以选择 **通过**（恢复显示）或 **删除**

---

#### ✅ 6. AI 内容审核（DeepSeek）

本项目已配置 DeepSeek API，发帖时会自动调用 AI 检测内容。

测试方法：
1. 用普通账号发一条包含明显违规词汇的帖子
2. 如果 AI 判断为违规，帖子会被直接标记，页面弹出提示
3. 在管理后台 → **内容审核** 中可以看到被标记的内容

> 如需关闭 AI 审核，将 `.env` 中的 `LLM_MODERATION_API_KEY` 清空即可。

---

#### ✅ 7. 完整流程验证（End-to-End）

按以下顺序跑一遍，确认整个系统联通：

```
注册新用户 → 登录 → 发树洞帖子（带标签）→ 点赞 → 评论
→ 另一账号举报 3 次 → 管理员登录 → 审核队列出现该帖 → 处理
→ 写博客文章 → 博客评论 → 搜索文章
```

---

### 常见问题排查

| 现象 | 可能原因 | 解决方法 |
|------|----------|----------|
| 页面空白 / 报错 | 容器未启动 | `docker compose logs app` 查看日志 |
| 登录失败 | AUTH_SECRET 未配置 | 检查 `.env` 文件 |
| 评论/发帖返回 400 | 输入框为空提交 | 确保内容不为空再点发送 |
| 管理后台看不到用户 | 用了普通账号 | 必须用 admin 账号登录 |
| AI 审核不生效 | API Key 未填 | 检查 `.env` 中的 `LLM_MODERATION_API_KEY` |

---

## License

MIT

---

## Status Note (2026-03-19)

### Email Verification

The repo already enforces `@nyu.edu` registration in both frontend and backend,
and unverified users are blocked from login. However, the email verification
feature is still in a mixed state and should be treated as work-in-progress.

Current blocker:
- some auth routes still expect token-link verification
- `src/lib/email.ts` is being adapted toward a 6-digit code flow
- the verify page and APIs are not yet unified around one single approach

Recommended next step:
1. choose one verification strategy only
2. either keep token-link verification and make the mail sender match it
3. or switch fully to a 6-digit code flow with hashed storage, expiry, resend cooldown, and a dedicated verify API

Until that is finished, do not treat email verification as production-ready.

### Git Hygiene

`.gitignore` already ignores `.env*` while keeping `.env.example` committed as a
template. Do not commit real SMTP credentials, API keys, or local build output.
