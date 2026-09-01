"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, listLiveAssets, myPositions, type AssetPosition, type MarketAsset } from "@/lib/api";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function formatPrice(price: number) {
  return price < 1 ? price.toFixed(6) : price.toFixed(2);
}

export default function MarketsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [positions, setPositions] = useState<AssetPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    Promise.all([listLiveAssets(token), myPositions(token)])
      .then(([a, p]) => {
        setAssets(a);
        setPositions(p);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 text-muted-foreground">
        Loading...
      </main>
    );
  }

  const positionByAssetId = new Map(positions.map((p) => [p.asset.id, p]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tokenized assets available to trade. Assets tagged <span className="font-medium">Live</span> show a
        real-time price from CoinGecko; assets tagged <span className="font-medium">Mock</span> have no live
        feed yet and show a placeholder.
      </p>

      <Card className="mt-6 divide-y divide-border p-0">
        {assets.length === 0 && <p className="p-6 text-sm text-muted-foreground">No assets listed yet.</p>}
        {assets.map((a) => {
          const position = positionByAssetId.get(a.id);
          const positive = a.changePercent24h >= 0;
          return (
            <Link
              key={a.id}
              href={`/markets/${a.id}`}
              className="flex items-center gap-3 p-4 hover:bg-muted sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  {a.symbol}
                  <Badge variant={a.live ? "primary" : "default"} className="px-1.5 py-0.5">
                    {a.live ? "Live" : "Mock"}
                  </Badge>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {position ? `${Number(position.quantity).toFixed(4)} held` : a.name}
                </p>
              </div>
              <Sparkline data={a.sparkline} positive={positive} />
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium ${
                  positive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                }`}
              >
                ${formatPrice(a.price)}
              </span>
            </Link>
          );
        })}
      </Card>
    </main>
  );
}
