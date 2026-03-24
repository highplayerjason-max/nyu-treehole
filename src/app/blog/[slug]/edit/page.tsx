"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/blog/rich-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Wait for session to load before checking authorization
    if (sessionStatus === "loading") return;

    async function fetchArticle() {
      const res = await fetch(`/api/blog/${slug}`);
      if (!res.ok) {
        router.push("/blog");
        return;
      }
      const data = await res.json();

      // Client-side auth guard: only author or admin can access the edit page
      const isAuthor = session?.user?.id === data.author?.id;
      const isAdmin = session?.user?.role === "ADMIN";
      if (!isAuthor && !isAdmin) {
        toast.error("无权限编辑此文章");
        router.push(`/blog/${slug}`);
        return;
      }

      setTitle(data.title);
      setContent(data.content);
      setTags(data.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", "));
      setIsDraft(data.isDraft);
      setLoading(false);
    }
    fetchArticle();
  }, [slug, router, session, sessionStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("标题和内容不能为空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/blog/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          isDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "保存失败");
      } else {
        toast.success("已保存");
        router.push(`/blog/${data.article.slug}`);
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-6 px-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle>编辑文章</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文章标题"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>内容</Label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签（逗号分隔）</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="前端, React, 教程"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="draft"
                  checked={isDraft}
                  onCheckedChange={setIsDraft}
                />
                <Label htmlFor="draft" className="text-sm text-muted-foreground">
                  草稿
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
