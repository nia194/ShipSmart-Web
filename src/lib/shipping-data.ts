// Shared data constants for the shipping app

export const CITIES = ["New York, NY","Los Angeles, CA","Chicago, IL","Houston, TX","Phoenix, AZ","Philadelphia, PA","San Antonio, TX","San Diego, CA","Dallas, TX","San Jose, CA","Austin, TX","Jacksonville, FL","Fort Worth, TX","Columbus, OH","Charlotte, NC","San Francisco, CA","Indianapolis, IN","Seattle, WA","Denver, CO","Washington, DC","Nashville, TN","Oklahoma City, OK","El Paso, TX","Boston, MA","Portland, OR","Las Vegas, NV","Memphis, TN","Louisville, KY","Baltimore, MD","Milwaukee, WI","Albuquerque, NM","Tucson, AZ","Fresno, CA","Atlanta, GA","Kansas City, MO","Miami, FL","Cleveland, OH","Tampa, FL","New Orleans, LA","Pittsburgh, PA","Cincinnati, OH","Orlando, FL","Minneapolis, MN","Detroit, MI","Buffalo, NY"];

export const filterCities = (q: string) =>
  q?.length >= 2 ? CITIES.filter(c => c.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

export const PKG_TYPES = [
  { id: "luggage", icon: "\u{1F9F3}", label: "Luggage" },
  { id: "boxes", icon: "\u{1F4E6}", label: "Boxes" },
  { id: "golf", icon: "\u26F3", label: "Golf" },
  { id: "skis", icon: "\u{1F3BF}", label: "Skis" },
  { id: "envelope", icon: "\u2709\uFE0F", label: "Envelope" },
  { id: "other", icon: "\u{1F4CB}", label: "Other" },
];

export const HANDLING = [
  { id: "standard", label: "Standard" },
  { id: "fragile", label: "Fragile" },
  { id: "heavy", label: "Heavy 50+" },
  { id: "oversized", label: "Oversized" },
];

export const LOGOS: Record<string, { bg: string; c: string; t: string }> = {
  UPS: { bg: "#3B1A00", c: "#FFB500", t: "UPS" },
  FedEx: { bg: "#4D148C", c: "#FF6600", t: "FEx" },
  DHL: { bg: "#D40511", c: "#FFCC00", t: "DHL" },
  Lugless: { bg: "#0D9488", c: "#fff", t: "LL" },
  LuggageToShip: { bg: "#1E40AF", c: "#fff", t: "LTS" },
};

export const TIER_BADGES: Record<string, { bg: string; c: string; b: string }> = {
  OVERNIGHT: { bg: "#fff7ed", c: "#c2410c", b: "#fdba74" },
  "NEXT DAY": { bg: "#fff7ed", c: "#c2410c", b: "#fdba74" },
  EXPRESS: { bg: "#eff6ff", c: "#1d4ed8", b: "#93c5fd" },
  "2-DAY": { bg: "#eef2ff", c: "#4338ca", b: "#a5b4fc" },
  STANDARD: { bg: "#f5f5f4", c: "#57534e", b: "#d6d3d1" },
  ECONOMY: { bg: "#f0fdf4", c: "#15803d", b: "#86efac" },
};

export interface PackageItem {
  type: string;
  qty: string;
  weight: string;
  l: string;
  w: string;
  h: string;
  handling: string;
}

export interface ShippingService {
  id: string;
  carrier: string;
  name: string;
  tier: string;
  price: number;
  originalPrice: number | null;
  transitDays: number;
  date: string;
  deliverBy: string | null;
  guaranteed: boolean;
  promo: { code: string; pct: string; save: number; label: string } | null;
  ai: string;
  breakdown: {
    shipping: { label: string; amount: number }[];
    pickup: { label: string; amount: number }[];
  };
  details: Record<string, string>;
  features: string[];
}

export interface QuoteResults {
  prime: { top: ShippingService[]; more: ShippingService[] };
  private: { top: ShippingService[]; more: ShippingService[] };
}

export const buildBookUrl = (
  svc: ShippingService,
  origin: string,
  dest: string,
  dropDate: string,
  delivDate: string,
  pkgs: PackageItem[]
) => {
  const p = new URLSearchParams({
    origin, dest, dropoff: dropDate, delivery: delivDate,
    items: pkgs.length.toString(),
    weight: pkgs.reduce((a, pk) => a + (parseFloat(pk.weight) || 0) * (parseInt(pk.qty) || 1), 0).toString(),
  });
  const bases: Record<string, string> = {
    "ups-ground": "https://www.ups.com/ship/guided/origin?tx=ground",
    "ups-2day": "https://www.ups.com/ship/guided/origin?tx=2da",
    "fedex-express": "https://www.fedex.com/en-us/shipping/services/express-saver.html",
    "fedex-ground": "https://www.fedex.com/en-us/shipping/ground.html",
    "fedex-economy": "https://www.fedex.com/en-us/shipping/ground/economy.html",
    "fedex-overnight": "https://www.fedex.com/en-us/shipping/services/priority-overnight.html",
    "dhl-express": "https://www.dhl.com/en/express/shipping/ship_now.html",
    "ll-std": "https://www.lugless.com/ship",
    "lts-std": "https://www.luggagetoship.com/check_price",
  };
  const base = bases[svc.id] || "#";
  return `${base}${base.includes("?") ? "&" : "?"}${p.toString()}`;
};

export const getItemErrors = (p: PackageItem) => {
  const e: string[] = [];
  if (!p.weight) e.push("Weight required");
  else if (parseFloat(p.weight) <= 0) e.push("Weight > 0");
  if (!p.l || !p.w || !p.h) e.push("All dimensions required");
  if (!p.qty || parseInt(p.qty) < 1) e.push("Qty \u2265 1");
  return e;
};
