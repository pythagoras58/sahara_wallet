"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createTicket,
  getToken,
  myTickets,
  TICKET_CATEGORIES,
  type SupportTicket,
  type TicketCategory,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  ESCALATED_FINANCE: "Escalated to finance",
  ESCALATED_KYC: "Escalated to KYC",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<TicketCategory>("other");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    myTickets(token)
      .then(setTickets)
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await createTicket(token, category, description);
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">Report an issue and a support agent will get back to you.</p>

      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">What happened?</Label>
            <textarea
              id="description"
              required
              minLength={5}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-2 w-full sm:w-fit">
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Card>

      {tickets.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your tickets</p>
          <div className="mt-2 flex flex-col gap-3">
            {tickets.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">{t.description}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[t.status]}</span>
                </div>
                {t.resolutionNote && (
                  <p className="mt-2 text-sm text-muted-foreground">{t.resolutionNote}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
