"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ModerationItem {
  id: string;
  type: string;
  content: string;
  author: { displayName: string; email: string };
  reportCount: number;
  status: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  TREEHOLE_POST: "树洞帖子",
  TREEHOLE_COMMENT: "树洞评论",
  BLOG_ARTICLE: "博客文章",
};

export default function AdminModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      const res = await fetch(`/api/admin/moderation?type=${filter}`);
      const data = await res.json();

      if (!active) return;

      setItems(data.items || []);
      setLoading(false);
    }

    void loadItems();

    return () => {
      active = false;
    };
  }, [filter]);

  async function handleAction(
    id: string,
    contentType: string,
    action: string
  ) {
    const res = await fetch(`/api/admin/moderation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, contentType }),
    });

    if (res.ok) {
      toast.success("操作成功");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      toast.error("操作失败");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">内容审核</h1>
          <p className="text-sm text-muted-foreground">
            审核被举报或自动标记的内容
          </p>
        </div>
        <Select
          value={filter}
          onValueChange={(v) => {
            if (!v) return;
            setLoading(true);
            setFilter(v);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="post">树洞帖子</SelectItem>
            <SelectItem value="comment">树洞评论</SelectItem>
            <SelectItem value="article">博客文章</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">加载中...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">暂无待审核内容</p>
          <p className="text-sm text-muted-foreground mt-1">
            所有内容都已审核完毕
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {typeLabels[item.type] || item.type}
                      </Badge>
                      {item.status === "FLAGGED" && (
                        <Badge variant="destructive">已自动标记</Badge>
                      )}
                      {item.reportCount > 0 && (
                        <Badge variant="destructive">
                          {item.reportCount} 次举报
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm whitespace-pre-wrap break-words mb-2 max-h-32 overflow-y-auto">
                      {item.content}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        作者: {item.author.displayName} ({item.author.email})
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleAction(item.id, item.type, "APPROVE")
                      }
                    >
                      通过
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleAction(item.id, item.type, "REJECT")
                      }
                    >
                      拒绝
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        handleAction(item.id, item.type, "DELETE")
                      }
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
