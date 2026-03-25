"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
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
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (!data.isOwner && session?.user?.role !== "ADMIN") {
        toast.error("无权限编辑此文章");
        router.push(`/blog/${slug}`);
        return;
      }

      setTitle(data.title);
      setContent(data.content);
      setCoverImage(data.coverImage || null);
      setTags(data.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", "));
      setIsDraft(data.isDraft);
      setLoading(false);
    }
    fetchArticle();
  }, [slug, router, session, sessionStatus]);

  async function handleCoverImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过 5MB");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("只支持 JPG、PNG、GIF、WebP 格式");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "上传失败");
      } else {
        setCoverImage(data.url);
      }
    } catch {
      toast.error("上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
          coverImage: coverImage ?? "",
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

            {/* Cover image upload */}
            <div className="space-y-2">
              <Label>封面图片</Label>
              {coverImage ? (
                <div className="relative inline-block">
                  <Image
                    src={coverImage}
                    alt="cover"
                    width={320}
                    height={180}
                    className="rounded-lg object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      上传中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      添加封面图片
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleCoverImageSelect}
              />
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
