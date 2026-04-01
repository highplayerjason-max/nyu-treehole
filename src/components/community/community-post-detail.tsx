"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LikeButton } from "@/components/shared/like-button";
import { ReportButton } from "@/components/shared/report-button";
import { CommentSection } from "@/components/treehole/comment-section";

type CommunityRoute = "treehole" | "gym";

interface PostDetail {
  id: string;
  content: string;
  imageUrl?: string | null;
  status?: string;
  isAnonymous: boolean;
  author: { id: string; displayName: string } | null;
  isOwner?: boolean;
  hashtags: { hashtag: { id: string; name: string } }[];
  comments: {
    id: string;
    content: string;
    imageUrl?: string | null;
    isAnonymous: boolean;
    authorId?: string | null;
    isOwner?: boolean;
    author: { id: string; displayName: string } | null;
    parentId: string | null;
    createdAt: string;
    updatedAt?: string;
  }[];
  _count: { comments: number; likes: number };
  likedByMe?: boolean;
  createdAt: string;
}

interface CommunityPostDetailProps {
  id: string;
  board: CommunityRoute;
  backLabel: string;
}

async function fetchPostDetail(board: CommunityRoute, id: string) {
  const res = await fetch(`/api/${board}/${id}`);
  if (!res.ok) {
    throw new Error("POST_NOT_FOUND");
  }
  return res.json();
}

export function CommunityPostDetail({
  id,
  board,
  backLabel,
}: CommunityPostDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPost() {
      try {
        const data = await fetchPostDetail(board, id);
        if (!active) return;
        setPost(data);
        setLoading(false);
      } catch {
        if (!active) return;
        router.push(`/${board}`);
      }
    }

    void loadPost();

    return () => {
      active = false;
    };
  }, [board, id, router]);

  async function refreshPost() {
    const data = await fetchPostDetail(board, id);
    setPost(data);
  }

  async function uploadImage(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过 5MB");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("只支持 JPG、PNG、GIF、WebP");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "上传失败");
      } else {
        setEditImageUrl(data.url);
      }
    } catch {
      toast.error("上传失败");
    }
  }

  function startEdit() {
    if (!post) return;
    setEditContent(post.content);
    setEditImageUrl(post.imageUrl ?? null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editContent.trim() && !editImageUrl) {
      toast.error("内容或图片至少填写一项");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/${board}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          imageUrl: editImageUrl ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "保存失败");
        return;
      }

      toast[data.flagged ? "warning" : "success"](
        data.flagged ? "内容已重新进入审核" : "已保存"
      );
      setEditing(false);
      await refreshPost();
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确认删除这条帖子吗？删除后不可恢复。")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/${board}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        setDeleting(false);
        return;
      }
      toast.success("已删除");
      router.push(`/${board}`);
    } catch {
      toast.error("删除失败，请稍后重试");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3 rounded-lg border p-6">
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

  const canManage = post.isOwner || session?.user?.role === "ADMIN";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
        &larr; {backLabel}
      </Button>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-3">
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
            <div className="flex-1" />
            {post.status && post.status !== "PUBLISHED" && (
              <Badge variant="outline">
                {post.status === "FLAGGED" ? "审核中" : "已拒绝"}
              </Badge>
            )}
          </div>

          {editing ? (
            <div className="mb-4 space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={2000}
                rows={6}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {editImageUrl && (
                <div className="relative inline-block">
                  <Image
                    src={editImageUrl}
                    alt="post image"
                    width={320}
                    height={220}
                    className="max-h-52 w-auto rounded-xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl(null)}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground shadow"
                  >
                    x
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-[#7c3aed]">
                  添加图片
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadImage(file);
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <div className="flex gap-2">
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
            </div>
          ) : (
            <>
              {post.content && (
                <p className="mb-4 whitespace-pre-wrap break-words text-base">
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
            </>
          )}

          {post.hashtags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {post.hashtags.map(({ hashtag }) => (
                <Link
                  key={hashtag.id}
                  href={`/${board}?hashtag=${encodeURIComponent(hashtag.name)}`}
                >
                  <Badge variant="secondary">#{hashtag.name}</Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="-ml-2 flex items-center gap-1">
            <LikeButton
              apiUrl={`/api/${board}/${post.id}/like`}
              initialCount={post._count.likes}
              initialLiked={post.likedByMe ?? false}
            />
            <ReportButton
              contentType="post"
              contentId={post.id}
              apiUrl={`/api/${board}/${post.id}/report`}
            />
            {canManage && !editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={startEdit}
              >
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
                {deleting ? "删除中..." : "删除"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <CommentSection
        board={board}
        postId={post.id}
        comments={post.comments}
        onCommentAdded={refreshPost}
        allowAnonymous={board === "treehole"}
      />
    </div>
  );
}
