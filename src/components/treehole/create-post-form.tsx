"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/language-context";

interface CreatePostFormProps {
  onPostCreated: () => void;
  apiPath?: "/api/treehole" | "/api/gym";
  allowAnonymous?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

export function CreatePostForm({
  onPostCreated,
  apiPath = "/api/treehole",
  allowAnonymous = true,
  placeholder,
  submitLabel,
}: CreatePostFormProps) {
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
      toast.error(t.upload.uploadFailed);
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
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageUrl: imageUrl ?? "",
          isAnonymous: allowAnonymous ? isAnonymous : false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "发布失败");
      } else {
        if (data.flagged) {
          toast.warning("你的内容已进入审核队列，审核通过后会显示");
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder={
              placeholder || "说点什么吧... 使用 #标签 添加主题"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
            className="resize-none"
          />

          {imageUrl && (
            <div className="relative inline-block">
              <Image
                src={imageUrl}
                alt="uploaded"
                width={240}
                height={180}
                className="max-h-48 w-auto rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
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
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!imageUrl}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-[#7c3aed] disabled:opacity-40"
              >
                {uploading ? t.upload.uploading : t.upload.addImage}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />

              {allowAnonymous && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`anonymous-${apiPath}`}
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                  <Label
                    htmlFor={`anonymous-${apiPath}`}
                    className="text-sm text-muted-foreground"
                  >
                    匿名发布
                  </Label>
                </div>
              )}
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
                {loading ? "发布中..." : submitLabel || "发布"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
