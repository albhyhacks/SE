import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { depositWarning, STATE_LABELS } from "@/lib/india-rules";
import { getTenancy, listAudit, listDeductions, otherRole, roleLabel, type ReportRow } from "@/lib/tenancies";
import { AppHeader } from "@/components/app-header";
import { SettlementCard } from "@/components/settlement-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InviteShare } from "./invite-share";
import { StartMoveOutForm } from "./start-moveout-form";
import { fmtIST, inr, todayIST } from "@/lib/format";


export default async function TenancyHome({ params }: PageProps<"/t/[id]">) {
  const { id } = await params;
  const { user, membership } = await requireMember(id);
  const data = getTenancy(id);
  if (!data) notFound();
  const { tenancy: t, members, moveIn, moveOut } = data;
  const warning = depositWarning(t.state_code, t.monthly_rent, t.deposit);
  const other = otherRole(membership.role);
  const otherJoined = members.some((m) => m.role === other);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <>
      <AppHeader user={user} />
      <h1 className="text-xl font-bold">{t.address}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{STATE_LABELS[t.state_code]}</p>

      <div className="space-y-4">
        <Card className="grid grid-cols-2 gap-2 p-4 text-sm">
          <span className="text-muted-foreground">Monthly rent</span><span className="text-right font-medium">{inr(t.monthly_rent)}</span>
          <span className="text-muted-foreground">Deposit</span><span className="text-right font-medium">{inr(t.deposit)}</span>
          {warning && <p className="col-span-2 rounded bg-amber-50 p-2 text-amber-900">{warning}</p>}
        </Card>

        <Card className="space-y-2 p-4 text-sm">
          {(["OWNER", "TENANT"] as const).map((r) => {
            const m = members.find((x) => x.role === r);
            return (
              <div key={r} className="flex justify-between">
                <span className="text-muted-foreground">{roleLabel(r)}</span>
                <span className={m ? "font-medium" : "italic text-muted-foreground"}>
                  {m ? `${m.display_name}${m.user_id === user.id ? " (you)" : ""}` : "Not joined yet"}
                </span>
              </div>
            );
          })}
        </Card>

        {[moveIn, moveOut].filter((r) => r?.status === "LOCKED").map((r) => {
          const what = r!.type === "MOVE_IN" ? "move-in" : "move-out";
          const text = `Our ${what} report for ${t.address} is locked on MoveProof. Verify it here: ${appUrl}/verify/${r!.id}`;
          return (
            <a key={r!.id} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
              Share {what} verify link on WhatsApp
            </a>
          );
        })}

        {!otherJoined && <InviteShare link={`${appUrl}/join/${t.invite_code}`} address={t.address} otherLabel={roleLabel(other)} />}

        <ReportCard tenancyId={id} title="Move-in report" report={moveIn} />
        <ReportMoveOutCard tenancyId={id} moveIn={moveIn} moveOut={moveOut} membersCount={members.length} />
        {(moveOut || moveIn?.status === "LOCKED") && (
          <Link href={`/t/${id}/compare`} className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}>
            Compare move-in with move-out →
          </Link>
        )}

        {moveOut?.status === "LOCKED" && (
          <SettlementCard
            deposit={t.deposit}
            deductions={listDeductions(id)}
            stateCode={t.state_code}
            moveOutDate={t.move_out_date}
            tenancyId={id}
          />
        )}

        <section>
          <h2 className="mb-2 font-semibold">Activity</h2>
          <ol className="space-y-1 text-sm">
            {listAudit(id).map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{a.text}</span>
                <time className="shrink-0 text-muted-foreground">{fmtIST(a.at, "short")}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function ReportCard({ tenancyId, title, report, disabledText }: { tenancyId: string; title: string; report: ReportRow | null; disabledText?: string }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <StatusBadge status={report?.status ?? null} selfAttested={!!report?.self_attested} />
      </div>
      {disabledText ? (
        <p className="text-sm text-muted-foreground">{disabledText}</p>
      ) : report ? (
        <Link href={`/t/${tenancyId}/r/${report.id}`} className={buttonVariants({ className: "h-11 w-full" })}>Open report</Link>
      ) : null}
    </Card>
  );
}

function ReportMoveOutCard({ tenancyId, moveIn, moveOut, membersCount }: { tenancyId: string; moveIn: ReportRow | null; moveOut: ReportRow | null; membersCount: number }) {
  const canStart = moveIn?.status === "LOCKED" && !moveOut;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Move-out report</h2>
        <StatusBadge status={moveOut?.status ?? null} selfAttested={!!moveOut?.self_attested} />
      </div>
      {moveOut ? (
        <>
          <Link href={`/t/${tenancyId}/r/${moveOut.id}`} className={buttonVariants({ className: "h-11 w-full" })}>Open report</Link>
          {moveOut.status !== "LOCKED" && (
            <p className="text-sm text-muted-foreground">{membersCount < 2 ? "Complete and self-attest it." : "Complete, submit, then both sign."}</p>
          )}
        </>
      ) : canStart ? (
        <StartMoveOutForm tenancyId={tenancyId} today={todayIST()} />
      ) : (
        <p className="text-sm text-muted-foreground">Available after the move-in report is locked.</p>
      )}
    </Card>
  );
}
