"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import Image from "next/image";
import { useLanguage } from "@/contexts/language-context";

interface CreatePostFormProps {
  onPostCreated: () => void;
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.upload.tooLarge);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error(t.upload.wrongType);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t.upload.wrongType);
      } else {
        setImageUrl(data.url);
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
    if (!content.trim() && !imageUrl) return;

    setLoading(true);
    try {
      const res = await fetch("/api/treehole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isAnonymous, imageUrl: imageUrl ?? "" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "发布失败");
      } else {
        if (data.flagged) {
          toast.warning("你的帖子已提交审核，审核通过后将会显示");
        } else {
          toast.success("发布成功");
        }
        setContent("");
        setIsAnonymous(false);
        setImageUrl(null);
        onPostCreated();
      }
    } catch {
      toast.error("发布失败，请稍后重试");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="说点什么吧... 使用 #话题 添加标签"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
            className="resize-none"
          />

          {/* Image preview */}
          {imageUrl && (
            <div className="relative inline-block">
              <Image
                src={imageUrl}
                alt="uploaded"
                width={240}
                height={180}
                className="rounded-lg object-cover max-h-48 w-auto border border-border"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center shadow"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Image upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!imageUrl}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#7c3aed] transition-colors disabled:opacity-40"
              >
                {uploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {uploading ? t.upload.uploading : t.upload.addImage}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />

              <div className="flex items-center space-x-2">
                <Switch
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
                <Label htmlFor="anonymous" className="text-sm text-muted-foreground">
                  匿名发布
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {content.length}/2000
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={loading || (!content.trim() && !imageUrl)}
              >
                {loading ? "发布中..." : "发布"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
