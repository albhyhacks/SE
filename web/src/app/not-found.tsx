import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">This link may be wrong, or you may not be a member of this tenancy.</p>
      <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "h-12 text-base" })}>Go to my tenancies</Link>
    </div>
  );
}
