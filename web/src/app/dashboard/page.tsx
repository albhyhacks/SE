import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listTenancies, roleLabel } from "@/lib/tenancies";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function Dashboard() {
  const user = await requireUser();
  const tenancies = listTenancies(user.id);
  return (
    <>
      <AppHeader user={user} />
      <h1 className="mb-4 text-2xl font-bold">My tenancies</h1>
      {tenancies.length === 0 && <p className="mb-6 text-muted-foreground">No tenancies yet.</p>}
      <div className="mb-6 space-y-3">
        {tenancies.map((t) => (
          <Link key={t.id} href={`/t/${t.id}`} className="block">
            <Card className="space-y-2 p-4">
              <p className="font-medium">{t.address}</p>
              <p className="text-sm text-muted-foreground">You are the {roleLabel(t.role).toLowerCase()}</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1">Move-in <StatusBadge status={t.move_in} /></span>
                <span className="flex items-center gap-1">Move-out <StatusBadge status={t.move_out} /></span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Link href="/tenancies/new" className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}>
        Start a report
      </Link>
    </>
  );
}
