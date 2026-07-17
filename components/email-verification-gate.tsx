"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EmailVerificationGate() {
  const session = useSession();
  const [sending, setSending] = useState(false);
  const user = session.data?.user;
  const guest = user?.email?.endsWith("@guest.local") === true;
  const required = Boolean(user && !user.emailVerified && !guest);

  async function resend() {
    if (!user?.email) return;
    setSending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: window.location.href,
      });
      if (result.error) throw new Error(result.error.message || "Unable to send email");
      toast.success("Verification email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send verification email");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={required}>
      <DialogContent onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Verify your email to continue</DialogTitle>
          <DialogDescription>
            We sent a verification link to <strong>{user?.email}</strong>. Verify it before using Watt AI.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={sending} onClick={resend}>
            {sending ? "Sending…" : "Send verification email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
