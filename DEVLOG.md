# 开发日志 (Development Log)

记录项目从零到一的完整开发过程、技术决策、踩过的坑，以及后续开发方向。

---

## 2026-03-18 · 项目初始化与技术选型

### 需求梳理

从一个想法出发：做一个学生社群网站，集成三个功能：

| 模块 | 功能 | 状态 |
|------|------|------|
| 树洞 | 匿名社交，类微博/Twitter | ✅ 已完成 |
| 博客 | 个人文章，支持连载 | ✅ 已完成 |
| 课评 | 课程评价 | 🚧 Coming Soon |

**核心非功能需求：**
- 内容审核：接入 LLM API 自动检测违禁词
- 举报系统：3 次举报自动进入人工审核队列
- 角色区分：普通用户 vs 管理员
- 匿名机制：匿名帖子只在前端隐藏身份，后端始终记录真实用户

### 技术选型决策

**为什么选 Next.js 全栈？**
- 前后端一体，部署简单
- App Router 支持 Server Components，减少客户端 JS 体积
- 内置 API Routes，不需要单独的后端服务

**为什么选 Prisma v6（而不是 v7）？**
- Prisma v7 需要强制传入 adapter 参数，配置复杂
- v6 支持直接读取 `DATABASE_URL` 环境变量，更简洁

**为什么选 shadcn/ui v4？**
- 最新版本，基于 `@base-ui/react`
- 注意：v4 已迁移离 Radix UI，`asChild` prop 被 `render` prop 替代

**匿名发帖的实现思路：**
```
数据库始终存 authorId（不可删除）
isAnonymous = true 时：
  - 前端不显示作者信息
  - API 返回时过滤掉 author 字段
  - 管理员 API 例外：始终返回真实身份
```

---

## 2026-03-18 · 开发过程中踩的坑

### 坑1：Zod v4 API 变更

Zod v4 把 `errors` 改成了 `issues`：

```typescript
// ❌ Zod v3 写法（报错）
parsed.error.errors[0].message

// ✅ Zod v4 写法
parsed.error.issues[0].message
```

影响范围：所有 API 路由的 Zod 校验（5 个文件）

---

### 坑2：shadcn/ui v4 不再支持 `asChild`

v4 使用 `@base-ui/react` 代替 Radix UI，`asChild` prop 被移除，改用 `render` prop：

```tsx
// ❌ 旧写法（shadcn v3 / Radix）
<Button asChild><Link href="/path">跳转</Link></Button>

// ✅ 新写法（shadcn v4 / base-ui）
<Button nativeButton={false} render={<Link href="/path" />}>
  跳转
</Button>
```

**重点：** Button 渲染为 `<a>` 标签时，必须加 `nativeButton={false}`，否则 base-ui 会报警告（因为它期望一个原生 `<button>`）。

影响范围：Navbar、Homepage、Blog 页面，共 9 处。

---

### 坑3：Turbopack 与 Tiptap 不兼容

Next.js 16 强制使用 Turbopack，但 Tiptap 富文本编辑器的某些包无法被 Turbopack 解析。

**解决方案：** 暂时用 `<textarea>` + HTML 预览替代 Tiptap。
后续可以用 `next/dynamic` 配合 `ssr: false` 动态加载 Tiptap 绕过此问题。

---

### 坑4：`useSearchParams` 需要 Suspense 边界

Next.js 要求使用 `useSearchParams` 的组件必须包裹在 `<Suspense>` 中：

```tsx
// 拆分为两个组件：外层 wrapper + 内层 inner
export default function BlogPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <BlogPageInner />
    </Suspense>
  );
}

function BlogPageInner() {
  const searchParams = useSearchParams(); // 在这里使用
  // ...
}
```

---

### 坑5：Next.js 16 废弃了 middleware

`src/middleware.ts` 在 Next.js 16 中被废弃，导致构建失败。
**解决方案：** 直接删除，鉴权逻辑移到 API routes 和 page 组件内部处理。

---

## 2026-03-18 · 部署过程记录

### 部署目标

阿里云轻量应用服务器，2核2G，Ubuntu 22.04，¥9.9/月（学生优惠）。

### 问题1：Docker Hub 在国内无法访问

