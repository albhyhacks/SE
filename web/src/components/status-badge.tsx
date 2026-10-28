import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/lib/tenancies";

const LABEL: Record<ReportStatus, string> = { DRAFT: "Draft", REVIEW: "In review", LOCKED: "Locked" };

export function StatusBadge({ status }: { status: ReportStatus | null }) {
  if (!status) return <Badge variant="outline">Not started</Badge>;
  return <Badge variant={status === "LOCKED" ? "default" : "secondary"}>{LABEL[status]}</Badge>;
}
