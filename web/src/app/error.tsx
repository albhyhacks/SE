"use client";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">Nothing was lost. Check your connection and try again.</p>
      <Button size="lg" className="h-12 text-base" onClick={reset}>Try again</Button>
      <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline", className: "h-12 text-base" })}>Go to my tenancies</Link>
    </div>
  );
}
