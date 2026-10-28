import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { loadReport } from "@/lib/reports";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { ChecklistEditor } from "./checklist-editor";

export default async function ReportPage({ params }: PageProps<"/t/[id]/r/[reportId]">) {
  const { id, reportId } = await params;
  const { user } = await requireMember(id);
  const data = loadReport(id, reportId);
  if (!data) notFound();
  const { report, rooms } = data;
  const canEditChecklist = report.type === "MOVE_IN" && report.status === "DRAFT" && report.created_by === user.id;

  return (
    <>
      <AppHeader user={user} />
      <Link href={`/t/${id}`} className="text-sm text-muted-foreground">← Tenancy</Link>
      <div className="mb-4 mt-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">{report.type === "MOVE_IN" ? "Move-in report" : "Move-out report"}</h1>
        <StatusBadge status={report.status} />
      </div>
      {/* Phase 3 replaces this list with capture progress per room. */}
      <ul className="mb-6 space-y-2">
        {rooms.map((r) => (
          <li key={r.id} className="flex justify-between rounded-lg border p-3">
            <span className="font-medium">{r.name}</span>
            <span className="text-sm text-muted-foreground">{r.items.filter((i) => i.rating).length}/{r.items.length} rated</span>
          </li>
        ))}
      </ul>
      {canEditChecklist && (
        <section>
          <h2 className="mb-2 font-semibold">Edit checklist</h2>
          <ChecklistEditor tenancyId={id} rooms={rooms} />
        </section>
      )}
    </>
  );
}
