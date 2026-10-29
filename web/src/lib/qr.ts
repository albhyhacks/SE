// QR codes and public links for the verify page.
import "server-only";
import QRCode from "qrcode";

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const verifyUrl = (reportId: string) => `${appUrl()}/verify/${reportId}`;
export const qrDataUrl = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: "M" });
