"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auditLog, getToken, whoami, type AuditLogEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function AuditLogPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        if (me.kind !== "staff" || (me.role !== "AUDITOR" && me.role !== "SUPER_ADMIN")) {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
        setEntries(await auditLog(token, 200));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !allowed) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-2 text-sm text-muted-foreground">{entries.length} most recent entries.</p>

      <Card className="mt-6 divide-y divide-border p-0">
        {entries.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing logged yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div>
              <p className="font-medium">{e.action}</p>
              <p className="text-muted-foreground">
                {e.targetType} &middot; {e.targetId.slice(0, 8)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{e.actorType}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </Card>
    </main>
  );
}
