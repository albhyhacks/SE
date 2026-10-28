"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestChanges } from "./actions";

export function RequestChanges({ tenancyId, reportId, hasComments }: { tenancyId: string; reportId: string; hasComments: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const click = () =>
    start(async () => {
      try {
        const r = await requestChanges(tenancyId, reportId);
        if (r.error) return void toast.error(r.error);
        toast.info("The report is back in draft. All signatures were removed.");
        router.refresh();
      } catch {
        toast.error("Could not connect. Check your connection and try again.");
      }
    });

  return (
    <Button variant="outline" className="h-12 w-full text-base" onClick={click} disabled={pending}>
      {pending ? "Reopening…" : hasComments ? "Request changes" : "Request changes (add a comment first)"}
    </Button>
  );
}
