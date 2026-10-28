import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { depositWarning, STATE_LABELS } from "@/lib/india-rules";
import { getTenancy, listAudit, otherRole, roleLabel, type ReportRow } from "@/lib/tenancies";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InviteShare } from "./invite-share";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

        {!otherJoined && <InviteShare link={`${appUrl}/join/${t.invite_code}`} address={t.address} otherLabel={roleLabel(other)} />}

        <ReportCard tenancyId={id} title="Move-in report" report={moveIn} />
        <ReportCard tenancyId={id} title="Move-out report" report={moveOut}
          disabledText={moveIn?.status === "LOCKED" ? undefined : "Available after the move-in report is locked."} />

        <section>
          <h2 className="mb-2 font-semibold">Activity</h2>
          <ol className="space-y-1 text-sm">
            {listAudit(id).map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{a.text}</span>
                <time className="shrink-0 text-muted-foreground">{new Date(a.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</time>
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
        <StatusBadge status={report?.status ?? null} />
      </div>
      {disabledText ? (
        <p className="text-sm text-muted-foreground">{disabledText}</p>
      ) : report ? (
        <Link href={`/t/${tenancyId}/r/${report.id}`} className={buttonVariants({ className: "h-11 w-full" })}>Open report</Link>
      ) : null}
    </Card>
  );
}
