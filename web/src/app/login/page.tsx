import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  const next = safeNext(raw);
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

// Only same-origin paths; "//x" and "/\\x" would otherwise leave the site.
function safeNext(raw: unknown) {
  if (typeof raw !== "string" || !/^\/(?![\\/])/.test(raw)) return "/dashboard";
  try {
    const u = new URL(raw, "http://local.invalid");
    return u.origin === "http://local.invalid" ? u.pathname + u.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
