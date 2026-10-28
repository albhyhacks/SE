"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMoveOut, type StartMoveOutResult } from "./start-moveout";

export function StartMoveOutForm({ tenancyId, today }: { tenancyId: string; today: string }) {
  const [state, action, pending] = useActionState(createMoveOut.bind(null, tenancyId), {} as StartMoveOutResult);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="move-out-date">Move-out date</Label>
      <div className="flex gap-2">
        <Input id="move-out-date" name="move_out_date" type="date" defaultValue={today} required className="h-11 flex-1" />
        <Button type="submit" disabled={pending} className="h-11 shrink-0">
          {pending ? "Starting…" : "Start move-out"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
