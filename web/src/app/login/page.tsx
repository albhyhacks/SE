import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  // Only allow same-site relative paths (no open redirect).
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  if (await getUser()) redirect(next);
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-muted-foreground">We&apos;ll email you a 6-digit code. No password.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
