"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ReportButtonProps {
  contentType: "post" | "comment" | "article";
  contentId: string;
}

export function ReportButton({ contentType, contentId }: ReportButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!session) return null;

  const urlMap = {
    post: `/api/treehole/${contentId}/report`,
    comment: `/api/treehole/${contentId}/report`,
    article: `/api/blog/${contentId}/report`,
  };

  async function handleReport() {
    setLoading(true);
    try {
      const res = await fetch(urlMap[contentType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "举报失败");
      } else {
        toast.success("举报成功，我们会尽快处理");
        setOpen(false);
        setReason("");
      }
    } catch {
      toast.error("举报失败，请稍后重试");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2" />}>
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        举报
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>举报内容</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="请描述举报原因（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleReport} disabled={loading} variant="destructive">
            {loading ? "提交中..." : "提交举报"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
