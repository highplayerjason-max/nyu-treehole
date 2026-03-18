"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
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

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(
    searchParams.get("registered") === "true" ? "" : ""
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error.includes("EMAIL_NOT_VERIFIED")) {
        setUnverifiedEmail(email);
      } else {
        setError("邮箱或密码错误");
      }
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleResend() {
    if (!unverifiedEmail || resendStatus === "sending") return;
    setResendStatus("sending");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: unverifiedEmail }),
    });
    setResendStatus("sent");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">登录</CardTitle>
        <CardDescription>登录你的学生社群账号</CardDescription>
      </CardHeader>
      <CardContent>
        {searchParams.get("registered") === "true" && (
          <div className="mb-4 rounded-lg bg-[#f5f0fb] p-3 text-sm text-[#57068c] text-center">
            注册成功！请检查邮箱，点击验证链接后即可登录
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          {unverifiedEmail && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
              <p className="text-sm text-orange-700 font-medium">邮箱尚未验证</p>
              <p className="text-xs text-orange-600">
                请检查 <strong>{unverifiedEmail}</strong> 的收件箱（含垃圾邮件），点击验证链接后即可登录
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={handleResend}
                disabled={resendStatus !== "idle"}
              >
                {resendStatus === "sending"
                  ? "发送中..."
                  : resendStatus === "sent"
                  ? "✓ 已重新发送"
                  : "重新发送验证邮件"}
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="输入密码"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link href="/register" className="text-primary hover:underline">
              立即注册
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
