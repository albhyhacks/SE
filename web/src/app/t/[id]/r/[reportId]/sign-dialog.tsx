"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countersign, selfLock, submitReport } from "./actions";

const COPY = {
  submit: {
    title: "Submit and sign",
    body: "By signing, you confirm this report matches the property today. This is an evidence record, not a legal contract.",
  },
  countersign: {
    title: "Review and sign",
    body: "You are signing the report exactly as you reviewed it. When both parties have signed the same hash, the report locks and cannot be changed. This is an evidence record, not a legal contract.",
  },
  self: {
    title: "Self-attest and lock",
    body: "Only you have signed. The report will be marked self-attested everywhere it appears, and it cannot be changed after locking.",
  },
} as const;

export function SignDialog(props: {
  mode: keyof typeof COPY;
  tenancyId: string; reportId: string; hash: string;
  triggerLabel: string; triggerVariant?: "default" | "outline";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const copy = COPY[props.mode];

  const confirm = () =>
    start(async () => {
      try {
        const r =
          props.mode === "submit" ? await submitReport(props.tenancyId, props.reportId, name)
          : props.mode === "countersign" ? await countersign(props.tenancyId, props.reportId, props.hash, name)
          : await selfLock(props.tenancyId, props.reportId, name);
        if (r.error) return void toast.error(r.error);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Could not connect. Check your connection and try again.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={props.triggerVariant ?? "default"} className="h-12 w-full text-base" disabled={props.disabled} />}>
        {props.triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm">
            Report hash <span className="font-mono text-xs">{props.hash.slice(0, 12)}…</span>
          </p>
          <Label htmlFor="typed-name">Type your full name</Label>
          <Input
            id="typed-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="e.g. Priya Sharma"
          />
        </div>
        <DialogFooter>
          <Button onClick={confirm} disabled={pending || name.trim().length < 2} className="w-full h-11">
            {pending ? "Signing…" : copy.title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
