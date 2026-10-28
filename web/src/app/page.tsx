import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">MoveProof</h1>
        <p className="text-muted-foreground">Proof of your room&apos;s condition, signed by both sides.</p>
      </div>
      <p className="text-lg">
        Most deposit fights are about proof. MoveProof gives both sides the same signed record.
      </p>
      <div className="flex flex-col gap-3">
        <Link href="/tenancies/new" className={buttonVariants({ size: "lg", className: "h-12 text-base" })}>
          Start a report
        </Link>
        <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline", className: "h-12 text-base" })}>
          I have an invite
        </Link>
      </div>
    </div>
  );
}
