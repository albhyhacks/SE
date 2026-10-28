import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel, type Role } from "@/lib/tenancies";
import { AppHeader } from "@/components/app-header";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const user = await requireUser();
  const t = db().prepare("select id, address from tenancies where invite_code = ?").get(code) as { id: string; address: string } | undefined;
  const members = t ? (db().prepare("select user_id, role from members where tenancy_id = ?").all(t.id) as { user_id: string; role: Role }[]) : [];
  if (t && members.some((m) => m.user_id === user.id)) redirect(`/t/${t.id}`);
  const free = (["OWNER", "TENANT"] as const).find((r) => !members.some((m) => m.role === r));

  return (
    <>
      <AppHeader user={user} />
      {!t ? (
        <p className="text-destructive">This invite link is not valid. Ask for a new link.</p>
      ) : !free ? (
        <p className="text-destructive">Both the owner and the tenant have already joined this tenancy.</p>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">You&apos;re invited</h1>
          <p>Join the condition report for <strong>{t.address}</strong> as the {roleLabel(free).toLowerCase()}.</p>
          <JoinForm code={code} roleLabel={roleLabel(free)} />
        </div>
      )}
    </>
  );
}
