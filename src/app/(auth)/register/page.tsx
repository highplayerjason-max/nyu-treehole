"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
} from "@/lib/display-name";

function isNyuEmail(value: string) {
  return /^[^\s@]+@nyu\.edu$/i.test(value.trim());
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string).trim().toLowerCase();
    const password = formData.get("password") as string;
    const displayName = (formData.get("displayName") as string).trim();
    const confirmPassword = formData.get("confirmPassword") as string;
    const data = {
      email,
      password,
      displayName,
    };

    if (
      displayName.length < DISPLAY_NAME_MIN_LENGTH ||
      displayName.length > DISPLAY_NAME_MAX_LENGTH
    ) {
      setError("昵称需要在 2 到 20 个字符之间");
      setLoading(false);
      return;
    }

    if (!isNyuEmail(email)) {
      setError("仅支持 NYU 邮箱（@nyu.edu）注册");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      setLoading(false);
      return;
    }

    if (data.password !== confirmPassword) {
      setError("两次输入的密码不一致");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "注册失败");
        setLoading(false);
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("注册请求超时，请稍后重试");
      } else {
        setError("注册失败，请稍后重试");
      }
      setLoading(false);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">注册</CardTitle>
        <CardDescription>创建你的学生社群账号</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="rounded bg-red-50 p-2 text-center text-sm text-red-500">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="displayName">昵称</Label>
            <Input
              id="displayName"
              name="displayName"
              placeholder="你的昵称"
               minLength={DISPLAY_NAME_MIN_LENGTH}
               maxLength={DISPLAY_NAME_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="netid@nyu.edu"
              title="仅支持 NYU 邮箱（@nyu.edu）注册"
              required
            />
            <p className="text-xs text-muted-foreground">
              仅限 NYU 学生（@nyu.edu 邮箱）注册
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="至少 6 个字符"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{" "}
            <Link href="/login" className="text-primary hover:underline">
              立即登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
