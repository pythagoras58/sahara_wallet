import { AlertTriangle } from "lucide-react";

export function DraftNotice() {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 shrink-0 text-accent" size={16} aria-hidden="true" />
      <p className="text-foreground">
        Draft for review — this page hasn&apos;t been checked by legal counsel yet. Don&apos;t
        treat it as binding until it has.
      </p>
    </div>
  );
}
