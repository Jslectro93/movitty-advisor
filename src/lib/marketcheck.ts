// Movitty — Shared Marketcheck API client + business logic types

export const API_KEY = process.env.MARKETCHECK_API_KEY ?? 'DmCy2HntmaaWGWWgApjMB0SlgSYP9Kd4';
export const BASE_URL = 'https://api.marketcheck.com/v2';

export const DOM_WARN = 30;
export const DOM_PRESSURE = 45;
export const PRICE_DROP_ALERT = 1000;

// ── Types ──────────────────────────────────────────────────────

export interface Build {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  body_type?: string;
  transmission?: string;
  drivetrain?: string;
  fuel_type?: string;
  engine?: string;
  engine_size?: number;
  cylinders?: number;
  made_in?: string;
  overall_height?: string;
  overall_length?: string;
  overall_width?: string;
  std_seating?: string;
  highway_mpg?: number;
  city_mpg?: number;
  doors?: number;
}

export interface Dealer {
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

export interface Listing {
  id?: string;
  vin?: string;
  price?: number;
  heading?: string;
  media?: { photo_links?: string[] };
  msrp?: number;
  miles?: number;
  dom?: number;
  exterior_color?: string;
  vdp_url?: string;
  first_seen_at?: number;
  last_seen_at?: number;
  first_seen_at_date?: string;
  last_seen_at_date?: string;
  build?: Build;
  dealer?: Dealer;
  mc_dealership?: Dealer;
}

export interface SearchResult {
  listings: Listing[];
  num_found: number;
}

export interface PricePoint {
  date: string;
  price: number;
  delta: number;
}

export interface FMV {
  avg: number;
  low: number;
  high: number;
  median: number;
  sample: number;
  total: number;
}

export interface ParsedQuery {
  year?: string;
  make?: string;
  model?: string;
  color?: string;
  location_raw?: string;
}

export interface ResolvedLocation {
  zip: string;
  city: string;
  state: string;
}

// ── Helpers ────────────────────────────────────────────────────

export function safeInt(v: unknown, d = 0): number {
  const n = Number(v);
  return isNaN(n) ? d : Math.round(n);
}

export function formatPrice(v: unknown): string {
  const n = safeInt(v);
  return n > 0 ? `$${n.toLocaleString()}` : 'N/D';
}

export function isoToDate(s?: string): string {
  return s ? s.slice(0, 10) : 'N/D';
}

export function daysSinceUnix(ts?: number): number {
  if (!ts) return 0;
  const now = Date.now() / 1000;
  return Math.max(0, Math.floor((now - ts) / 86400));
}

export function getDealerInfo(listing: Listing): Dealer {
  return listing.dealer ?? listing.mc_dealership ?? {};
}

// ── Price timeline ─────────────────────────────────────────────

export function buildPriceTimeline(history: Listing[]): PricePoint[] {
  const sorted = [...history].sort((a, b) => (a.first_seen_at ?? 0) - (b.first_seen_at ?? 0));
  const timeline: PricePoint[] = [];
  let lastPrice: number | null = null;

  for (const listing of sorted) {
    const price = safeInt(listing.price);
    const date = isoToDate(listing.first_seen_at_date);
    if (price > 0 && price !== lastPrice) {
      timeline.push({ date, price, delta: lastPrice !== null ? price - lastPrice : 0 });
      lastPrice = price;
    }
  }
  return timeline;
}

// ── Fair Market Value ──────────────────────────────────────────

export function calcFMV(listings: Listing[], totalFound: number): FMV | null {
  const prices = listings.map(l => safeInt(l.price)).filter(p => p > 0).sort((a, b) => a - b);
  if (!prices.length) return null;
  return {
    avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
    low: prices[0],
    high: prices[prices.length - 1],
    median: prices[Math.floor(prices.length / 2)],
    sample: prices.length,
    total: totalFound,
  };
}

// ── Opportunity flags ──────────────────────────────────────────

export type FlagType = 'negotiation' | 'competitive' | 'overpriced';

export interface OpportunityFlag {
  type: FlagType;
  label: string;
}

export function getOpportunityFlags(listing: Listing, fmv: FMV | null): OpportunityFlag[] {
  const flags: OpportunityFlag[] = [];
  const dom = safeInt(listing.dom);
  const price = safeInt(listing.price);

  if (dom > DOM_PRESSURE) {
    flags.push({ type: 'negotiation', label: `${dom} días en mercado` });
  }
  if (fmv && price > 0 && price < fmv.avg * 0.97) {
    flags.push({ type: 'competitive', label: `$${(fmv.avg - price).toLocaleString()} bajo el promedio` });
  }
  if (fmv && price > 0 && price > fmv.avg * 1.03) {
    flags.push({ type: 'overpriced', label: `$${(price - fmv.avg).toLocaleString()} sobre el promedio` });
  }
  return flags;
}
