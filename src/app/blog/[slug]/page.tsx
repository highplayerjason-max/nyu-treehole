"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LikeButton } from "@/components/shared/like-button";
import { ReportButton } from "@/components/shared/report-button";
import { BlogCommentSection } from "@/components/blog/blog-comment-section";
import { toast } from "sonner";
import Link from "next/link";

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  content: string;
  coverImage?: string | null;
  author: { id: string; displayName: string };
  tags: { tag: { id: string; name: string } }[];
  series?: {
    title: string;
    articles: { id: string; title: string; slug: string; seriesOrder: number | null }[];
  } | null;
  _count?: { likes: number };
  likedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      const res = await fetch(`/api/blog/${slug}`);
      if (!res.ok) {
        router.push("/blog");
        return;
      }
      const data = await res.json();
      setArticle(data);
      setLoading(false);
    }
    fetchArticle();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-6 px-4 space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!article) return null;

  const isAuthor = session?.user?.id === article.author.id;
  const isAdmin = session?.user?.role === "ADMIN";

  async function handleDeleteTag(tagId: string) {
    if (!(isAuthor || isAdmin)) return;
    if (!window.confirm("确认删除这个标签吗？")) return;

    setDeletingTagId(tagId);
    try {
      const res = await fetch(`/api/blog/${slug}/tags/${tagId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        window.alert(data.error || "删除标签失败");
        return;
      }

      setArticle((prev) =>
        prev
          ? {
              ...prev,
              tags: prev.tags.filter(({ tag }) => tag.id !== tagId),
            }
          : prev
      );
    } finally {
      setDeletingTagId(null);
    }
  }

  async function handleDeleteArticle() {
    if (!window.confirm("确认删除这篇文章吗？删除后不可恢复。")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/blog/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        setDeleting(false);
        return;
      }
      toast.success("已删除");
      router.push("/blog");
    } catch {
      toast.error("删除失败，请稍后重试");
      setDeleting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        &larr; 返回博客
      </Button>

      {/* Series navigation */}
      {article.series && article.series.articles.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-2">
              {article.series.title}
            </p>
            <div className="space-y-1">
              {article.series.articles.map((item) => (
                <Link
                  key={item.id}
                  href={`/blog/${item.slug}`}
                  className={`block text-sm px-2 py-1 rounded ${
                    item.slug === slug
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.seriesOrder ? `${item.seriesOrder}. ` : ""}
                  {item.title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <article>
        <h1 className="text-3xl font-bold mb-4">{article.title}</h1>

        {article.coverImage && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-border">
            <Image
              src={article.coverImage}
              alt={`${article.title} cover`}
              width={1200}
              height={675}
              className="w-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {article.author.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{article.author.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(article.createdAt).toLocaleDateString("zh-CN")}
              {article.updatedAt !== article.createdAt && " (已编辑)"}
            </p>
          </div>
          <div className="flex-1" />
          {(isAuthor || isAdmin) && (
            <>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/blog/${slug}/edit`} />}>
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                disabled={deleting}
                onClick={handleDeleteArticle}
              >
                {deleting ? "删除中..." : "删除"}
              </Button>
            </>
          )}
        </div>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-6">
            {article.tags.map(({ tag }) => (
              <div key={tag.id} className="flex items-center gap-1">
                <Link href={`/blog?tag=${encodeURIComponent(tag.name)}`}>
                  <Badge variant="secondary">{tag.name}</Badge>
                </Link>
                {(isAuthor || isAdmin) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    disabled={deletingTagId === tag.id}
                    onClick={() => handleDeleteTag(tag.id)}
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <Separator className="mb-6" />

        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <Separator className="my-6" />

        <div className="flex items-center gap-2 -ml-2">
          <LikeButton
            apiUrl={`/api/blog/${slug}/like`}
            initialCount={article._count?.likes ?? 0}
            initialLiked={article.likedByMe ?? false}
          />
          <ReportButton contentType="article" contentId={article.slug} />
        </div>

        <BlogCommentSection slug={slug} />
      </article>
    </div>
  );
}