**现象：** `docker compose build` 时拉取 `node:20-alpine` 超时。

**解决：** 配置国内镜像源：

```json
// /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

---

### 问题2：2GB 内存不够跑 Next.js 编译，服务器 OOM 崩溃

**现象：** `docker compose build` 过程中，Next.js 编译占用 1.5GB+ 内存，服务器 OOM（Out of Memory），sshd 进程被 Linux 内核杀掉，SSH 连接全部断开，无法登录。

**根本原因：** Next.js 编译（`npm run build`）是 CPU 和内存密集型操作，在 2GB 服务器上几乎没有余量。

**解决方案（待实施）：** 部署前先添加 2GB swap 交换空间：

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

这样系统有 2GB 内存 + 2GB swap = 4GB 可用，足够完成构建。

---

### 问题3：Dockerfile 引用了不存在的路径

**现象：** Docker 构建报错 `/app/src/generated not found`

**原因：**
1. `src/generated/` 是早期使用 Prisma v7 时生成的目录，切换到 v6 后已删除
2. `.next/standalone` 不存在是因为 `next.config.ts` 没有设置 `output: 'standalone'`

**修复：**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",  // ← 新增这行
  serverExternalPackages: ["@prisma/client"],
};
```

```dockerfile
# Dockerfile - 移除不存在的目录
# ❌ 删除这行
COPY --from=builder /app/src/generated ./src/generated
```

---

## 当前状态（2026-03-18）

| 项目 | 状态 |
|------|------|
| 代码开发 | ✅ 完成 |
| GitHub 推送 | ✅ 完成 |
| 本地开发服务器 | ✅ 运行正常 |
| 数据库迁移 | ⏳ 待部署后执行 |
| 生产部署 | 🚧 进行中（等待服务器重置后重试） |
| 域名配置 | ⏳ 待处理 |

---

## 后续开发计划

### 短期（功能完善）

- [ ] **课评模块** — 核心功能开发
  - 课程数据库（课程名、教师、学分、开课学期）
  - 评分系统（总体评分、给分、工作量、内容质量）
  - 评价列表与搜索
- [ ] **富文本编辑器** — 用 `next/dynamic` + Tiptap 替换现有 textarea
- [ ] **图片上传** — 集成 OSS（阿里云/七牛云）
- [ ] **通知系统** — 评论、点赞通知（可用 Server-Sent Events）

### 中期（体验优化）

- [ ] **搜索增强** — 全文搜索接入 Meilisearch 或 PostgreSQL 全文索引
- [ ] **无限滚动** — 树洞信息流的游标分页 + IntersectionObserver
- [ ] **暗黑模式** — 已有 Tailwind dark: 类支持，接入切换开关即可
- [ ] **PWA 支持** — 让手机用户可以"安装"到桌面

### 长期（运营功能）

- [ ] **邮件验证** — 注册时发验证码（集成 Resend/SendGrid）
- [ ] **OAuth 登录** — 微信/GitHub 第三方登录
- [ ] **数据统计** — 管理后台加图表（Recharts）
- [ ] **内容导出** — 博客文章支持导出 PDF/Markdown

---

## 技术债务

| 项目 | 描述 | 优先级 |
|------|------|--------|
| 富文本编辑器 | 当前是 textarea，体验差 | 中 |
| 缺少单元测试 | 没有任何测试覆盖 | 中 |
| 缺少 E2E 测试 | 注册/登录/发帖流程没有自动化测试 | 低 |
| 错误处理 | API 错误信息不够友好 | 低 |
| 图片支持 | 帖子和文章目前不支持图片 | 中 |

---

## 关键文件速查

| 想修改什么 | 去哪里改 |
|------------|----------|
| 数据库表结构 | `prisma/schema.prisma` |
| 树洞 API 逻辑 | `src/app/api/treehole/` |
| 博客 API 逻辑 | `src/app/api/blog/` |
| 管理员后台 | `src/app/admin/` + `src/app/api/admin/` |
| LLM 审核逻辑 | `src/lib/moderation.ts` |
| 表单校验规则 | `src/lib/validators.ts` |
| 登录/认证配置 | `src/lib/auth.ts` |
| 导航栏 | `src/components/layout/navbar.tsx` |
| 全局布局 | `src/app/layout.tsx` |
