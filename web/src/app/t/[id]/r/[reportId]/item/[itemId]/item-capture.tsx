"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraCapture, type Shot } from "@/components/camera-capture";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { photoRequired, RATINGS } from "@/lib/ratings";
import { cn } from "@/lib/utils";
import { deletePhoto, saveEntry, uploadPhoto } from "./actions";
import { fmtIST } from "@/lib/format";

type Photo = { id: string; uploaded_at: string; source: string };
type Pending = Shot & { state: "uploading" | "failed"; error?: string };

export function ItemCapture(props: {
  ids: { tenancyId: string; reportId: string; itemId: string };
  isOverview: boolean; rating: number | null; notes: string | null;
  photos: Photo[]; referencePhotos?: Pick<Photo, "id" | "uploaded_at">[]; canEdit: boolean; nextHref: string;
}) {  const { tenancyId, reportId, itemId } = props.ids;
  const router = useRouter();
  const [rating, setRating] = useState(props.rating);
  const [notes, setNotes] = useState(props.notes ?? "");
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, startSave] = useTransition();
  const [viewing, setViewing] = useState<string | null>(null);
  const needPhoto = photoRequired(rating, props.isOverview);

  // Keep the blob in memory until the server confirms, so a failed upload can be retried.
  const upload = async (shot: Shot) => {
    setPending((p) => [...p.filter((x) => x.sha256 !== shot.sha256), { ...shot, state: "uploading" }]);
    const form = new FormData();
    form.set("photo", shot.blob, `${shot.sha256}.jpg`);
    form.set("sha256", shot.sha256);
    form.set("capturedAt", shot.capturedAt);
    form.set("source", shot.source);
    try {
      const r = await uploadPhoto(tenancyId, reportId, itemId, form);
      if (r.error) throw new Error(r.error);
      if (r.duplicate) toast.info("That photo is already attached.");
      setPending((p) => p.filter((x) => x.sha256 !== shot.sha256));
      URL.revokeObjectURL(shot.url);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Upload failed. Check your connection.";
      setPending((p) => p.map((x) => (x.sha256 === shot.sha256 ? { ...x, state: "failed", error: msg } : x)));
    }
  };

  const remove = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    const r = await deletePhoto(tenancyId, reportId, itemId, photoId);
    if (r.error) toast.error(r.error);
    router.refresh();
  };

  const save = () =>
    startSave(async () => {
      if (!rating) return void toast.error("Pick a rating first.");
      try {
        const r = await saveEntry(tenancyId, reportId, itemId, { rating, notes });
        if (r.error) return void toast.error(r.error);
        if (needPhoto && props.photos.length === 0) toast.warning("Saved. This item still needs a photo.");
        router.push(props.nextHref);
      } catch {
        toast.error("Could not save. Check your connection and try again.");
      }
    });

  const photoUrl = (id: string) => `/t/${tenancyId}/photo/${id}`;

  return (
    <div className="space-y-6">
      <fieldset disabled={!props.canEdit} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Condition</legend>
        <div className="grid grid-cols-3 gap-2">
          {RATINGS.map((r) => (
            <button key={r.value} type="button" onClick={() => setRating(r.value)} aria-pressed={rating === r.value}
              className={cn("h-14 rounded-lg border text-sm font-medium transition",
                rating === r.value ? cn(r.className, "ring-2 ring-primary ring-offset-1") : "bg-background")}>
              <span className="block text-xs opacity-70">{r.value}</span>{r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} maxLength={1000} disabled={!props.canEdit} className="text-base"
          placeholder="e.g. small crack near the switch" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <section className="space-y-3">
        <p className="text-sm font-medium">
          Photos {needPhoto && <span className="text-destructive">· required{props.isOverview ? " (room overview)" : " for this rating"}</span>}
        </p>
        {props.referencePhotos && props.referencePhotos.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-2">
            <p className="text-xs font-medium text-muted-foreground">Move-in — same item, for comparison</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {props.referencePhotos.map((p) => (
                <figure key={p.id} className="shrink-0">
                  <button type="button" onClick={() => setViewing(p.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, member-checked route */}
                    <img src={photoUrl(p.id)} alt="Move-in photo" className="size-24 rounded-lg object-cover ring-1 ring-border" />
                  </button>
                  <figcaption className="w-24 text-[10px] leading-tight text-muted-foreground">{fmtIST(p.uploaded_at, "short")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {props.photos.map((p) => (
            <figure key={p.id} className="relative shrink-0">
              <button type="button" onClick={() => setViewing(p.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private, member-checked route */}
                <img src={photoUrl(p.id)} alt="Item photo" className="size-24 rounded-lg object-cover" />
              </button>
              <figcaption className="w-24 text-[10px] leading-tight text-muted-foreground">
                {fmtIST(p.uploaded_at, "short")} · verified ✓
                {p.source === "dev_upload" && <span className="text-destructive"> · dev upload</span>}
              </figcaption>
              {props.canEdit && (
                <button type="button" onClick={() => remove(p.id)} aria-label="Delete photo"
                  className="absolute right-1 top-1 size-7 rounded-full bg-black/60 text-white">✕</button>
              )}
            </figure>
          ))}
          {pending.map((p) => (
            <figure key={p.sha256} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={p.url} alt="Uploading photo" className={cn("size-24 rounded-lg object-cover", p.state === "uploading" && "animate-pulse opacity-60")} />
              {p.state === "uploading" ? (
                <figcaption className="text-[10px]">Uploading…</figcaption>
              ) : (
                <figcaption className="w-24 space-y-1 text-[10px] text-destructive">
                  {p.error}
                  <Button type="button" size="sm" variant="outline" className="h-7 w-full" onClick={() => upload(p)}>Retry</Button>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        {props.canEdit && <CameraCapture onShot={upload} />}
      </section>

      {props.canEdit && (
        <Button type="button" size="lg" className="sticky bottom-4 h-12 w-full text-base shadow-lg" onClick={save}
          disabled={saving || pending.some((p) => p.state === "uploading")}>
          {saving ? "Saving…" : "Save and next item"}
        </Button>
      )}

      {viewing && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- private, member-checked route */}
          <img src={photoUrl(viewing)} alt="Full photo" className="max-h-full max-w-full" />
        </button>
      )}
    </div>
  );
}
