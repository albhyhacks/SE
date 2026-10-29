"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HashCheck({ hash }: { hash: string }) {
  const [value, setValue] = useState("");
  const v = value.trim().toLowerCase();
  return (
    <div className="space-y-2">
      <Label htmlFor="paste">Paste the hash printed on your copy</Label>
      <Input id="paste" value={value} onChange={(e) => setValue(e.target.value)} className="h-11 font-mono text-xs" autoComplete="off" spellCheck={false} />
      {v && (
        <p className={v === hash ? "text-emerald-700" : "text-destructive"}>
          {v === hash ? "✓ Matches this report." : "✗ Does not match this report."}
        </p>
      )}
    </div>
  );
}
