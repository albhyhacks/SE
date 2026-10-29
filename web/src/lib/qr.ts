// QR codes and public links (invite, verify).
import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Public base URL: NEXT_PUBLIC_APP_URL if set, else the address this request came in on
 *  (so a changing quick-tunnel URL works without a rebuild). Links are only shown back to the requester. */
export async function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]}://${host}`;
}
export const verifyUrl = async (reportId: string) => `${await appUrl()}/verify/${reportId}`;
export const qrDataUrl = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: "M" });
