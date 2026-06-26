// Shared data constants for the shipping app

export const CITIES = [
  // Top US cities
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
  "Austin, TX",
  "Jacksonville, FL",
  "Fort Worth, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "San Francisco, CA",
  "Indianapolis, IN",
  "Seattle, WA",
  "Denver, CO",
  "Washington, DC",
  "Boston, MA",
  "El Paso, TX",
  "Nashville, TN",
  "Detroit, MI",
  "Oklahoma City, OK",
  "Portland, OR",
  "Las Vegas, NV",
  "Memphis, TN",
  "Louisville, KY",
  "Baltimore, MD",
  "Milwaukee, WI",
  "Albuquerque, NM",
  "Tucson, AZ",
  "Fresno, CA",
  "Sacramento, CA",
  "Mesa, AZ",
  "Kansas City, MO",
  "Atlanta, GA",
  "Omaha, NE",
  "Colorado Springs, CO",
  "Raleigh, NC",
  "Miami, FL",
  "Virginia Beach, VA",
  "Oakland, CA",
  "Minneapolis, MN",
  "Tulsa, OK",
  "Arlington, TX",
  "Tampa, FL",
  "New Orleans, LA",
  "Wichita, KS",
  "Cleveland, OH",
  "Bakersfield, CA",
  "Aurora, CO",
  "Anaheim, CA",
  "Honolulu, HI",
  "Santa Ana, CA",
  "Riverside, CA",
  "Corpus Christi, TX",
  "Lexington, KY",
  "Henderson, NV",
  "Stockton, CA",
  "Saint Paul, MN",
  "Cincinnati, OH",
  "St. Louis, MO",
  "Pittsburgh, PA",
  "Greensboro, NC",
  "Lincoln, NE",
  "Anchorage, AK",
  "Plano, TX",
  "Orlando, FL",
  "Irvine, CA",
  "Newark, NJ",
  "Durham, NC",
  "Chula Vista, CA",
  "Toledo, OH",
  "Fort Wayne, IN",
  "St. Petersburg, FL",
  "Laredo, TX",
  "Jersey City, NJ",
  "Chandler, AZ",
  "Madison, WI",
  "Lubbock, TX",
  "Scottsdale, AZ",
  "Reno, NV",
  "Buffalo, NY",
  "Gilbert, AZ",
  "Glendale, AZ",
  "North Las Vegas, NV",
  "Winston-Salem, NC",
  "Chesapeake, VA",
  "Norfolk, VA",
  "Fremont, CA",
  "Garland, TX",
  "Irving, TX",
  "Hialeah, FL",
  "Richmond, VA",
  "Boise, ID",
  "Spokane, WA",
  "Baton Rouge, LA",
  "Tacoma, WA",
  "San Bernardino, CA",
  "Modesto, CA",
  "Fontana, CA",
  "Des Moines, IA",
  "Moreno Valley, CA",
  "Santa Clarita, CA",
  "Fayetteville, NC",
  "Birmingham, AL",
  "Oxnard, CA",
  "Rochester, NY",
  "Port St. Lucie, FL",
  "Grand Rapids, MI",
  "Salt Lake City, UT",
  "Huntsville, AL",
  "Frisco, TX",
  "Yonkers, NY",
  "Amarillo, TX",
  "Glendale, CA",
  "Huntington Beach, CA",
  "McKinney, TX",
  "Montgomery, AL",
  "Augusta, GA",
  "Aurora, IL",
  "Akron, OH",
  "Little Rock, AR",
  "Tempe, AZ",
  "Columbus, GA",
  "Overland Park, KS",
  "Grand Prairie, TX",
  "Tallahassee, FL",
  "Cape Coral, FL",
  "Mobile, AL",
  "Knoxville, TN",
  "Shreveport, LA",
  "Worcester, MA",
  "Ontario, CA",
  "Vancouver, WA",
  "Sioux Falls, SD",
  "Chattanooga, TN",
  "Brownsville, TX",
  "Fort Lauderdale, FL",
  "Providence, RI",
  "Newport News, VA",
  "Rancho Cucamonga, CA",
  "Santa Rosa, CA",
  "Peoria, AZ",
  "Oceanside, CA",
  "Elk Grove, CA",
  "Salem, OR",
  "Pembroke Pines, FL",
  "Eugene, OR",
  "Garden Grove, CA",
  "Cary, NC",
  "Fort Collins, CO",
  "Corona, CA",
  "Springfield, MO",
  "Jackson, MS",
  "Alexandria, VA",
  "Hayward, CA",
  "Clarksville, TN",
  "Lakewood, CO",
  "Lancaster, CA",
  "Salinas, CA",
  "Palmdale, CA",
  "Hollywood, FL",
  "Springfield, MA",
  "Macon, GA",
  "Kansas City, KS",
  "Sunnyvale, CA",
  "Pomona, CA",
  "Killeen, TX",
  "Escondido, CA",
  "Pasadena, TX",
  "Naperville, IL",
  "Bellevue, WA",
  "Joliet, IL",
  "Murfreesboro, TN",
  "Midland, TX",
  "Rockford, IL",
  "Paterson, NJ",
  "Savannah, GA",
  "Bridgeport, CT",
  "Torrance, CA",
  "McAllen, TX",
  "Syracuse, NY",
  "Surprise, AZ",
  "Denton, TX",
  "Roseville, CA",
  "Thornton, CO",
  "Miramar, FL",
  "Pasadena, CA",
  "Mesquite, TX",
  "Olathe, KS",
  "Dayton, OH",
  "Carrollton, TX",
  "Waco, TX",
  "Orange, CA",
  "Fullerton, CA",
  "Charleston, SC",
  "West Valley City, UT",
  "Visalia, CA",
  "Hampton, VA",
  "Gainesville, FL",
  "Warren, MI",
  "Coral Springs, FL",
  "Cedar Rapids, IA",
  "Round Rock, TX",
  "Sterling Heights, MI",
  "Kent, WA",
  "Columbia, SC",
  "Santa Clara, CA",
  "New Haven, CT",
  "Stamford, CT",
  "Concord, CA",
  "Elizabeth, NJ",
  "Athens, GA",
  "Atlantic City, NJ",

  // Major Canada cities
  "Toronto, ON",
  "Vancouver, BC",
  "Montreal, QC",
  "Calgary, AB",
  "Ottawa, ON",
  "Edmonton, AB",
  "Winnipeg, MB",
  "Quebec City, QC",
  "Hamilton, ON",
  "Mississauga, ON",
  "Brampton, ON",
  "Surrey, BC",
];

