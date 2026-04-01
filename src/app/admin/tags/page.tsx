"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TagRow {
  id: string;
  name: string;
  scope: "TREEHOLE" | "GYM";
  isBanned: boolean;
  _count: { posts: number };
  publishedCount: number;
}

async function fetchTagRows(
  search: string,
  filter: "all" | "active" | "banned",
  scope: "treehole" | "gym"
) {
  const params = new URLSearchParams({ filter, scope });
  if (search) params.set("search", search);

  const res = await fetch(`/api/admin/tags?${params}`);
  const data = await res.json();
  return data.hashtags || [];
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned">("all");
  const [scope, setScope] = useState<"treehole" | "gym">("treehole");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTags() {
      const nextTags = await fetchTagRows(search, filter, scope);
      if (!active) return;
      setTags(nextTags);
      setLoading(false);
    }

    void loadTags();

    return () => {
      active = false;
    };
  }, [filter, scope, search]);

  async function reload() {
    setLoading(true);
    const nextTags = await fetchTagRows(search, filter, scope);
    setTags(nextTags);
    setLoading(false);
  }

  async function handleBanToggle(tag: TagRow) {
    const nextValue = !tag.isBanned;
    const confirmed = window.confirm(
      nextValue
        ? `Ban #${tag.name} for new posts?`
        : `Allow #${tag.name} again?`
    );

    if (!confirmed) return;

    setActionId(tag.id);
    const res = await fetch(`/api/admin/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBanned: nextValue }),
    });

    if (res.ok) {
      toast.success(
        nextValue ? `Banned #${tag.name}` : `Removed ban for #${tag.name}`
      );
      await reload();
    } else {
      toast.error("Tag update failed.");
    }

    setActionId(null);
  }

  async function handleDelete(tag: TagRow) {
    const confirmed = window.confirm(
      `Permanently delete #${tag.name}? This cannot be undone.`
    );

    if (!confirmed) return;

    setActionId(tag.id);
    const res = await fetch(`/api/admin/tags/${tag.id}`, { method: "DELETE" });

    if (res.ok) {
      toast.success(`Deleted #${tag.name}`);
      await reload();
    } else {
      toast.error("Tag deletion failed.");
    }

    setActionId(null);
  }

  const totalCount = tags.length;
  const bannedCount = tags.filter((tag) => tag.isBanned).length;
  const scopeLabel = scope === "treehole" ? "Treehole" : "Gym";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tag Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage {scopeLabel} hashtags independently so Treehole and Gym do
          not interfere with each other.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          size="sm"
          variant={scope === "treehole" ? "default" : "outline"}
          onClick={() => {
            setLoading(true);
            setScope("treehole");
          }}
        >
          Treehole tags
        </Button>
        <Button
          size="sm"
          variant={scope === "gym" ? "default" : "outline"}
          onClick={() => {
            setLoading(true);
            setScope("gym");
          }}
        >
          Gym tags
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active tags
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
              Banned tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{bannedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
          }}
          className="max-w-xs"
        />

        <div className="flex gap-1">
          {(["all", "active", "banned"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => {
                setLoading(true);
                setFilter(value);
              }}
            >
              {value === "all"
                ? "All"
                : value === "active"
                ? "Active"
                : "Banned"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading tags...
        </div>
      ) : tags.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No tags found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tag</th>
                <th className="px-4 py-3 text-left font-medium">Published</th>
                <th className="px-4 py-3 text-left font-medium">All usage</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tags.map((tag) => (
                <tr key={tag.id} className={tag.isBanned ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-medium">
                    <span
                      className={
                        tag.isBanned
                          ? "line-through text-muted-foreground"
                          : "text-amber-600"
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
                        Banned
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-xs text-green-700"
                      >
                        Active
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
                      >
                        {tag.isBanned ? "Unban" : "Ban"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionId === tag.id}
                        onClick={() => handleDelete(tag)}
                      >
                        Delete
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
