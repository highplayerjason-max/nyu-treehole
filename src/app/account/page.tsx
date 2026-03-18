"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/language-context";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLanguage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!session?.user) {
    router.push("/login");
    return null;
  }

  async function handleDeleteAccount() {
    if (confirmEmail.trim().toLowerCase() !== session?.user?.email?.toLowerCase()) {
      toast.error(t.account.emailMismatch);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t.account.deleteError);
        setDeleting(false);
        return;
      }
      toast.success(t.account.deleteSuccess);
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error(t.account.deleteError);
      setDeleting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-lg py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">{t.account.title}</h1>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.account.info}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">昵称</Label>
            <p className="text-sm font-medium">{session.user.name}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">邮箱</Label>
            <p className="text-sm font-medium">{session.user.email}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">角色</Label>
            <p className="text-sm font-medium">
              {session.user.role === "ADMIN" ? "管理员" : "普通用户"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            {t.account.danger}
          </CardTitle>
          <CardDescription>{t.account.deleteDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => {
              setConfirmEmail("");
              setDialogOpen(true);
            }}
          >
            {t.account.deleteAccount}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.account.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{t.account.deleteConfirmDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="email"
              placeholder={session.user.email ?? ""}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !deleting) handleDeleteAccount();
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={deleting}
              >
                {t.account.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || !confirmEmail.trim()}
              >
                {deleting ? t.account.deleting : t.account.deleteConfirmButton}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
