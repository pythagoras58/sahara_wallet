/**
 * Deterministic placeholder pricing -- there is no live market data feed wired up yet
 * (needs a provider decision: CoinGecko/CoinMarketCap for crypto, a separate feed for
 * any traditional-security assets). Seeded purely by symbol so the same asset always
 * shows the same mock price/sparkline -- this is what buy/sell orders settle against
 * too (see TradingService.placeOrder), so display and execution never drift from each
 * other even though neither reflects a real market.
 */

function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/** mulberry32 -- small, fast, deterministic PRNG from a numeric seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockPrice {
  price: number;
  changePercent24h: number;
  sparkline: number[];
}

export function mockPriceFor(symbol: string): MockPrice {
  const rand = mulberry32(seedFromString(symbol));

  const magnitude = Math.floor(rand() * 5); // 0-4 -- how many decimal places of "size"
  const basePrice = Number((rand() * 10 ** magnitude + 0.01).toFixed(6));

  const sparkline: number[] = [];
  let level = basePrice;
  for (let i = 0; i < 24; i++) {
    level = Math.max(level * (1 + (rand() - 0.5) * 0.06), basePrice * 0.5);
    sparkline.push(Number(level.toFixed(6)));
  }

  const changePercent24h = Number((((sparkline[23] - sparkline[0]) / sparkline[0]) * 100).toFixed(2));

  return { price: basePrice, changePercent24h, sparkline };
}