export const filterCities = (q: string) => {
  const query = q.trim().toLowerCase();

  if (query.length < 2) {
    return [];
  }

  const startsWithMatches = CITIES.filter((city) =>
    city.toLowerCase().startsWith(query),
  );

  const includesMatches = CITIES.filter(
    (city) =>
      city.toLowerCase().includes(query) &&
      !city.toLowerCase().startsWith(query),
  );

  return [...startsWithMatches, ...includesMatches].slice(0, 8);
};
export const PKG_TYPES = [
  {
    id: "luggage",
    icon: "🧳",
    label: "Luggage",
    title: "Luggage",
    subtitle: "Suitcases, duffel bags, and travel luggage",
    image: "/package-types/luggage.png",
  },
  {
    id: "boxes",
    icon: "📦",
    label: "Boxes",
    title: "Box or Rigid Packaging",
    subtitle: "Any custom box or thick parcel",
    image: "/package-types/box.png",
  },
  {
    id: "golf",
    icon: "⛳",
    label: "Golf",
    title: "Golf Bag or Golf Clubs",
    subtitle: "Golf bags, club cases, or golf equipment",
    image: "/package-types/golf.png",
  },
  {
    id: "skis",
    icon: "🎿",
    label: "Skis",
    title: "Skis or Snowboard",
    subtitle: "Ski bags, snowboards, and winter sports equipment",
    image: "/package-types/skis.png",
  },
  {
    id: "envelope",
    icon: "✉️",
    label: "Envelope",
    title: "Envelope or Flat Mailer",
    subtitle: "Flat documents, padded mailers, or lightweight envelopes",
    image: "/package-types/envelope.png",
  },
  {
    id: "other",
    icon: "📋",
    label: "Other",
    title: "Tube or Irregular Packaging",
    subtitle: "Tubes, crates, tires, or unusual package shapes",
    image: "/package-types/other.png",
  },
];

