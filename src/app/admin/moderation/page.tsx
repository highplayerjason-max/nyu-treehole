"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModerationItem {
  id: string;
  type: "TREEHOLE_POST" | "TREEHOLE_COMMENT" | "BLOG_ARTICLE";
  board: "TREEHOLE" | "GYM" | null;
  source: "AI" | "REPORT";
  reason: string | null;
  reportCount: number;
  content: string;
  imageUrl: string | null;
  author: { displayName: string; email: string };
  status: string;
  createdAt: string;
}

type ModerationFilter = "all" | "post" | "comment" | "article";

const typeLabels: Record<ModerationItem["type"], string> = {
  TREEHOLE_POST: "Post",
  TREEHOLE_COMMENT: "Comment",
  BLOG_ARTICLE: "Blog article",
};

const boardLabels: Record<Exclude<ModerationItem["board"], null>, string> = {
  TREEHOLE: "Treehole",
  GYM: "Gym",
};

const sourceLabels: Record<ModerationItem["source"], string> = {
  AI: "AI review",
  REPORT: "User report",
};

export default function AdminModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [filter, setFilter] = useState<ModerationFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      try {
        const res = await fetch(`/api/admin/moderation?type=${filter}`);
        const data = await res.json();

        if (!active) return;
        setItems(data.items || []);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      active = false;
    };
  }, [filter]);

  async function handleAction(
    id: string,
    contentType: ModerationItem["type"],
    action: "APPROVE" | "REJECT" | "DELETE"
  ) {
    const res = await fetch(`/api/admin/moderation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, contentType }),
    });

    if (res.ok) {
      toast.success("Moderation action completed.");
      setItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    toast.error("Moderation action failed.");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Moderation Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review AI-flagged content and the first report for each item.
          </p>
        </div>

        <Select
          value={filter}
          onValueChange={(value) => {
            if (
              value !== "all" &&
              value !== "post" &&
              value !== "comment" &&
              value !== "article"
            ) {
              return;
            }

            setLoading(true);
            setFilter(value);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All content</SelectItem>
            <SelectItem value="post">Posts</SelectItem>
            <SelectItem value="comment">Comments</SelectItem>
            <SelectItem value="article">Articles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">
          Loading moderation queue...
        </p>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-muted-foreground">No open moderation cases.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything is currently reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{typeLabels[item.type]}</Badge>
                      {item.board ? (
                        <Badge variant="secondary">{boardLabels[item.board]}</Badge>
                      ) : null}
                      <Badge variant="secondary">{sourceLabels[item.source]}</Badge>
                      {item.status === "FLAGGED" ? (
                        <Badge variant="destructive">Flagged</Badge>
                      ) : null}
                      {item.reportCount > 0 ? (
                        <Badge variant="destructive">
                          {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>

                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt="Reported content"
                        className="h-40 w-full max-w-md rounded-lg border object-cover"
                      />
                    ) : null}

                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm">
                      {item.content}
                    </p>

                    {item.reason ? (
                      <p className="text-sm text-muted-foreground">
                        Review note: {item.reason}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Author: {item.author.displayName} ({item.author.email})
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2 lg:flex-col">
                    <Button
                      size="sm"
                      onClick={() => handleAction(item.id, item.type, "APPROVE")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(item.id, item.type, "REJECT")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(item.id, item.type, "DELETE")}
                    >
                      Delete
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
