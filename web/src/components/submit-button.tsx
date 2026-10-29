"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button for plain server-action forms: disabled and shows "…" while pending. */
export function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? "…" : children}
    </Button>
  );
}
