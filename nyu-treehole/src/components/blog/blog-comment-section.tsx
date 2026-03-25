"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BlogComment {
  id: string;
  content: string;
  author: { id: string; displayName: string };
  createdAt: string;
}

interface BlogCommentSectionProps {
  slug: string;
}

async function fetchCommentsForArticle(slug: string) {
  const res = await fetch(`/api/blog/${slug}/comments`);
  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.comments || [];
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return date.toLocaleDateString("zh-CN");
}

export function BlogCommentSection({ slug }: BlogCommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadComments() {
      const nextComments = await fetchCommentsForArticle(slug);

      if (!active) return;

      setComments(nextComments);
    }

    void loadComments();

    return () => {
      active = false;
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/blog/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "评论失败");
      } else {
        toast.success("评论成功");
        setContent("");
        const nextComments = await fetchCommentsForArticle(slug);
        setComments(nextComments);
      }
    } catch {
      toast.error("评论失败");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4 mt-8">
      <Separator />
      <h3 className="font-semibold text-lg">评论 ({comments.length})</h3>

      {session ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="写下你的评论..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={loading || !content.trim()}>
              {loading ? "发送中..." : "发送评论"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          <Link href="/login" className="text-primary hover:underline">
            登录
          </Link>{" "}
          后才能发表评论
        </p>
      )}

      <div className="divide-y">
        {comments.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">
            暂无评论，来说两句吧
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 py-4">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {comment.author.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {comment.author.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
