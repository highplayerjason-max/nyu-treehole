"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerifyEmailPageWrapper() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}

function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const status = searchParams.get("status") ?? "pending";
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (status === "expired") return "验证链接已过期";
    if (status === "invalid") return "验证链接无效";
    return "请先验证邮箱";
  }, [status]);

  const description = useMemo(() => {
    if (status === "expired") {
      return "你可以重新发送一封新的验证邮件。";
    }

    if (status === "invalid") {
      return "这个验证链接已经失效或不正确。";
    }

    return "我们已经向你的 NYU 邮箱发送了一封验证邮件。";
  }, [status]);

  async function handleResend() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "重发失败，请稍后重试");
        setLoading(false);
        return;
      }

      setMessage(result.message || "验证邮件已重新发送");
    } catch {
      setError("重发失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-lg py-10 px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className="rounded-lg bg-[#f5f0fb] p-3 text-sm text-[#57068c] text-center">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="netid@nyu.edu"
            />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handleResend}
            disabled={loading || !email.trim()}
          >
            {loading ? "发送中..." : "重新发送验证邮件"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            完成验证后前往{" "}
            <Link href="/login" className="text-primary hover:underline">
              登录页
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
