import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/auth";

export function AppHeader({ user }: { user: User }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-2 border-b pb-3">
      <Link href="/dashboard" className="font-bold">MoveProof</Link>
      <form action={signOut} className="flex items-center gap-2">
        <span className="max-w-40 truncate text-sm text-muted-foreground">{user.email}</span>
        <Button type="submit" variant="outline" size="sm">Sign out</Button>
      </form>
    </header>
  );
}
