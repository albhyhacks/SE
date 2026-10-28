"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type Shot = { blob: Blob; sha256: string; capturedAt: string; source: "camera" | "dev_upload"; url: string };

const MAX_EDGE = 1600;
const QUALITY = 0.75;
const DEV_UPLOAD = process.env.NEXT_PUBLIC_ALLOW_DEV_UPLOAD === "true";

async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Draws a frame scaled to ≤1600 px long edge and encodes JPEG q0.75. */
async function encode(src: CanvasImageSource, w: number, h: number, source: Shot["source"]): Promise<Shot> {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("encode failed"))), "image/jpeg", QUALITY));
  return { blob, sha256: await sha256Hex(blob), capturedAt: new Date().toISOString(), source, url: URL.createObjectURL(blob) };
}

function cameraError(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (!window.isSecureContext) return "The camera needs a secure (https) link. Open MoveProof through its https address.";
  if (name === "NotAllowedError") return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it and try again.";
  return "Could not open the camera.";
}

export function CameraCapture({ onShot, disabled }: { onShot: (s: Shot) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError(cameraError(null));
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      setOpen(true);
    } catch (err) {
      stop();
      setError(cameraError(err));
    }
  };

  useEffect(() => {
    if (open && video.current && stream.current) video.current.srcObject = stream.current;
  }, [open]);

  const close = () => {
    stop();
    setOpen(false);
  };

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    try {
      onShot(await encode(v, v.videoWidth, v.videoHeight, "camera"));
      close();
    } finally {
      setBusy(false);
    }
  };

  const devPick = async (file: File | undefined) => {
    if (!file) return;
    const img = await createImageBitmap(file);
    onShot(await encode(img, img.width, img.height, "dev_upload"));
  };

  return (
    <div className="space-y-2">
      <Button type="button" size="lg" className="h-12 w-full text-base" onClick={start} disabled={disabled}>
        📷 Take photo
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {DEV_UPLOAD && (
        <label className="block text-center text-xs text-muted-foreground underline">
          Dev upload (not for real reports)
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => devPick(e.target.files?.[0])} />
        </label>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <video ref={video} autoPlay playsInline muted className="min-h-0 flex-1 object-contain" />
          <div className="flex items-center justify-between p-6 pb-10">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <button type="button" aria-label="Take photo" onClick={shoot} disabled={busy}
              className="size-20 rounded-full border-4 border-white bg-white/80 active:bg-white disabled:opacity-50" />
            <span className="w-16" />
          </div>
        </div>
      )}
    </div>
  );
}
