"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  isAnonymous: boolean;
  author: { id: string; displayName: string } | null;
  parentId: string | null;
  createdAt: string;
}

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  onCommentAdded: () => void;
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

export function CommentSection({
  postId,
  comments,
  onCommentAdded,
}: CommentSectionProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/treehole/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isAnonymous, parentId: replyTo ?? undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "评论失败");
      } else {
        if (data.flagged) {
          toast.warning("评论已提交审核");
        } else {
          toast.success("评论成功");
        }
        setContent("");
        setReplyTo(null);
        onCommentAdded();
      }
    } catch {
      toast.error("评论失败");
    }
    setLoading(false);
  }

  // Build thread structure
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);

  function getReplies(parentId: string) {
    return replies.filter((r) => r.parentId === parentId);
  }

  function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const commentReplies = getReplies(comment.id);
    return (
      <div className={depth > 0 ? "ml-8 border-l-2 pl-4" : ""}>
        <div className="flex gap-2 py-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {comment.author ? comment.author.displayName.charAt(0) : "匿"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {comment.author ? comment.author.displayName : "匿名用户"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
            {session && (
              <button
                onClick={() => setReplyTo(comment.id)}
                className="text-xs text-muted-foreground hover:text-foreground mt-1"
              >
                回复
              </button>
            )}
          </div>
        </div>
        {commentReplies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium">评论 ({comments.length})</h3>

      {session && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {replyTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>回复评论</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-red-500 hover:underline"
              >
                取消
              </button>
            </div>
          )}
          <Textarea
            placeholder="写下你的评论..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={2}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="comment-anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
              <Label htmlFor="comment-anonymous" className="text-sm text-muted-foreground">
                匿名
              </Label>
            </div>
            <Button type="submit" size="sm" disabled={loading || !content.trim()}>
              {loading ? "发送中..." : "发送"}
            </Button>
          </div>
        </form>
      )}

      <div className="divide-y">
        {topLevel.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground text-center">
            暂无评论，来说两句吧
          </p>
        ) : (
          topLevel.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
