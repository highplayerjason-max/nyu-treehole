"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LikeButton } from "@/components/shared/like-button";
import { ReportButton } from "@/components/shared/report-button";
import { CommentSection } from "@/components/treehole/comment-section";
import { toast } from "sonner";
import Link from "next/link";

interface PostDetail {
  id: string;
  content: string;
  imageUrl?: string | null;
  isAnonymous: boolean;
  author: { id: string; displayName: string } | null;
  isOwner?: boolean;
  hashtags: { hashtag: { id: string; name: string } }[];
  comments: {
    id: string;
    content: string;
    isAnonymous: boolean;
    author: { id: string; displayName: string } | null;
    parentId: string | null;
    createdAt: string;
  }[];
  _count: { comments: number; likes: number };
  likedByMe?: boolean;
  createdAt: string;
}

async function fetchPostDetail(id: string) {
  const res = await fetch(`/api/treehole/${id}`);

  if (!res.ok) {
    throw new Error("POST_NOT_FOUND");
  }

  return res.json();
}

export default function TreeholePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPost() {
      try {
        const data = await fetchPostDetail(id);

        if (!active) return;

        setPost(data);
        setLoading(false);
      } catch {
        if (!active) return;
        router.push("/treehole");
      }
    }

    void loadPost();

    return () => {
      active = false;
    };
  }, [id, router]);

  async function refreshPost() {
    const data = await fetchPostDetail(id);
    setPost(data);
  }

  const canManage =
    post?.isOwner || session?.user?.role === "ADMIN";

  async function handleDelete() {
    if (!window.confirm("确认删除这条帖子吗？删除后不可恢复。")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/treehole/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        setDeleting(false);
        return;
      }
      toast.success("已删除");
      router.push("/treehole");
    } catch {
      toast.error("删除失败，请稍后重试");
      setDeleting(false);
    }
  }

  function startEdit() {
    if (!post) return;
    setEditContent(post.content);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editContent.trim()) {
      toast.error("内容不能为空");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/treehole/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        setSavingEdit(false);
        return;
      }
      toast.success("已保存");
      setEditing(false);
      await refreshPost();
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-6 px-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3 p-6 border rounded-lg">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        &larr; 返回
      </Button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {post.author ? post.author.displayName.charAt(0) : "匿"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {post.author ? post.author.displayName : "匿名用户"}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(post.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>

          {editing ? (
            <div className="mb-4 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={2000}
                rows={6}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-base whitespace-pre-wrap break-words mb-4">
              {post.content}
            </p>
          )}

          {post.imageUrl && (
            <div className="mb-4">
              <Image
                src={post.imageUrl}
                alt="post image"
                width={960}
                height={640}
                className="w-full rounded-xl border border-border object-cover"
              />
            </div>
          )}

          {post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {post.hashtags.map(({ hashtag }) => (
                <Link
                  key={hashtag.id}
                  href={`/treehole?hashtag=${encodeURIComponent(hashtag.name)}`}
                >
                  <Badge variant="secondary">#{hashtag.name}</Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 -ml-2">
            <LikeButton
              postId={post.id}
              initialCount={post._count.likes}
              initialLiked={post.likedByMe ?? false}
            />
            <ReportButton contentType="post" contentId={post.id} />
            {canManage && !editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={startEdit}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-red-500"
                disabled={deleting}
                onClick={handleDelete}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? "删除中..." : "删除"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <CommentSection
        postId={post.id}
        comments={post.comments}
        onCommentAdded={refreshPost}
      />
    </div>
  );
}
