"use client";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InviteShare({ link, address, otherLabel }: { link: string; address: string; otherLabel: string }) {
  const text = `Hi, I've started our move-in condition report for ${address} on MoveProof. Please review and sign so we both have the same record: ${link}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Long-press the link to copy it.");
    }
  };
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">Invite the {otherLabel.toLowerCase()}</p>
      <p className="break-all rounded bg-muted p-2 font-mono text-xs">{link}</p>
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
          className={cn(buttonVariants(), "h-11 bg-[#25D366] text-white hover:bg-[#1ebe57]")}>
          WhatsApp
        </a>
        <Button variant="outline" className="h-11" onClick={copy}>Copy link</Button>
      </div>
    </div>
  );
}
