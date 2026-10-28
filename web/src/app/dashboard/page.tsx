import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";

export default async function Dashboard() {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <h1 className="mb-4 text-2xl font-bold">My tenancies</h1>
      <p className="mb-6 text-muted-foreground">No tenancies yet.</p>
      <Link href="/tenancies/new" className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}>
        Start a report
      </Link>
    </>
  );
}
