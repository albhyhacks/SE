"use client";
import { useEffect, useRef, useState } from "react";
// Client-side filter + full-screen photo viewer for the comparison page.
import { isChanged, type ComparedItem } from "@/lib/comparison";
import { ratingInfo } from "@/lib/ratings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Item = ComparedItem & {
  in: { rating: number | null; notes: string | null; photos: { id: string; sha256: string }[] };
  out: { rating: number | null; notes: string | null; photos: { id: string; sha256: string }[] } | null;
};

export function ComparisonList({ tenancyId, items }: { tenancyId: string; items: Item[] }) {
  // Default per SPEC: only changed items.
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [viewing, setViewing] = useState<{ item: Item; side: "in" | "out"; start: number } | null>(null);
  const visible = onlyChanged ? items.filter(isChanged) : items;

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
        Only changed items {onlyChanged ? `(${visible.length} of ${items.length})` : ""}
      </label>

      {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing flagged — every captured item looks the same or better.</p>}

      <ul className="space-y-3">
        {visible.map((c) => (
          <li key={c.itemId} className="rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{c.roomName} · {c.itemName}</span>
              {c.flags.worse && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-900">Worse</span>}
              {c.flags.missing && <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white">Missing</span>}
              {c.flags.newNote && !c.flags.worse && !c.flags.missing && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">New note</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SidePanel tenancyId={tenancyId} label="Move-in" side={c.in} onOpenPhoto={(i) => setViewing({ item: c, side: "in", start: i })} />
              {c.out ? (
                <SidePanel tenancyId={tenancyId} label="Move-out" side={c.out} onOpenPhoto={(i) => setViewing({ item: c, side: "out", start: i })} />
              ) : (
                <div className="text-muted-foreground">Not captured yet</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {viewing && <PhotoViewer tenancyId={tenancyId} view={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function SidePanel({ tenancyId, label, side, onOpenPhoto }: {
  tenancyId: string; label: string;
  side: { rating: number | null; notes: string | null; photos: { id: string }[] };
  onOpenPhoto: (start: number) => void;
}) {
  const r = ratingInfo(side.rating);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {r ? <span className={cn("inline-block rounded px-2 py-0.5 text-xs", r.className)}>{r.label}</span> : <span className="text-xs text-muted-foreground">Not rated</span>}
      {side.notes && <p className="text-xs text-muted-foreground">{side.notes}</p>}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {side.photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => onOpenPhoto(i)} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, member-checked route */}
            <img src={`/t/${tenancyId}/photo/${p.id}`} alt={`${label} photo`} className="size-16 rounded object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Full-screen viewer that swipes between that side's photos (scroll-snap strip). */
function PhotoViewer({ tenancyId, view, onClose }: {
  tenancyId: string; view: { item: Item; side: "in" | "out"; start: number }; onClose: () => void;
}) {
  const photos = view.side === "in" ? view.item.in.photos : view.item.out?.photos ?? [];
  const label = view.side === "in" ? "Move-in" : "Move-out";
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.children[view.start]?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [view]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-label={`${label} photos of ${view.item.itemName}`}>
      <div className="flex items-center justify-between p-3 text-white">
        <p className="text-sm">{view.item.roomName} · {view.item.itemName} — {label}</p>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close ✕</Button>
      </div>
      <div ref={strip} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-2">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- private, member-checked route
          <img
            key={p.id}
            src={`/t/${tenancyId}/photo/${p.id}`}
            alt={`${label} photo ${i + 1}`}
            className="min-w-0 snap-center object-contain"
            style={{ minWidth: "96%" }}
          />
        ))}
      </div>
      <p className="p-3 text-center text-xs text-white/70">Swipe for the next photo</p>
    </div>
  );
}
