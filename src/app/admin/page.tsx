import Link from "next/link";
import {
  CommunityBoard,
  ContentStatus,
  ModerationCaseStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    userCount,
    treeholeCount,
    gymCount,
    articleCount,
    pendingCount,
    reportCount,
  ] = await Promise.all([
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.treeholePost.count({
      where: {
        board: CommunityBoard.TREEHOLE,
        status: ContentStatus.PUBLISHED,
      },
    }),
    prisma.treeholePost.count({
      where: {
        board: CommunityBoard.GYM,
        status: ContentStatus.PUBLISHED,
      },
    }),
    prisma.blogArticle.count({
      where: { status: ContentStatus.PUBLISHED, isDraft: false },
    }),
    prisma.moderationCase.count({
      where: { status: ModerationCaseStatus.OPEN },
    }),
    prisma.report.count(),
  ]);

  const stats = [
    { label: "Verified users", value: userCount, color: "text-blue-600" },
    { label: "Treehole posts", value: treeholeCount, color: "text-green-600" },
    { label: "Gym posts", value: gymCount, color: "text-amber-600" },
    { label: "Blog articles", value: articleCount, color: "text-violet-600" },
    { label: "Open reviews", value: pendingCount, color: "text-red-600" },
    { label: "Total reports", value: reportCount, color: "text-orange-600" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Overview</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/moderation"
              className="block rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <p className="font-medium">Moderation queue</p>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} open case${pendingCount === 1 ? "" : "s"}`
                  : "No open moderation cases"}
              </p>
            </Link>

            <Link
              href="/admin/tags"
              className="block rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <p className="font-medium">Tag management</p>
              <p className="text-sm text-muted-foreground">
                Review Treehole and Gym hashtags separately.
              </p>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. AI keyword review can flag new posts, comments, and articles.</p>
            <p>2. A single report opens a manual moderation case for review.</p>
            <p>3. Moderators can approve, reject, or delete the content.</p>
            <p>4. Gym and Treehole share the same review engine with separate board labels.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
