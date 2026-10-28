"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkCode, requestCode } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () =>
    start(async () => {
      const r = await requestCode(email);
      if (r.error) return void toast.error(r.error);
      setStep("code");
      setCooldown(60);
      toast.success("Code sent. Check your email.");
    });

  const verify = () =>
    start(async () => {
      const r = await checkCode(email, code);
      if (r.error) return void toast.error(r.error);
      router.replace(next);
    });

  return step === "email" ? (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), send())}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="email" required className="h-12 text-base"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Sending…" : "Send code"}
      </Button>
    </form>
  ) : (
    <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), verify())}>
      <div className="space-y-2">
        <Label htmlFor="code">6-digit code sent to {email}</Label>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
          className="h-12 text-center text-2xl tracking-[0.5em]" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={() => setStep("email")}>Change email</Button>
        <Button type="button" variant="ghost" disabled={cooldown > 0 || pending} onClick={send}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </form>
  );
}
