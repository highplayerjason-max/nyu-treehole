# NYU树洞

NYU 学生社区平台，当前包含树洞、博客、账号系统和管理员后台。

## 当前状态

- 唯一上线分支：`main`
- 生产部署：GitHub Actions -> GHCR -> 服务器 `docker compose pull && docker compose up -d`
- 注册方式：仅允许 `@nyu.edu` 邮箱，注册后需点击邮件链接完成验证
- 注销账号：删除用户数据库记录，并尝试删除该用户上传到 `/uploads` 的本地图片文件

## 技术栈

- Next.js 16 + TypeScript
- PostgreSQL + Prisma
- NextAuth v5（账号密码登录）
- Zod
- Nodemailer（SMTP 发验证邮件）
- Docker Compose

## 关键目录

```text
src/app/(auth)          登录 / 注册页面
src/app/verify-email    邮箱验证提示页
src/app/api             所有后端接口
src/lib/auth.ts         登录鉴权
src/lib/email.ts        邮件发送
src/lib/email-verification.ts  邮箱验证 token 逻辑
src/lib/uploads.ts      本地上传文件删除工具
prisma/schema.prisma    数据库结构唯一真相
.github/workflows/deploy.yml   自动部署
deploy/server-setup.sh  首次初始化服务器
deploy/deploy.sh        手动部署兜底脚本
```

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板

```bash
cp .env.example .env
```

3. 本地开发建议保持：

```env
AUTH_URL="http://localhost:3000"
EMAIL_DELIVERY_MODE="log"
```

这样注册时不会真发邮件，验证链接会打印到服务端日志，方便调试。

4. 准备数据库并执行迁移

```bash
npx prisma generate
npx prisma migrate dev
```

5. 启动开发服务器

```bash
npm run dev
```

## 生产环境变量

这些变量放在服务器 `.env`，不要提交到 Git：

```env
AUTH_URL="http://YOUR_SERVER_IP"
EMAIL_DELIVERY_MODE="smtp"
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-smtp-user"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="NYU树洞 <no-reply@example.com>"
```

如果你现在还没有域名，生产环境可以先直接用公网 IP：

```env
AUTH_URL="http://YOUR_SERVER_IP"
SMTP_FROM="NYU树洞 <no-reply@example.com>"
```

后续买了域名以后，只需要改这两项：

```env
AUTH_URL="https://your-domain.com"
SMTP_FROM="NYU树洞 <no-reply@your-domain.com>"
```

如果还没配好 SMTP，可以暂时用：

```env
EMAIL_DELIVERY_MODE="log"
```

但这样线上注册不会真正收到邮件。

## 部署

- 自动部署只认 `main`，配置文件在 `.github/workflows/deploy.yml`
- 首次初始化服务器用 `deploy/server-setup.sh`
- 手动兜底部署用 `deploy/deploy.sh`

## 注意

- 仓库里不应提交真实 `.env`
- `prisma/schema.prisma` 和 `prisma/migrations/` 必须一起维护
- 如果改了认证或邮箱验证逻辑，记得同步更新 `.env.example`
