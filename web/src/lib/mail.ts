// Sends the login code. Gmail SMTP when SMTP_USER/SMTP_PASS are set; otherwise prints to the server console.
import "server-only";
import nodemailer from "nodemailer";

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const transport = user && pass
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } })
  : null;

export async function sendLoginCode(to: string, code: string) {
  if (!transport) {
    console.log(`[MoveProof] login code for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: `MoveProof <${process.env.SMTP_FROM || user}>`,
    to,
    subject: "Your MoveProof login code",
    text: `Your MoveProof login code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
  });
}
