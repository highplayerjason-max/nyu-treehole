"use client";

import { useEffect, useState } from "react";
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

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: { posts: number; articles: number; comments: number };
}

async function fetchUserRows(page: number, search: string) {
  const params = new URLSearchParams({ page: page.toString() });
  if (search) params.set("search", search);

  const res = await fetch(`/api/admin/users?${params}`);
  return res.json();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      const data = await fetchUserRows(page, search);

      if (!active) return;

      setUsers(data.users || []);
      setTotalPages(data.pages || 1);
      setLoading(false);
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [page, search]);

  async function updateUser(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success("操作成功");
      setLoading(true);
      const nextData = await fetchUserRows(page, search);
      setUsers(nextData.users || []);
      setTotalPages(nextData.pages || 1);
      setLoading(false);
    } else {
      const err = await res.json();
      toast.error(err.error || "操作失败");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">用户管理</h1>

      <div className="flex gap-2 mb-4">
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

      <div className="border rounded-lg">
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
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  暂无用户
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.displayName}
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(role) => updateUser(user.id, { role })}
                    >
                      <SelectTrigger className="w-24 h-8">
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
                    {user._count.posts + user._count.articles + user._count.comments}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={user.isBanned ? "outline" : "destructive"}
                      size="sm"
                      onClick={() =>
                        updateUser(user.id, { isBanned: !user.isBanned })
                      }
                    >
                      {user.isBanned ? "解封" : "封禁"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
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
