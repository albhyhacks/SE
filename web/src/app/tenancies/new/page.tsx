import { requireUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { NewTenancyForm } from "./new-tenancy-form";

export default async function NewTenancyPage() {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <h1 className="mb-1 text-2xl font-bold">New tenancy</h1>
      <p className="mb-6 text-muted-foreground">You can invite the other side after this.</p>
      <NewTenancyForm />
    </>
  );
}
