import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [userCount, postCount, articleCount, pendingCount, reportCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.treeholePost.count({
        where: { status: ContentStatus.PUBLISHED },
      }),
      prisma.blogArticle.count({
        where: { status: ContentStatus.PUBLISHED, isDraft: false },
      }),
      prisma.treeholePost.count({
        where: { status: ContentStatus.FLAGGED },
      }).then(async (posts) => {
        const comments = await prisma.treeholeComment.count({
          where: { status: ContentStatus.FLAGGED },
        });
        const articles = await prisma.blogArticle.count({
          where: { status: ContentStatus.FLAGGED },
        });
        return posts + comments + articles;
      }),
      prisma.report.count(),
    ]);

  const stats = [
    { label: "注册用户", value: userCount, color: "text-blue-600" },
    { label: "树洞帖子", value: postCount, color: "text-green-600" },
    { label: "博客文章", value: articleCount, color: "text-purple-600" },
    { label: "待审核", value: pendingCount, color: "text-red-600" },
    { label: "举报总数", value: reportCount, color: "text-orange-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">数据概览</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/moderation" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <p className="font-medium">审核队列</p>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} 条内容等待审核`
                  : "暂无待审核内容"}
              </p>
            </a>
            <a href="/admin/users" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <p className="font-medium">用户管理</p>
              <p className="text-sm text-muted-foreground">
                管理用户账号和权限
              </p>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">审核说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. 系统会自动通过 LLM 审核发布内容（需配置 API Key）</p>
            <p>2. 用户举报满 3 次的内容会自动进入审核队列</p>
            <p>3. 在审核队列中可以通过、拒绝或删除内容</p>
            <p>4. 匿名帖子在管理后台始终显示真实作者</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
