"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  approveKyc,
  fetchKycDocumentUrl,
  getToken,
  kycQueue,
  rejectKyc,
  whoami,
  type KycCase,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function KycQueuePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [cases, setCases] = useState<KycCase[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        if (me.kind !== "staff" || (me.role !== "KYC_OFFICER" && me.role !== "SUPER_ADMIN")) {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
        const queue = await kycQueue(token);
        setCases(queue);

        const urlEntries = await Promise.all(
          queue.map(async (c) => {
            const urls = await Promise.all(
              c.documentPaths.map((_, i) =>
                fetchKycDocumentUrl(token, c.id, i).catch(() => null),
              ),
            );
            return [c.id, urls.filter((u): u is string => !!u)] as const;
          }),
        );
        objectUrls.current = urlEntries.flatMap(([, urls]) => urls);
        setDocumentUrls(Object.fromEntries(urlEntries));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function onApprove(caseId: string) {
    const token = getToken();
    if (!token) return;
    setError(null);
    setBusyCaseId(caseId);
    try {
      await approveKyc(token, caseId);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyCaseId(null);
    }
  }

  async function onReject(caseId: string) {
    const token = getToken();
    const reason = rejectReasons[caseId]?.trim();
    if (!token || !reason) {
      setError("Enter a rejection reason first.");
      return;
    }
    setError(null);
    setBusyCaseId(caseId);
    try {
      await rejectKyc(token, caseId, reason);
      setCases((prev) => prev.filter((c) => c.id !== caseId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyCaseId(null);
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
      <h1 className="text-2xl font-semibold tracking-tight">KYC review queue</h1>
      <p className="mt-2 text-sm text-muted-foreground">{cases.length} case(s) awaiting review.</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-4">
        {cases.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">Nothing pending. Nice and clear.</Card>
        )}
        {cases.map((c) => {
          const evidence = safeParseEvidence(c.evidenceRef);
          const busy = busyCaseId === c.id;
          const docs = documentUrls[c.id] ?? [];
          const docLabels = evidence?.idType === "passport" ? ["Detail page"] : ["Front", "Back"];
          return (
            <Card key={c.id} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{c.user?.fullName ?? c.user?.email ?? "Applicant"}</p>
                  <p className="text-sm text-muted-foreground">{c.user?.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <Field label="ID type" value={evidence?.idType} />
                <Field label="ID number" value={evidence?.idNumber} />
                <Field label="Country" value={evidence?.country} />
              </dl>

              {docs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {docs.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={url}
                        alt={docLabels[i] ?? `Document ${i + 1}`}
                        className="h-24 w-36 rounded-md border border-border object-cover"
                      />
                      <p className="mt-1 text-center text-xs text-muted-foreground">{docLabels[i] ?? `Document ${i + 1}`}</p>
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button size="sm" disabled={busy} onClick={() => onApprove(c.id)}>
                  Approve
                </Button>
                <Input
                  placeholder="Rejection reason"
                  value={rejectReasons[c.id] ?? ""}
                  onChange={(e) => setRejectReasons((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="sm:flex-1"
                />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject(c.id)}>
                  Reject
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value ?? "-"}</dd>
    </div>
  );
}

function safeParseEvidence(raw: string): { idType?: string; idNumber?: string; country?: string } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
