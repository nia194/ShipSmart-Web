import type { CompareOption, Priority } from "@/components/shipping/compare.types";
import type { ShippingService } from "@/lib/shipping-data";

export type SortMode = "recommended" | "cheapest" | "fastest" | "guaranteed";

export type RankedShippingService = ShippingService & {
  rank: number;
  score: number;
  rankLabel: string;
  bestFor: string;
  isBest: boolean;
  isCheapest: boolean;
  isFastest: boolean;
};

export function formatMoney(value: number | undefined | null): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  if (max <= min) return 0;
  return (value - min) / (max - min);
}

function scoreService(
  service: ShippingService,
  priority: Priority,
  minPrice: number,
  maxPrice: number,
  minDays: number,
  maxDays: number,
): number {
  const priceScore = normalize(service.price, minPrice, maxPrice); // 0 = cheapest
  const speedScore = normalize(service.transitDays, minDays, maxDays); // 0 = fastest
  const notGuaranteedPenalty = service.guaranteed ? 0 : 1;

  switch (priority) {
    case "price":
      return priceScore * 0.7 + speedScore * 0.18 + notGuaranteedPenalty * 0.12;
    case "speed":
      return speedScore * 0.68 + priceScore * 0.14 + notGuaranteedPenalty * 0.18;
    case "damage":
      return notGuaranteedPenalty * 0.45 + priceScore * 0.25 + speedScore * 0.3;
    case "ontime":
    default:
      return notGuaranteedPenalty * 0.4 + speedScore * 0.42 + priceScore * 0.18;
  }
}

function makeRankLabel(
  service: ShippingService,
  rank: number,
  priority: Priority,
  isCheapest: boolean,
  isFastest: boolean,
): string {
  if (rank === 1) {
    if (priority === "price") return "Best price pick";
    if (priority === "speed") return "Fastest smart pick";
    if (priority === "damage") return "Safest pick";
    return "Best overall";
  }

  if (isCheapest) return "Cheapest";
  if (isFastest) return "Fastest";
  if (service.guaranteed) return "Guaranteed";
  if (service.tier?.toLowerCase().includes("express")) return "Express option";
  return "Budget standard";
}

function makeBestForText(
  service: ShippingService,
  rank: number,
  priority: Priority,
  isCheapest: boolean,
  isFastest: boolean,
): string {
  if (rank === 1) {
    if (priority === "price") {
      return "Best if you want the lowest practical cost while still keeping a reasonable delivery window.";
    }
    if (priority === "speed") {
      return "Best if getting there sooner matters more than saving a few dollars.";
    }
    if (priority === "damage") {
      return "Best if predictability and safer handling matter more than the absolute lowest rate.";
    }
    return "Best balance of arrival time, carrier confidence, and price for this shipment.";
  }

  if (isCheapest) {
    return "Choose this when price matters most and your delivery date is flexible.";
  }

  if (isFastest) {
    return "Choose this when the package needs to arrive as early as possible.";
  }

  if (service.guaranteed) {
    return "Choose this when you want a clearer carrier-backed delivery promise.";
  }

  if (!["UPS", "FedEx", "DHL", "USPS"].includes(service.carrier)) {
    return "Choose this for luggage or personal-item shipping when specialist handling is more important.";
  }

  return "Choose this as a backup option when timing is flexible and the price looks acceptable.";
}

export function rankShippingServices(
  services: ShippingService[],
  priority: Priority,
): RankedShippingService[] {
  const safeServices = Array.isArray(services) ? services : [];
  if (safeServices.length === 0) return [];

  const prices = safeServices.map((service) => service.price);
  const days = safeServices.map((service) => service.transitDays);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDays = Math.min(...days);
  const maxDays = Math.max(...days);

  const cheapestPrice = minPrice;
  const fastestDays = minDays;

  return safeServices
    .map((service) => ({
      service,
      score: scoreService(service, priority, minPrice, maxPrice, minDays, maxDays),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.service.transitDays !== b.service.transitDays) {
        return a.service.transitDays - b.service.transitDays;
      }
      return a.service.price - b.service.price;
    })
    .map(({ service, score }, index) => {
      const rank = index + 1;
      const isCheapest = service.price === cheapestPrice;
      const isFastest = service.transitDays === fastestDays;

      return {
        ...service,
        rank,
        score,
        isBest: rank === 1,
        isCheapest,
        isFastest,
        rankLabel: makeRankLabel(service, rank, priority, isCheapest, isFastest),
        bestFor: makeBestForText(service, rank, priority, isCheapest, isFastest),
      };
    });
}

export function sortRankedServices(
  services: RankedShippingService[],
  sortMode: SortMode,
): RankedShippingService[] {
  const copy = [...services];

  switch (sortMode) {
    case "cheapest":
      return copy.sort((a, b) => a.price - b.price || a.transitDays - b.transitDays);
    case "fastest":
      return copy.sort((a, b) => a.transitDays - b.transitDays || a.price - b.price);
    case "guaranteed":
      return copy.sort((a, b) => {
        if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
        return a.rank - b.rank;
      });
    case "recommended":
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}

export function toCompareOption(service: ShippingService): CompareOption {
  const carrierType = ["UPS", "FedEx", "DHL"].includes(service.carrier)
    ? "private"
    : "public";

  const now = new Date();
  const arrivalMs = now.getTime() + service.transitDays * 86400000;
  const arrivalDate = new Date(arrivalMs).toISOString().split("T")[0];

  return {
    id: service.id,
    carrier: service.carrier,
    service_name: service.name,
    carrier_type: carrierType,
    price_usd: service.price,
    arrival_date: arrivalDate,
    arrival_label: service.date,
    transit_days: service.transitDays,
    guaranteed: service.guaranteed,
  };
}

export function isMajorCarrier(service: ShippingService): boolean {
  return ["UPS", "FedEx", "DHL", "USPS"].includes(service.carrier);
}
