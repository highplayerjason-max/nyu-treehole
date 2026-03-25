"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: "USER" | "ADMIN";
  isBanned: boolean;
  createdAt: string;
  _count: { posts: number; articles: number; comments: number };
}

interface UserListResponse {
  users?: UserRow[];
  total?: number;
  pages?: number;
  page?: number;
  error?: string;
}

async function fetchUserRows(page: number, search: string) {
  const params = new URLSearchParams({ page: page.toString() });
  if (search) params.set("search", search);

  const res = await fetch(`/api/admin/users?${params}`);
  const data = (await res.json()) as UserListResponse;

  if (!res.ok) {
    throw new Error(data.error || "加载用户失败");
  }

  return data;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      try {
        const data = await fetchUserRows(page, search);

        if (!active) return;

        const nextPages = Math.max(data.pages || 1, 1);
        if (page > nextPages) {
          setPage(nextPages);
          return;
        }

        setUsers(data.users || []);
        setTotalPages(nextPages);
      } catch (error) {
        if (!active) return;

        toast.error(
          error instanceof Error ? error.message : "加载用户失败，请稍后重试"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [page, search]);

  async function refreshUsers() {
    const nextData = await fetchUserRows(page, search);
    const nextPages = Math.max(nextData.pages || 1, 1);

    if (page > nextPages) {
      setPage(nextPages);
      return;
    }

    setUsers(nextData.users || []);
    setTotalPages(nextPages);
  }

  async function updateUser(id: string, data: Record<string, unknown>) {
    setActionId(id);

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "操作失败");
        return;
      }

      toast.success("操作成功");
      setLoading(true);
      await refreshUsers();
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setActionId(null);
      setLoading(false);
    }
  }

  async function deleteUser(user: UserRow) {
    const confirmed = window.confirm(
      `确认永久删除 ${user.displayName}（${user.email}）吗？\n\n该操作会删除该账号及其帖子、评论、文章和上传文件，且无法恢复。`
    );
    if (!confirmed) return;

    setActionId(user.id);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "删除用户失败");
        return;
      }

      toast.success("用户已删除");

      if (user.id === session?.user?.id) {
        await signOut({ callbackUrl: "/" });
        return;
      }

      setLoading(true);
      await refreshUsers();
    } catch {
      toast.error("删除用户失败，请稍后重试");
    } finally {
      setActionId(null);
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">用户管理</h1>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="搜索用户（邮箱或昵称）"
          value={search}
          onChange={(e) => {
            setLoading(true);
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>发帖数</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  暂无用户
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const rowBusy = actionId === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.displayName}
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(role) => updateUser(user.id, { role })}
                        disabled={rowBusy}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">用户</SelectItem>
                          <SelectItem value="ADMIN">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <Badge variant="destructive">已封禁</Badge>
                      ) : (
                        <Badge variant="secondary">正常</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user._count.posts +
                        user._count.articles +
                        user._count.comments}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant={user.isBanned ? "outline" : "secondary"}
                          size="sm"
                          disabled={rowBusy}
                          onClick={() =>
                            updateUser(user.id, { isBanned: !user.isBanned })
                          }
                        >
                          {user.isBanned ? "解封" : "封禁"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => void deleteUser(user)}
                        >
                          销号
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