export const HANDLING = [
  { id: "standard", label: "Standard" },
  { id: "fragile", label: "Fragile" },
  { id: "heavy", label: "Heavy 50+" },
  { id: "oversized", label: "Oversized" },
];

export const LOGOS: Record<
  string,
  {
    bg: string;
    c: string;
    t: string;
  }
> = {
  UPS: { bg: "#3B1A00", c: "#FFB500", t: "UPS" },
  FedEx: { bg: "#4D148C", c: "#FF6600", t: "FEx" },
  DHL: { bg: "#D40511", c: "#FFCC00", t: "DHL" },
  Lugless: { bg: "#0D9488", c: "#fff", t: "LL" },
  LuggageToShip: { bg: "#1E40AF", c: "#fff", t: "LTS" },
};

export const TIER_BADGES: Record<
  string,
  {
    bg: string;
    c: string;
    b: string;
  }
> = {
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
  promo: {
    code: string;
    pct: string;
    save: number;
    label: string;
  } | null;
  ai: string;
  breakdown: {
    shipping: { label: string; amount: number }[];
    pickup: { label: string; amount: number }[];
  };
  details: Record<string, string>;
  features: string[];
}

export interface QuoteResults {
  prime: {
    top: ShippingService[];
    more: ShippingService[];
  };
  private: {
    top: ShippingService[];
    more: ShippingService[];
  };
}

export const buildBookUrl = (
  svc: ShippingService,
  origin: string,
  dest: string,
  dropDate: string,
  delivDate: string,
  pkgs: PackageItem[],
) => {
  const p = new URLSearchParams({
    origin,
    dest,
    dropoff: dropDate,
    delivery: delivDate,
    items: pkgs.length.toString(),
    weight: pkgs
      .reduce(
        (a, pk) =>
          a + (parseFloat(pk.weight) || 0) * (parseInt(pk.qty) || 1),
        0,
      )
      .toString(),
  });

  const bases: Record<string, string> = {
    "ups-ground": "https://www.ups.com/ship/guided/origin?tx=ground",
    "ups-2day": "https://www.ups.com/ship/guided/origin?tx=2da",
    "fedex-express":
      "https://www.fedex.com/en-us/shipping/services/express-saver.html",
    "fedex-ground": "https://www.fedex.com/en-us/shipping/ground.html",
    "fedex-economy":
      "https://www.fedex.com/en-us/shipping/ground/economy.html",
    "fedex-overnight":
      "https://www.fedex.com/en-us/shipping/services/priority-overnight.html",
    "dhl-express": "https://www.dhl.com/en/express/shipping/ship_now.html",
    "ll-std": "https://www.lugless.com/ship",
    "lts-std": "https://www.luggagetoship.com/check_price",
  };

  const base = bases[svc.id] || "#";
  return `${base}${base.includes("?") ? "&" : "?"}${p.toString()}`;
};

export const getItemErrors = (p: PackageItem) => {
  const e: string[] = [];

  const qty = parseInt(p.qty, 10);
  const weight = parseFloat(p.weight);
  const length = parseFloat(p.l);
  const width = parseFloat(p.w);
  const height = parseFloat(p.h);

  if (!p.qty) e.push("Quantity is required");
  else if (!Number.isFinite(qty) || qty < 1) e.push("Quantity must be at least 1");

  if (!p.weight) e.push("Weight is required");
  else if (!Number.isFinite(weight) || weight <= 0) e.push("Weight must be greater than 0");

  if (!p.l || !p.w || !p.h) {
    e.push("Length, width, and height are required");
  } else if (
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    e.push("Dimensions must be greater than 0");
  }

  return e;
};