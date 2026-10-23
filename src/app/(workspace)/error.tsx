"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      aria-labelledby="error-heading"
      className="mx-auto flex min-h-[55vh] max-w-sm flex-col items-center justify-center text-center"
    >
      <h1 className="text-xl font-semibold tracking-tight" id="error-heading">Couldn’t load</h1>
      <Button className="mt-4" onClick={reset} variant="secondary">
        <RotateCcw aria-hidden="true" className="size-4" />
        Try again
      </Button>
    </section>
  );
}
