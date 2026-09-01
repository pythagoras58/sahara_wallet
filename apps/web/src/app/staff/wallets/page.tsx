"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  freezeWallet,
  getToken,
  listAllWallets,
  unfreezeWallet,
  whoami,
  type AdminWallet,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function WalletsAdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        if (me.kind !== "staff" || (me.role !== "FINANCE_MANAGER" && me.role !== "SUPER_ADMIN")) {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
        setWallets(await listAllWallets(token));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  async function onFreeze(walletId: string) {
    const token = getToken();
    const reason = reasons[walletId]?.trim();
    if (!token || !reason) {
      setError("Enter a reason before freezing a wallet.");
      return;
    }
    setError(null);
    setBusyId(walletId);
    try {
      const updated = await freezeWallet(token, walletId, reason);
      setWallets((prev) => prev.map((w) => (w.id === walletId ? { ...w, ...updated } : w)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function onUnfreeze(walletId: string) {
    const token = getToken();
    if (!token) return;
    setError(null);
    setBusyId(walletId);
    try {
      const updated = await unfreezeWallet(token, walletId);
      setWallets((prev) => prev.map((w) => (w.id === walletId ? { ...w, ...updated } : w)));
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
      <h1 className="text-2xl font-semibold tracking-tight">Wallets</h1>
      <p className="mt-2 text-sm text-muted-foreground">{wallets.length} wallet(s) provisioned.</p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-4">
        {wallets.map((w) => (
          <Card key={w.id} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{w.user.fullName ?? w.user.email}</p>
                <p className="text-sm text-muted-foreground">{w.user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">${w.usdcBalance}</p>
                {w.frozen && <Badge variant="destructive">Frozen</Badge>}
              </div>
            </div>
            {w.frozen && w.frozenReason && (
              <p className="mt-2 text-sm text-muted-foreground">Reason: {w.frozenReason}</p>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              {w.frozen ? (
                <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => onUnfreeze(w.id)}>
                  Unfreeze
                </Button>
              ) : (
                <>
                  <Input
                    placeholder="Reason to freeze"
                    value={reasons[w.id] ?? ""}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    className="sm:flex-1"
                  />
                  <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => onFreeze(w.id)}>
                    Freeze
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
