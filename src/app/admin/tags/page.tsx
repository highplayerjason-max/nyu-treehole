"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface TagRow {
  id: string;
  name: string;
  isBanned: boolean;
  _count: { posts: number };
  publishedCount: number;
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned">("all");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ filter });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/tags?${params}`);
    const data = await res.json();
    setTags(data.hashtags || []);
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  async function handleBanToggle(tag: TagRow) {
    const next = !tag.isBanned;
    const confirmMsg = next
      ? `屏蔽 #${tag.name}？屏蔽后此标签将从热门话题中隐藏，且新帖无法使用。`
      : `解除屏蔽 #${tag.name}？`;
    if (!confirm(confirmMsg)) return;

    setActionId(tag.id);
    const res = await fetch(`/api/admin/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBanned: next }),
    });
    if (res.ok) {
      toast.success(next ? `已屏蔽 #${tag.name}` : `已解除屏蔽 #${tag.name}`);
      fetchTags();
    } else {
      toast.error("操作失败");
    }
    setActionId(null);
  }

  async function handleDelete(tag: TagRow) {
    if (
      !confirm(
        `永久删除 #${tag.name}？\n\n此标签将从所有帖子中移除，操作不可撤销。`
      )
    )
      return;

    setActionId(tag.id);
    const res = await fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`已删除 #${tag.name}`);
      fetchTags();
    } else {
      toast.error("删除失败");
    }
    setActionId(null);
  }

  const totalCount = tags.length;
  const bannedCount = tags.filter((t) => t.isBanned).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">话题标签管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理树洞热门话题，屏蔽或删除不当标签
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              标签总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              正常标签
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {totalCount - bannedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已屏蔽
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{bannedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="搜索标签..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "active", "banned"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "active" ? "正常" : "已屏蔽"}
            </Button>
          ))}
        </div>
      </div>

      {/* Tag list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">暂无标签</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">标签名</th>
                <th className="text-left px-4 py-3 font-medium">帖子数（发布）</th>
                <th className="text-left px-4 py-3 font-medium">帖子总数</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    tag.isBanned ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    <span
                      className={
                        tag.isBanned
                          ? "text-muted-foreground line-through"
                          : "text-[#7c3aed]"
                      }
                    >
                      #{tag.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tag.publishedCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tag._count.posts}
                  </td>
                  <td className="px-4 py-3">
                    {tag.isBanned ? (
                      <Badge variant="destructive" className="text-xs">
                        已屏蔽
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700"
                      >
                        正常
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={tag.isBanned ? "outline" : "secondary"}
                        disabled={actionId === tag.id}
                        onClick={() => handleBanToggle(tag)}
                        className={
                          !tag.isBanned
                            ? "text-orange-600 hover:text-orange-700"
                            : ""
                        }
                      >
                        {tag.isBanned ? "解除屏蔽" : "屏蔽"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionId === tag.id}
                        onClick={() => handleDelete(tag)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
