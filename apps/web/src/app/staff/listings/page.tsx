"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createAsset,
  getToken,
  listDraftAssets,
  publishAsset,
  submitAssetForApproval,
  whoami,
  type Asset,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyForm = { symbol: "", name: "", issuer: "", chain: "", minOrderUsdc: "10", feeBps: "0", coingeckoId: "" };

export default function ListingsAdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    whoami(token)
      .then(async (me) => {
        if (me.kind !== "staff" || (me.role !== "LISTING_ADMIN" && me.role !== "SUPER_ADMIN")) {
          router.push("/dashboard");
          return;
        }
        setRole(me.role);
        setAssets(await listDraftAssets(token));
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setError(null);
    setCreating(true);
    try {
      await createAsset(token, {
        symbol: form.symbol,
        name: form.name,
        issuer: form.issuer,
        chain: form.chain,
        minOrderUsdc: Number(form.minOrderUsdc),
        feeBps: Number(form.feeBps),
        coingeckoId: form.coingeckoId.trim() || undefined,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function onSubmitForApproval(id: string) {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await submitAssetForApproval(token, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function onPublish(id: string) {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await publishAsset(token, id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !role) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Asset listings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft an asset, submit it for approval, and a super admin publishes it live.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <Card className="mt-6 p-6">
        <p className="text-sm font-medium">New draft listing</p>
        <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-1 flex flex-col gap-1.5">
            <Label htmlFor="symbol">Symbol</Label>
            <Input id="symbol" required value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5">
            <Label htmlFor="chain">Chain</Label>
            <Input id="chain" required value={form.chain} onChange={(e) => setForm({ ...form, chain: e.target.value })} />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="issuer">Issuer</Label>
            <Input id="issuer" required value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5">
            <Label htmlFor="minOrderUsdc">Min order (USDC)</Label>
            <Input
              id="minOrderUsdc"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.minOrderUsdc}
              onChange={(e) => setForm({ ...form, minOrderUsdc: e.target.value })}
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5">
            <Label htmlFor="feeBps">Fee (bps)</Label>
            <Input
              id="feeBps"
              type="number"
              min="0"
              max="1000"
              value={form.feeBps}
              onChange={(e) => setForm({ ...form, feeBps: e.target.value })}
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="coingeckoId">CoinGecko ID (optional)</Label>
            <Input
              id="coingeckoId"
              placeholder="e.g. ethereum, solana, ripple -- leave blank for mock pricing"
              value={form.coingeckoId}
              onChange={(e) => setForm({ ...form, coingeckoId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Set this to pull a real live price from CoinGecko. Leave blank and this asset will show a clearly-labeled
              placeholder price instead.
            </p>
          </div>
          <Button type="submit" disabled={creating} className="col-span-1 mt-2 w-full sm:col-span-2 sm:w-fit">
            {creating ? "Creating..." : "Create draft"}
          </Button>
        </form>
      </Card>

      <div className="mt-8 flex flex-col gap-4">
        {assets.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">No drafts or listings pending approval.</Card>
        )}
        {assets.map((a) => (
          <Card key={a.id} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">
                  {a.symbol} &middot; {a.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.issuer} on {a.chain}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.coingeckoId ? `Live price via CoinGecko (${a.coingeckoId})` : "Mock/placeholder price"}
                </p>
              </div>
              <Badge variant={a.status === "PENDING_APPROVAL" ? "accent" : "default"}>
                {a.status === "PENDING_APPROVAL" ? "Pending approval" : "Draft"}
              </Badge>
            </div>
            <div className="mt-4">
              {a.status === "DRAFT" && (
                <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => onSubmitForApproval(a.id)}>
                  Submit for approval
                </Button>
              )}
              {a.status === "PENDING_APPROVAL" && role === "SUPER_ADMIN" && (
                <Button size="sm" disabled={busyId === a.id} onClick={() => onPublish(a.id)}>
                  Publish
                </Button>
              )}
              {a.status === "PENDING_APPROVAL" && role !== "SUPER_ADMIN" && (
                <p className="text-sm text-muted-foreground">Waiting on a super admin to publish.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
