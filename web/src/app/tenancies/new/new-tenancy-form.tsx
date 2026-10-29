"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { depositWarning, STATE_LABELS, type StateCode } from "@/lib/india-rules";
import { TEMPLATES } from "@/lib/templates";
import { createTenancy } from "./actions";

const select = "h-12 w-full rounded-lg border bg-background px-3 text-base";

export function NewTenancyForm() {
  const [state, action, pending] = useActionState(createTenancy, {});
  const [code, setCode] = useState<StateCode>("TN");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const warning = depositWarning(code, Number(rent), Number(deposit));

  return (
    <form action={action} className="space-y-5">
      <Field label="Address" id="address">
        <Textarea id="address" name="address" required rows={2} className="text-base" placeholder="Room 4, Sri Sai PG, Velachery, Chennai" />
      </Field>
      <Field label="State" id="state">
        <select id="state" name="state" className={select} value={code} onChange={(e) => setCode(e.target.value as StateCode)}>
          {Object.entries(STATE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly rent (₹)" id="rent">
          <Input id="rent" name="rent" inputMode="numeric" required className="h-12 text-base" value={rent}
            onChange={(e) => setRent(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Deposit (₹)" id="deposit">
          <Input id="deposit" name="deposit" inputMode="numeric" required className="h-12 text-base" value={deposit}
            onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      {warning && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am the</legend>
        <div className="grid grid-cols-2 gap-3">
          {["TENANT", "OWNER"].map((r) => (
            <label key={r} className="flex h-12 items-center gap-2 rounded-lg border px-3 has-checked:border-primary has-checked:bg-muted">
              <input type="radio" name="role" value={r} defaultChecked={r === "TENANT"} />
              {r === "TENANT" ? "Tenant" : "Owner"}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The tenant records the move-in report and the owner records move-out. Each is checked and signed by the other side.</p>
      </fieldset>
      <Field label="My name" id="name">
        <Input id="name" name="name" required autoComplete="name" className="h-12 text-base" />
      </Field>
      <Field label="Checklist template" id="template">
        <select id="template" name="template" className={select} defaultValue="pg-single">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Creating…" : "Create and start move-in report"}
      </Button>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
