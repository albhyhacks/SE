"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(hash);
          setCopied(true);
          toast.info("Report hash copied.");
        } catch {
          toast.error("Could not copy. Long-press the hash to copy it.");
        }
      }}
    >
      {copied ? "Copied ✓" : "Copy full hash"}
    </Button>
  );
}
