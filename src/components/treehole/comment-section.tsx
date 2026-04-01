"use client";

import Image from "next/image";
import { Fragment, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ReportButton } from "@/components/shared/report-button";

type CommunityRoute = "treehole" | "gym";

interface Comment {
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
}

interface CommentSectionProps {
  board?: CommunityRoute;
  postId: string;
  comments: Comment[];
  onCommentAdded: () => void;
  allowAnonymous?: boolean;
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
  board = "treehole",
  postId,
  comments,
  onCommentAdded,
  allowAnonymous = true,
}: CommentSectionProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const topLevel = comments.filter((comment) => !comment.parentId);
  const replies = comments.filter((comment) => comment.parentId);

  function getReplies(parentId: string) {
    return replies.filter((reply) => reply.parentId === parentId);
  }

  async function uploadImage(
    file: File,
    onUploaded: (url: string) => void,
    onDone: () => void
  ) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过 5MB");
      onDone();
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("只支持 JPG、PNG、GIF、WebP");
      onDone();
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
        onUploaded(data.url);
      }
    } catch {
      toast.error("上传失败");
    } finally {
      onDone();
    }
  }

  async function handleCreateImageSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadImage(file, setImageUrl, () => {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function handleEditImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingEdit(true);
    await uploadImage(file, setEditImageUrl, () => {
      setSavingEdit(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !imageUrl) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/${board}/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageUrl: imageUrl ?? "",
          isAnonymous: allowAnonymous ? isAnonymous : false,
          parentId: replyTo ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "评论失败");
      } else {
        toast[data.flagged ? "warning" : "success"](
          data.flagged ? "评论已提交审核" : "评论成功"
        );
        setContent("");
        setImageUrl(null);
        setReplyTo(null);
        setIsAnonymous(false);
        onCommentAdded();
      }
    } catch {
      toast.error("评论失败");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditImageUrl(comment.imageUrl ?? null);
  }

  async function handleSaveEdit(commentId: string) {
    if (!editContent.trim() && !editImageUrl) {
      toast.error("评论文字或图片至少填写一项");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
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
        data.flagged ? "评论已重新进入审核" : "评论已更新"
      );
      setEditingId(null);
      setEditContent("");
      setEditImageUrl(null);
      onCommentAdded();
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm("确认删除这条评论吗？删除后不可恢复。")) return;

    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("评论已删除");
      onCommentAdded();
    } catch {
      toast.error("删除失败");
    }
  }

  function renderCommentComposer(mode: "create" | "edit") {
    const currentContent = mode === "create" ? content : editContent;
    const currentImage = mode === "create" ? imageUrl : editImageUrl;
    const currentLoading =
      mode === "create" ? loading || uploading : savingEdit;

    return (
      <>
        <Textarea
          placeholder="写下你的评论..."
          value={currentContent}
          onChange={(e) =>
            mode === "create"
              ? setContent(e.target.value)
              : setEditContent(e.target.value)
          }
          maxLength={500}
          rows={2}
          className="resize-none"
        />

        {currentImage && (
          <div className="relative inline-block">
            <Image
              src={currentImage}
              alt="comment image"
              width={180}
              height={140}
              className="max-h-36 w-auto rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={() =>
                mode === "create" ? setImageUrl(null) : setEditImageUrl(null)
              }
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground shadow"
            >
              x
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                mode === "create"
                  ? fileInputRef.current?.click()
                  : editFileInputRef.current?.click()
              }
              disabled={currentLoading || !!currentImage}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-[#7c3aed] disabled:opacity-40"
            >
              添加图片
            </button>
            <input
              ref={mode === "create" ? fileInputRef : editFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={
                mode === "create"
                  ? handleCreateImageSelect
                  : handleEditImageSelect
              }
            />

            {mode === "create" && allowAnonymous && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="comment-anonymous"
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
                <Label
                  htmlFor="comment-anonymous"
                  className="text-sm text-muted-foreground"
                >
                  匿名
                </Label>
              </div>
            )}
          </div>

          {mode === "create" ? (
            <Button
              type="submit"
              size="sm"
              disabled={currentLoading || (!content.trim() && !imageUrl)}
            >
              {currentLoading ? "发送中..." : "发送"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setEditContent("");
                  setEditImageUrl(null);
                }}
                disabled={currentLoading}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => editingId && handleSaveEdit(editingId)}
                disabled={currentLoading || (!editContent.trim() && !editImageUrl)}
              >
                {currentLoading ? "保存中..." : "保存"}
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  function renderCommentItem(comment: Comment, depth = 0) {
    const commentReplies = getReplies(comment.id);
    const canManage = comment.isOwner || session?.user?.role === "ADMIN";
    const isEditing = editingId === comment.id;

    return (
      <div className={depth > 0 ? "ml-8 border-l-2 pl-4" : ""}>
        <div className="flex gap-2 py-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {comment.author ? comment.author.displayName.charAt(0) : "匿"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {comment.author ? comment.author.displayName : "匿名用户"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(comment.createdAt)}
              </span>
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground">(已编辑)</span>
              )}
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-3">
                {renderCommentComposer("edit")}
              </div>
            ) : (
              <>
                {comment.content && (
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {comment.content}
                  </p>
                )}
                {comment.imageUrl && (
                  <div className="mt-2">
                    <Image
                      src={comment.imageUrl}
                      alt="comment image"
                      width={220}
                      height={160}
                      className="max-h-40 w-auto rounded-lg border border-border object-cover"
                    />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {session && (
                    <button
                      onClick={() => setReplyTo(comment.id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      回复
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => startEdit(comment)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      编辑
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-muted-foreground hover:text-red-500"
                    >
                      删除
                    </button>
                  )}
                  <ReportButton contentType="comment" contentId={comment.id} />
                </div>
              </>
            )}
          </div>
        </div>

        {commentReplies.map((reply) => (
          <Fragment key={reply.id}>
            {renderCommentItem(reply, depth + 1)}
          </Fragment>
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
          {renderCommentComposer("create")}
        </form>
      )}

      <div className="divide-y">
        {topLevel.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            暂无评论，来说两句吧
          </p>
        ) : (
          topLevel.map((comment) => (
            <Fragment key={comment.id}>{renderCommentItem(comment)}</Fragment>
          ))
        )}
      </div>
    </div>
  );
}
