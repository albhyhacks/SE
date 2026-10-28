import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/lib/tenancies";

const LABEL: Record<ReportStatus, string> = { DRAFT: "Draft", REVIEW: "In review", LOCKED: "Locked" };

export function StatusBadge({ status, selfAttested }: { status: ReportStatus | null; selfAttested?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      {status ? <Badge variant={status === "LOCKED" ? "default" : "secondary"}>{LABEL[status]}</Badge> : <Badge variant="outline">Not started</Badge>}
      {selfAttested && <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">Self-attested</Badge>}
    </span>
  );
}
