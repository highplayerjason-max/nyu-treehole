"use client";

import { type FormEvent, useEffect, useState } from "react";
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
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
} from "@/lib/display-name";

const ACCOUNT_COPY = {
  zh: {
    loading: "\u52a0\u8f7d\u4e2d...",
    displayNameLabel: "\u7528\u6237\u540d",
    emailLabel: "\u90ae\u7bb1",
    roleLabel: "\u89d2\u8272",
    adminRole: "\u7ba1\u7406\u5458",
    userRole: "\u666e\u901a\u7528\u6237",
    editDisplayName: "\u4fee\u6539\u7528\u6237\u540d",
    editDisplayNameDesc:
      "\u7528\u6237\u540d\u6bcf 24 \u5c0f\u65f6\u53ea\u80fd\u4fee\u6539\u4e00\u6b21\u3002",
    displayNamePlaceholder: "\u8f93\u5165\u65b0\u7684\u7528\u6237\u540d",
    displayNameUpdated: "\u7528\u6237\u540d\u5df2\u66f4\u65b0",
    displayNameUpdateError:
      "\u66f4\u65b0\u7528\u6237\u540d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
    displayNameUnchanged:
      "\u65b0\u7528\u6237\u540d\u4e0d\u80fd\u548c\u5f53\u524d\u7528\u6237\u540d\u76f8\u540c",
    displayNameCooldown:
      "\u7528\u6237\u540d\u6bcf 24 \u5c0f\u65f6\u53ea\u80fd\u4fee\u6539\u4e00\u6b21",
    nextDisplayNameChange: "\u4e0b\u6b21\u53ef\u4fee\u6539\u65f6\u95f4",
    displayNameLengthHint: `\u7528\u6237\u540d\u9700\u8981 ${DISPLAY_NAME_MIN_LENGTH} - ${DISPLAY_NAME_MAX_LENGTH} \u4e2a\u5b57\u7b26`,
  },
  en: {
    loading: "Loading...",
    displayNameLabel: "Username",
    emailLabel: "Email",
    roleLabel: "Role",
    adminRole: "Admin",
    userRole: "User",
    editDisplayName: "Change Username",
    editDisplayNameDesc: "You can change your username once every 24 hours.",
    displayNamePlaceholder: "Enter a new username",
    displayNameUpdated: "Username updated",
    displayNameUpdateError: "Failed to update username, please try again",
    displayNameUnchanged:
      "The new username must be different from the current one",
    displayNameCooldown:
      "You can only change your username once every 24 hours",
    nextDisplayNameChange: "Next available change",
    displayNameLengthHint: `Use ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} characters for your username.`,
  },
} as const;

type ProfileResponse = {
  displayName?: string;
  nextAllowedAt?: string | null;
  error?: string;
  code?: string;
};

