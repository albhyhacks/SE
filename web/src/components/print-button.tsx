"use client";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button type="button" size="lg" className="no-print h-12 w-full text-base" onClick={() => window.print()}>Print / Save as PDF</Button>;
}
