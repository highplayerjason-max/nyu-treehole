"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VerifyEmailPageWrapper() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}

function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const error = searchParams.get("error"); // missing | invalid | expired

  const [email, setEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendMsg, setResendMsg] = useState("");

  async function handleResend() {
    if (!email.trim()) return;
    setResendStatus("sending");
    setResendMsg("");
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setResendStatus("sent");
      setResendMsg("验证邮件已发送，请检查收件箱（包括垃圾邮件）");
    } else {
      setResendStatus("error");
      setResendMsg(data.error || "发送失败，请稍后重试");
    }
  }

  if (success) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-xl">邮箱验证成功！</CardTitle>
            <CardDescription>你的账号已激活，现在可以登录了</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href="/login" />}
              className="w-full"
            >
              立即登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing: "验证链接无效，请重新发送验证邮件",
    invalid: "验证链接无效或已被使用，请重新发送验证邮件",
    expired: "验证链接已过期（有效期24小时），请重新发送",
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#f5f0fb] flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-[#7c3aed]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <CardTitle className="text-xl">
            {error ? "链接已失效" : "请验证你的邮箱"}
          </CardTitle>
          <CardDescription>
            {error
              ? errorMessages[error] || "验证失败"
              : "注册成功！请检查你的邮箱，点击验证链接激活账号"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!error && (
            <div className="rounded-lg bg-[#f5f0fb] p-3 text-sm text-[#57068c] space-y-1">
              <p>📬 验证邮件已发送到你的注册邮箱</p>
              <p className="text-xs text-muted-foreground">没收到？检查垃圾邮件，或重新发送</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">重新发送验证邮件</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="输入注册邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                onClick={handleResend}
                disabled={resendStatus === "sending" || !email.trim()}
                variant="outline"
                className="shrink-0"
              >
                {resendStatus === "sending" ? "发送中..." : "发送"}
              </Button>
            </div>
            {resendMsg && (
              <p
                className={`text-xs ${
                  resendStatus === "sent" ? "text-green-600" : "text-red-500"
                }`}
              >
                {resendMsg}
              </p>
            )}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