export default function AccountPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const copy = ACCOUNT_COPY[lang];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [currentDisplayName, setCurrentDisplayName] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [nextAllowedAt, setNextAllowedAt] = useState<string | null>(null);
  const [loadedProfileUserId, setLoadedProfileUserId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    const userId = session.user.id;
    const fallbackDisplayName = session.user.name ?? "";

    if (loadedProfileUserId === userId) {
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile", {
          signal: controller.signal,
        });
        const data = (await res.json()) as ProfileResponse;

        if (!active) {
          return;
        }

        const nextDisplayName = data.displayName ?? fallbackDisplayName;

        setCurrentDisplayName(nextDisplayName);
        setDisplayNameInput(nextDisplayName);
        setNextAllowedAt(data.nextAllowedAt ?? null);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCurrentDisplayName(fallbackDisplayName);
        setDisplayNameInput(fallbackDisplayName);
        setNextAllowedAt(null);
      } finally {
        if (active) {
          setLoadedProfileUserId(userId);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
      controller.abort();
    };
  }, [loadedProfileUserId, session?.user?.id, session?.user?.name, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">{copy.loading}</div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return null;
  }

  const sessionUser = session.user;
  const profileLoadedForCurrentUser = loadedProfileUserId === sessionUser.id;
  const profileLoading = !profileLoadedForCurrentUser;
  const displayNameToShow =
    (profileLoadedForCurrentUser ? currentDisplayName : sessionUser.name) ?? "";
  const inputValue =
    (profileLoadedForCurrentUser ? displayNameInput : sessionUser.name) ?? "";
  const effectiveNextAllowedAt = profileLoadedForCurrentUser
    ? nextAllowedAt
    : null;
  const trimmedDisplayName = inputValue.trim();
  const hasValidDisplayNameLength =
    trimmedDisplayName.length >= DISPLAY_NAME_MIN_LENGTH &&
    trimmedDisplayName.length <= DISPLAY_NAME_MAX_LENGTH;
  const renameLocked =
    effectiveNextAllowedAt !== null &&
    new Date(effectiveNextAllowedAt).getTime() > Date.now();
  const canSubmitDisplayName =
    !profileLoading &&
    !savingDisplayName &&
    !renameLocked &&
    hasValidDisplayNameLength &&
    trimmedDisplayName !== currentDisplayName;

  const formattedNextAllowedAt = effectiveNextAllowedAt
    ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(effectiveNextAllowedAt))
    : null;

  function getDisplayNameErrorMessage(data: ProfileResponse) {
    switch (data.code) {
      case "DISPLAY_NAME_UNCHANGED":
        return copy.displayNameUnchanged;
      case "DISPLAY_NAME_COOLDOWN":
        return copy.displayNameCooldown;
      default:
        return data.error || copy.displayNameUpdateError;
    }
  }

  async function handleUpdateDisplayName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmitDisplayName) {
      return;
    }

    setSavingDisplayName(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmedDisplayName }),
      });
      const data = (await res.json()) as ProfileResponse;

      if (!res.ok) {
        if (data.nextAllowedAt !== undefined) {
          setNextAllowedAt(data.nextAllowedAt ?? null);
        }
        toast.error(getDisplayNameErrorMessage(data));
        return;
      }

      const nextDisplayName = data.displayName ?? trimmedDisplayName;

      setCurrentDisplayName(nextDisplayName);
      setDisplayNameInput(nextDisplayName);
      setNextAllowedAt(data.nextAllowedAt ?? null);

      await update({ name: nextDisplayName });
      router.refresh();

      toast.success(copy.displayNameUpdated);
    } catch {
      toast.error(copy.displayNameUpdateError);
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleDeleteAccount() {
    if (
      confirmEmail.trim().toLowerCase() !== sessionUser.email?.toLowerCase()
    ) {
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
    <div className="container mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t.account.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.account.info}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {copy.displayNameLabel}
            </Label>
            <p className="text-sm font-medium">{displayNameToShow}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {copy.emailLabel}
            </Label>
            <p className="text-sm font-medium">{sessionUser.email}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {copy.roleLabel}
            </Label>
            <p className="text-sm font-medium">
              {sessionUser.role === "ADMIN" ? copy.adminRole : copy.userRole}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.editDisplayName}</CardTitle>
          <CardDescription>{copy.editDisplayNameDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateDisplayName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{copy.displayNameLabel}</Label>
              <Input
                id="displayName"
                value={inputValue}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder={copy.displayNamePlaceholder}
                minLength={DISPLAY_NAME_MIN_LENGTH}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                disabled={profileLoading || savingDisplayName}
                required
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {renameLocked && formattedNextAllowedAt
                ? `${copy.nextDisplayNameChange}: ${formattedNextAllowedAt}`
                : copy.displayNameLengthHint}
            </p>

            <Button type="submit" disabled={!canSubmitDisplayName}>
              {savingDisplayName ? t.common.saving : t.common.save}
            </Button>
          </form>
        </CardContent>
      </Card>

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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.account.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{t.account.deleteConfirmDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="email"
              placeholder={sessionUser.email ?? ""}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !deleting) {
                  void handleDeleteAccount();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={deleting}
              >
                {t.account.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteAccount()}
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
