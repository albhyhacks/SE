// Local photo storage: data/photos/<tenancyId>/<sha256>.jpg (content-addressed).
import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

const ROOT = path.join(DATA_DIR, "photos");
export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f-]{36}$/;

export const sha256Hex = (buf: Uint8Array) => createHash("sha256").update(buf).digest("hex");
export const photoPath = (tenancyId: string, sha: string) => `${tenancyId}/${sha}.jpg`;

function absPath(rel: string) {
  const [tid, file] = rel.split("/");
  if (!ID.test(tid) || !SHA.test(file?.replace(/\.jpg$/, "") ?? "")) throw new Error("Bad photo path");
  return path.join(ROOT, tid, file);
}

export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export async function writePhoto(rel: string, bytes: Uint8Array) {
  const file = absPath(rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export const readPhoto = (rel: string) => readFile(absPath(rel));
export const deletePhotoFile = (rel: string) => rm(absPath(rel), { force: true });
