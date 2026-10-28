"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinTenancy } from "./actions";

export function JoinForm({ code, roleLabel }: { code: string; roleLabel: string }) {
  const [state, action, pending] = useActionState(joinTenancy, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoComplete="name" className="h-12 text-base" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Joining…" : `Join as ${roleLabel}`}
      </Button>
    </form>
  );
}
