"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { proposeDeduction, respondDeduction, withdrawDeduction } from "./actions";

export type Status = "PROPOSED" | "ACCEPTED" | "DISPUTED" | "WITHDRAWN";

/** Owner: dialog with amount, reason, note. Blocked unless the move-out report is LOCKED. */
export function ProposeDeduction({ tenancyId, itemId, itemName, locked }: { tenancyId: string; itemId: string; itemName: string; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      const r = await proposeDeduction(tenancyId, itemId, fd.get("amount"), fd.get("reason"), fd.get("note"));
      if (r.error) return void toast.error(r.error);
      setOpen(false);
      toast.success(`Deduction proposed on ${itemName}.`);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={!locked} />}>Add deduction</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deduction on {itemName}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), submit(new FormData(e.currentTarget)))}>
          <div className="space-y-2">
            <Label htmlFor={`amount-${itemId}`}>Amount (₹)</Label>
            <Input id={`amount-${itemId}`} name="amount" type="number" inputMode="numeric" min={1} step={1} required className="h-11 text-base" placeholder="e.g. 1500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${itemId}`}>Reason</Label>
            <select id={`reason-${itemId}`} name="reason" required className="h-11 w-full rounded-md border bg-background px-3 text-base">
              <option value="CLEANING">Cleaning</option>
              <option value="DAMAGE">Damage</option>
              <option value="MISSING">Missing</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`note-${itemId}`}>Note (optional)</Label>
            <Input id={`note-${itemId}`} name="note" maxLength={1000} className="h-11 text-base" placeholder="e.g. Burn mark on counter" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Proposing…" : "Propose"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Tenant: accept (note optional) or dispute (note required). */
export function RespondDeduction({ tenancyId, deductionId }: { tenancyId: string; deductionId: string }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const respond = (response: "ACCEPTED" | "DISPUTED") =>
    start(async () => {
      const r = await respondDeduction(tenancyId, deductionId, response, note);
      if (r.error) return void toast.error(r.error);
      toast.success(response === "ACCEPTED" ? "Deduction accepted." : "Deduction disputed.");
    });

  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => (e.preventDefault(), respond("ACCEPTED"))}>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required when disputing)" maxLength={1000} className="h-10 text-sm" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>Accept</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending || note.trim() === ""} onClick={() => respond("DISPUTED")}>Dispute</Button>
      </div>
    </form>
  );
}

/** Owner: withdraw a PROPOSED or DISPUTED deduction. */
export function WithdrawDeduction({ tenancyId, deductionId }: { tenancyId: string; deductionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await withdrawDeduction(tenancyId, deductionId);
          if (r.error) return void toast.error(r.error);
          toast.success("Deduction withdrawn.");
        })
      }
    >
      Withdraw
    </Button>
  );
}

export type Deduction = { id: string; item_id: string; amount: number; reason: string; status: Status; owner_note: string | null; tenant_note: string | null };
