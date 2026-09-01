import { Injectable, Logger } from '@nestjs/common';
import { ProxyAgent, type Dispatcher } from 'undici';
import { mockPriceFor, type MockPrice } from './mock-price';

// Some environments (this one included) only allow outbound HTTPS through a local proxy --
// Node's fetch doesn't read HTTP(S)_PROXY env vars on its own, unlike curl. If one is set,
// route through it explicitly; otherwise use undici's default dispatcher (direct connection).
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const dispatcher: Dispatcher | undefined = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

export interface AssetPrice extends MockPrice {
  /** True when this came from CoinGecko; false means the deterministic mock fallback. */
  live: boolean;
}

interface CoingeckoMarket {
  id: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
}

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const CACHE_TTL_MS = 30_000;

/**
 * Live crypto pricing via CoinGecko's free public API (no key needed). Only assets with a
 * coingeckoId set get live data -- everything else falls back to the deterministic mock
 * price (mock-price.ts), same as before this existed. A single 30s in-memory cache covers
 * all callers so a busy /markets page doesn't hammer CoinGecko's free-tier rate limit
 * (~10-30 req/min without a key).
 */
@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private cache: { fetchedAt: number; byId: Map<string, CoingeckoMarket> } | null = null;
  private inFlight: Promise<Map<string, CoingeckoMarket>> | null = null;

  async getPrices(assets: { symbol: string; coingeckoId: string | null }[]): Promise<Map<string, AssetPrice>> {
    const liveIds = [...new Set(assets.filter((a) => a.coingeckoId).map((a) => a.coingeckoId as string))];
    const marketsById = liveIds.length > 0 ? await this.fetchMarkets(liveIds) : new Map<string, CoingeckoMarket>();

    const result = new Map<string, AssetPrice>();
    for (const asset of assets) {
      const market = asset.coingeckoId ? marketsById.get(asset.coingeckoId) : undefined;
      if (market && market.current_price != null) {
        const sparkline = market.sparkline_in_7d?.price ?? [];
        result.set(asset.symbol, {
          price: market.current_price,
          changePercent24h: Number((market.price_change_percentage_24h ?? 0).toFixed(2)),
          // sparkline_in_7d is ~168 hourly points over 7 days -- last 24 is a real last-24h shape.
          sparkline: sparkline.length >= 24 ? sparkline.slice(-24) : sparkline,
          live: true,
        });
      } else {
        result.set(asset.symbol, { ...mockPriceFor(asset.symbol), live: false });
      }
    }
    return result;
  }

  async getPrice(asset: { symbol: string; coingeckoId: string | null }): Promise<AssetPrice> {
    const prices = await this.getPrices([asset]);
    return prices.get(asset.symbol) ?? { ...mockPriceFor(asset.symbol), live: false };
  }

  private async fetchMarkets(ids: string[]): Promise<Map<string, CoingeckoMarket>> {
    const now = Date.now();
    const cacheHasAll = this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS && ids.every((id) => this.cache!.byId.has(id));
    if (cacheHasAll) {
      return this.cache!.byId;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.doFetch(ids).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doFetch(ids: string[]): Promise<Map<string, CoingeckoMarket>> {
    try {
      const url = `${COINGECKO_URL}?vs_currency=usd&ids=${ids.join(',')}&sparkline=true&price_change_percentage=24h`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), dispatcher } as RequestInit);
      if (!res.ok) {
        throw new Error(`CoinGecko responded ${res.status}`);
      }
      const markets = (await res.json()) as CoingeckoMarket[];
      const byId = new Map(markets.map((m) => [m.id, m]));
      this.cache = { fetchedAt: Date.now(), byId };
      return byId;
    } catch (err) {
      this.logger.warn(`CoinGecko fetch failed, falling back to mock prices: ${err instanceof Error ? err.message : err}`);
      // Serve stale cache over nothing if we have one, even if it's missing some ids.
      return this.cache?.byId ?? new Map();
    }
  }
}
