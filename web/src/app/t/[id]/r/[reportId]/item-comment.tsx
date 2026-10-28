"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveReviewerComment } from "./actions";

export function ItemComment(props: {
  tenancyId: string; reportId: string; itemId: string;
  initial: string; room: string; item: string;
}) {
  const [text, setText] = useState(props.initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      try {
        const r = await saveReviewerComment(props.tenancyId, props.reportId, props.itemId, text);
        if (r.error) return void toast.error(r.error);
        toast.info("Comment saved.");
        router.refresh();
      } catch {
        toast.error("Could not connect. Check your connection and try again.");
      }
    });

  return (
    <div className="flex gap-2 pt-1">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        placeholder={`Comment on ${props.room} · ${props.item}`}
        aria-label={`Comment on ${props.room} ${props.item}`}
      />
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={save} disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
    </div>
  );
}
