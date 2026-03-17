# 学生社群 (Student Community)

一个面向学生群体的社群平台，集成了 **树洞**（匿名社交）、**博客**（文章发布）、**课评**（课程评价，开发中）三大功能模块。

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

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| UI | shadcn/ui v4 + Tailwind CSS v4 |
| 数据库 | PostgreSQL + Prisma v6 |
| 认证 | NextAuth.js v5 (Credentials) |
| 校验 | Zod v4 |
| 部署 | Docker Compose |

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 20
- [PostgreSQL](https://www.postgresql.org/) >= 14（或使用 Docker）
- [Git](https://git-scm.com/)

### 方式一：本地开发（推荐新手）

**1. 克隆项目**

```bash
git clone https://github.com/你的用户名/student-community.git
cd student-community
```

**2. 安装依赖**

```bash
npm install
```

**3. 配置环境变量**

复制示例文件并修改：

```bash
cp .env.example .env
```

`.env` 文件内容说明：

```env
# 数据库连接（必填）
# 格式: postgresql://用户名:密码@地址:端口/数据库名
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/student_community"

# NextAuth 密钥（必填，生产环境请更换为随机字符串）
AUTH_SECRET="change-this-to-a-random-secret-in-production"
AUTH_URL="http://localhost:3000"

# LLM 内容审核（选填，不填则跳过自动审核）
# 提供商: "openai" 或 "anthropic"
LLM_MODERATION_PROVIDER=""
# 对应的 API Key
LLM_MODERATION_API_KEY=""
```

**4. 启动 PostgreSQL 数据库**

如果你本地没有 PostgreSQL，最简单的方式是用 Docker 启动一个：

```bash
docker run -d \
  --name student-community-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=student_community \
  -p 5432:5432 \
  postgres:16-alpine
```

或者你已经安装了 PostgreSQL，手动创建数据库：

```sql
CREATE DATABASE student_community;
```

**5. 初始化数据库**

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移（创建所有表）
npx prisma migrate dev --name init

# 填充初始数据（创建管理员账号）
npx prisma db seed
```

> 种子数据会创建一个管理员账号：
> - 邮箱: `admin@example.com`
> - 密码: `admin123`
> - **请在生产环境中立即更改此密码！**

**6. 启动开发服务器**

```bash
npm run dev
```

打开浏览器访问 http://localhost:3000

### 方式二：Docker 一键部署

适合不想手动配置环境的用户，或者生产环境部署：

```bash
# 克隆项目
git clone https://github.com/你的用户名/student-community.git
cd student-community

# 创建 .env 文件（至少配置 AUTH_SECRET）
cp .env.example .env
# 编辑 .env，将 AUTH_SECRET 改为一个随机字符串

# 一键启动（数据库 + 应用）
docker compose up -d

# 运行数据库迁移
docker compose exec app npx prisma migrate deploy

# 填充初始数据
docker compose exec app npx prisma db seed
```

访问 http://localhost:3000 即可使用。

## 项目结构

```
student-community/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 种子数据（初始管理员）
├── src/
│   ├── app/
│   │   ├── (auth)/            # 登录/注册页面
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── admin/             # 管理员后台
│   │   │   ├── moderation/    #   审核队列
│   │   │   └── users/         #   用户管理
│   │   ├── api/               # API 路由
│   │   │   ├── auth/          #   认证相关
│   │   │   ├── admin/         #   管理员 API
│   │   │   ├── treehole/      #   树洞 API
│   │   │   └── blog/          #   博客 API
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
│   │   └── shared/            # 共享组件（点赞、举报按钮）
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置
│   │   ├── prisma.ts          # Prisma 客户端单例
│   │   ├── moderation.ts      # LLM 内容审核服务
│   │   └── validators.ts      # Zod 表单校验
│   └── types/
│       └── next-auth.d.ts     # NextAuth 类型扩展
├── docker-compose.yml         # Docker 编排
├── Dockerfile                 # 生产镜像构建
└── .env.example               # 环境变量示例
```

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器（默认 3000 端口）
npm run build            # 构建生产版本
npm run start            # 启动生产服务器

# 数据库
npx prisma generate      # 生成 Prisma 客户端（修改 schema 后执行）
npx prisma migrate dev   # 创建并执行迁移（开发环境）
npx prisma migrate deploy # 执行迁移（生产环境）
npx prisma studio        # 打开数据库可视化管理界面
npx prisma db seed       # 执行种子数据

# Docker
docker compose up -d     # 后台启动所有服务
docker compose down      # 停止所有服务
docker compose logs -f   # 查看实时日志
```

## 开发指南

### 添加新的 API 路由

在 `src/app/api/` 下创建文件夹和 `route.ts`：

```typescript
// src/app/api/your-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // 获取当前登录用户（如需鉴权）
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 你的逻辑...
  return NextResponse.json({ data: "hello" });
}
```

### 添加新的页面

在 `src/app/` 下创建文件夹和 `page.tsx`：

```typescript
// src/app/your-page/page.tsx
export default function YourPage() {
  return <div>你的页面内容</div>;
}
```

### 修改数据库模型

1. 编辑 `prisma/schema.prisma`
2. 运行迁移：`npx prisma migrate dev --name describe-your-change`
3. Prisma 客户端会自动重新生成

### 开发课评模块（参考思路）

课评模块的基础路由已经搭好（`src/app/courses/page.tsx`），后续开发可以参考以下步骤：

1. **设计数据模型** — 在 `prisma/schema.prisma` 中添加课程和评价相关的 Model（比如 `Course`、`CourseReview`）
2. **创建 API** — 在 `src/app/api/courses/` 下添加 CRUD 路由
3. **开发前端页面** — 在 `src/app/courses/` 下创建列表页、详情页等
4. **复用现有组件** — 举报按钮（`ReportButton`）、点赞按钮（`LikeButton`）等可以直接使用
5. **接入审核系统** — 调用 `checkContent()` 进行内容审核，复用 Report 模型实现举报

### 配置 LLM 内容审核

系统支持两种 LLM 审核提供商，在 `.env` 中配置即可：

**使用 OpenAI：**
```env
LLM_MODERATION_PROVIDER="openai"
LLM_MODERATION_API_KEY="sk-your-openai-key"
```

**使用 Anthropic (Claude)：**
```env
LLM_MODERATION_PROVIDER="anthropic"
LLM_MODERATION_API_KEY="sk-ant-your-anthropic-key"
```

不配置时系统正常运行，只是跳过自动审核，依赖用户举报 + 管理员人工审核。

### 管理员操作

1. 使用管理员账号登录后，导航栏会出现 **"管理后台"** 入口
2. **仪表盘**：查看用户数、帖子数、待审核内容数等统计
3. **用户管理**：封禁/解封用户、修改用户角色
4. **审核队列**：处理被举报或 LLM 标记的内容（通过/拒绝/删除）

## 注意事项

- `.env` 文件包含敏感信息，已被 `.gitignore` 排除，**绝不要提交到 Git**
- 生产环境务必修改 `AUTH_SECRET` 为强随机字符串
- 种子数据中的管理员密码 `admin123` 仅供开发使用，生产环境请立即更改
- 匿名帖子在数据库中仍保存 `authorId`，管理员始终可以查看真实身份
- 当前富文本编辑器为简化版（textarea + HTML 预览），后续可升级为 Tiptap 等所见即所得编辑器

## License

MIT
