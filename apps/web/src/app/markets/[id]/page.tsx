"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  ApiError,
  getToken,
  listLiveAssets,
  myPositions,
  placeOrder,
  type AssetPosition,
  type MarketAsset,
} from "@/lib/api";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatPrice(price: number) {
  return price < 1 ? price.toFixed(6) : price.toFixed(2);
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<MarketAsset | null>(null);
  const [position, setPosition] = useState<AssetPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    Promise.all([listLiveAssets(token), myPositions(token)])
      .then(([assets, positions]) => {
        const found = assets.find((a) => a.id === params.id);
        if (!found) {
          router.push("/markets");
          return;
        }
        setAsset(found);
        setPosition(positions.find((p) => p.asset.id === params.id) ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [router, params.id]);

  async function onBuy(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !asset) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const order = await placeOrder(token, asset.id, "BUY", Number(buyAmount));
      setMessage(`Bought ${Number(order.quantity).toFixed(6)} ${asset.symbol} for $${order.usdcAmount}.`);
      setBuyAmount("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSell(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !asset) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const order = await placeOrder(token, asset.id, "SELL", Number(sellAmount));
      setMessage(`Sold ${sellAmount} ${asset.symbol} for $${order.usdcAmount}.`);
      setSellAmount("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !asset) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  const positive = asset.changePercent24h >= 0;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <Link href="/markets" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> Markets
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {asset.symbol}
            <Badge variant={asset.live ? "primary" : "default"}>{asset.live ? "Live" : "Mock"}</Badge>
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {asset.name} &middot; {asset.chain}
          </p>
        </div>
        <Sparkline data={asset.sparkline} positive={positive} width={96} height={36} />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">${formatPrice(asset.price)}</span>
        <span className={`text-sm font-medium ${positive ? "text-primary" : "text-destructive"}`}>
          {positive ? "+" : ""}
          {asset.changePercent24h}% (24h)
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {asset.live
          ? "Live price from CoinGecko. Orders settle against this same number."
          : "Placeholder price -- no live market feed is connected for this asset yet. Orders settle against this same number."}
      </p>

      {position && (
        <p className="mt-4 text-sm text-muted-foreground">
          You hold <span className="font-medium text-foreground">{Number(position.quantity).toFixed(6)}</span>{" "}
          {asset.symbol}.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}

      <Card className="mt-6 p-6">
        <p className="text-sm font-medium">Buy</p>
        <p className="mt-1 text-xs text-muted-foreground">Minimum order: ${asset.minOrderUsdc} USDC.</p>
        <form onSubmit={onBuy} className="mt-4 flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="USDC amount"
            required
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
          />
          <Button type="submit" disabled={submitting} className="shrink-0">
            Buy
          </Button>
        </form>
      </Card>

      {position && Number(position.quantity) > 0 && (
        <Card className="mt-4 p-6">
          <p className="text-sm font-medium">Sell</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can sell up to {Number(position.quantity).toFixed(6)} {asset.symbol}.
          </p>
          <form onSubmit={onSell} className="mt-4 flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="0.000001"
              max={Number(position.quantity)}
              placeholder={`${asset.symbol} quantity`}
              required
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={submitting} className="shrink-0">
              Sell
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
