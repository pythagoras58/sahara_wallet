"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getToken,
  resolveTicket,
  ticketQueue,
  whoami,
  type SupportTicket,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SupportQueuePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        if (me.kind !== "staff" || (me.role !== "SUPPORT_AGENT" && me.role !== "SUPER_ADMIN")) {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
        setTickets(await ticketQueue(token));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  async function onResolve(ticketId: string) {
    const token = getToken();
    const note = notes[ticketId]?.trim();
    if (!token || !note) {
      setError("Enter a resolution note first.");
      return;
    }
    setError(null);
    setBusyId(ticketId);
    try {
      await resolveTicket(token, ticketId, note);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !allowed) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Support queue</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tickets.length} open ticket(s).</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-4">
        {tickets.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">No open tickets.</Card>
        )}
        {tickets.map((t) => (
          <Card key={t.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t.user?.fullName ?? t.user?.email}</p>
                <p className="text-sm text-muted-foreground">{t.category.replaceAll("_", " ")}</p>
              </div>
              <Badge variant={t.priority === "HIGH" ? "destructive" : "default"}>{t.priority}</Badge>
            </div>
            <p className="mt-3 text-sm">{t.description}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Resolution note"
                value={notes[t.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                className="sm:flex-1"
              />
              <Button size="sm" disabled={busyId === t.id} onClick={() => onResolve(t.id)}>
                Resolve
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
