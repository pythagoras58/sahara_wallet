"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getToken, myKycStatus, submitKyc, ID_TYPES, type IdType, type MyKycStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fileInputClass =
  "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border";

export default function KycPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MyKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [idType, setIdType] = useState<IdType>("passport");
  const [idNumber, setIdNumber] = useState("");
  const [country, setCountry] = useState("");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsBack = idType !== "passport";

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    myKycStatus(token)
      .then(setStatus)
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  function onFileChange(setter: (f: File | null) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => setter(e.target.files?.[0] ?? null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);

    if (!documentFront) {
      setError(idType === "passport" ? "Upload the passport detail page." : "Upload the front of your ID.");
      return;
    }
    if (needsBack && !documentBack) {
      setError("Upload the back of your ID.");
      return;
    }

    setSubmitting(true);
    try {
      await submitKyc(token, idType, idNumber, country, documentFront, needsBack ? (documentBack ?? undefined) : undefined);
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

  const latestCase = status?.latestCase;
  const isPending = latestCase?.status === "PENDING_OFFICER_REVIEW" || latestCase?.status === "PENDING_AUTO_REVIEW";
  const isApproved = latestCase?.status === "APPROVED";
  const canSubmit = !latestCase || latestCase.status === "REJECTED";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Identity verification</h1>

      {isPending && (
        <Card className="mt-6 p-6">
          <p className="text-sm font-medium">Under review</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve got your submission. A wallet will be provisioned automatically once it&apos;s
            approved.
          </p>
        </Card>
      )}

      {isApproved && (
        <Card className="mt-6 p-6">
          <p className="text-sm font-medium text-primary">Verified</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your identity is verified and your wallet is ready.
          </p>
        </Card>
      )}

      {latestCase?.status === "REJECTED" && (
        <Card className="mt-6 border-destructive/40 p-6">
          <p className="text-sm font-medium text-destructive">Not approved</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {latestCase.decisionReason ?? "Your submission wasn't approved."}
          </p>
        </Card>
      )}

      {canSubmit && (
        <Card className="mt-6 p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">
            This is a placeholder submission -- a real integration verifies your document with a KYC
            vendor. For now, this creates a case for a KYC officer to review.
          </p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idType">ID type</Label>
              <select
                id="idType"
                value={idType}
                onChange={(e) => {
                  setIdType(e.target.value as IdType);
                  setDocumentBack(null);
                }}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              >
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idNumber">ID number</Label>
              <Input id="idNumber" required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                required
                placeholder="e.g. GH, NG, KE"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentFront">
                {idType === "passport" ? "Passport detail page" : "Front of ID"}
              </Label>
              <input
                id="documentFront"
                type="file"
                accept="image/*,application/pdf"
                onChange={onFileChange(setDocumentFront)}
                className={fileInputClass}
              />
            </div>

            {needsBack && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="documentBack">Back of ID</Label>
                <input
                  id="documentBack"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onFileChange(setDocumentBack)}
                  className={fileInputClass}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? "Submitting..." : "Submit for review"}
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
