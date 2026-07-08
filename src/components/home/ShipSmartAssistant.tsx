// src/components/home/ShipSmartAssistant.tsx

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import assistantLogo from "@/logos/assistant-logo.png";

import type { CompareOption, Priority } from "@/components/shipping/compare.types";
import type {
  ShipmentDraftSnapshot,
} from "@/components/shipment-form/ShipmentProgressForm";
import type { PackageItem } from "@/lib/shipping-data";

import {
  CONCIERGE_MAX_MESSAGE_LENGTH,
  getConciergeHistory,
  postConciergeChat,
  type ConciergeState,
} from "@/lib/concierge-api";

import { friendlyAdvisorError } from "@/lib/advisor-api";

import { useShipmentDraft } from "@/state/ShipmentDraftContext";
import {
  conciergeStateToPatch,
  draftToConciergeState,
  emptyDraft,
  type ScalarField,
  type ShipmentDraft,
} from "@/state/shipmentDraft";

type AssistantTurn = {
  id: number;
  question: string;
  reply?: string;
  patchedFields?: ScalarField[];
  replyTo?: string;
  filledSummary?: string;
  quickReplies?: QuickReply[];
};

type ReplyTarget = {
  turnId: number;
  text: string;
};

type PillTextMode = "typing" | "holding" | "deleting";
type PendingStage = "analyzing" | "summarizing";

type FormFillField =
  | "origin"
  | "destination"
  | "dropOffDate"
  | "deliveryDate"
  | "packageDetails"
  | null;

type QuickReply = {
  label: string;
  prompt: string;
};


type AssistantSuggestion = {
  icon: string;
  label: string;
  prompt: string;
};

interface ShipSmartAssistantProps {
  quoteOptions?: CompareOption[];
  selectedPriority?: Priority;
  formSnapshot?: ShipmentDraftSnapshot | null;
}

const SESSION_KEY = "ss_concierge_session";
const ASSISTANT_INPUT_MAX_LENGTH = Math.min(CONCIERGE_MAX_MESSAGE_LENGTH, 300);

const ROTATING_PILL_TEXT = [
  "Help me fill out the shipping form",
  "Find the cheapest way to ship",
  "Compare speed vs price",
  "Help me choose package details",
];

const PILL_TYPE_SPEED_MS = 34;
const PILL_DELETE_SPEED_MS = 18;
const PILL_HOLD_MS = 1500;
const PILL_GAP_MS = 180;

const INITIAL_SUGGESTIONS: AssistantSuggestion[] = [
  {
    icon: "📝",
    label: "Help me fill out the shipping form",
    prompt:
      "Help me fill out the shipping form step by step. Ask me one question at a time.",
  },
  {
    icon: "💸",
    label: "Find the cheapest way to ship",
    prompt: "Help me find the cheapest way to ship my current package.",
  },
  {
    icon: "⚡",
    label: "Compare speed vs price",
    prompt: "Compare speed versus price for my shipment.",
  },
  {
    icon: "📦",
    label: "Help me choose package details",
    prompt: "Help me choose the right package type, dimensions, and weight.",
  },
];

const MORE_SUGGESTIONS: AssistantSuggestion[] = [
  {
    icon: "🛡️",
    label: "Find the safest option",
    prompt: "Help me choose the safest shipping option.",
  },
  {
    icon: "📏",
    label: "Explain dimensional weight",
    prompt: "Explain how package dimensions affect the shipping price.",
  },
  {
    icon: "🚫",
    label: "Check restricted items",
    prompt: "Check if my item has shipping restrictions.",
  },
  {
    icon: "💬",
    label: "What can ShipSmart AI do?",
    prompt: "What can ShipSmart AI help me with?",
  },
];

function AssistantThinkingLoader({ stage }: { stage: PendingStage }) {
  const statusText =
    stage === "summarizing" ? "Summarizing result..." : "Analyzing your request...";

  return (
    <div className="ss-assistant-thinking" role="status" aria-live="polite">
      <div className="ss-assistant-thinking-title">Thinking ..</div>
      <div className="ss-assistant-thinking-row">
        <span className="ss-assistant-thinking-spinner" aria-hidden="true" />
        <span>{statusText}</span>
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<ScalarField, string> = {
  origin: "pickup",
  destination: "delivery",
  originCountry: "origin country",
  destinationCountry: "destination country",
  dropOffDate: "drop-off date",
  deliveryDate: "delivery date",
  weightLbs: "weight",
  priority: "priority",
  description: "package details",
  declaredValueUsd: "declared value",
};


const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toIsoDate(date);
}

function nextWeekdayIso(dayName: string) {
  const target = WEEKDAY_INDEX[dayName.toLowerCase()];
  if (target === undefined) return null;

  const today = new Date();
  const date = new Date(today);

  let diff = target - today.getDay();
  if (diff <= 0) diff += 7;

  date.setDate(today.getDate() + diff);
  return toIsoDate(date);
}

function parseDateFromText(text: string) {
  const lower = text.toLowerCase();

  const isoMatch = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) return isoMatch[1];

  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3]
      ? Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : new Date().getFullYear();

    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return toIsoDate(date);
  }

  if (/\btomorrow\b/.test(lower)) {
    return tomorrowIso();
  }

  const weekdayMatch = lower.match(
    /\b(?:by|before|on|arrive by|deliver by|delivery by|need by)\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );

  if (weekdayMatch?.[1]) {
    return nextWeekdayIso(weekdayMatch[1]);
  }

  return null;
}

function cleanupLocation(value: string) {
  return value
    .replace(/\b(package|box|boxes|shipment|parcel|luggage|suitcase)\b/gi, "")
    .replace(/\bby\s+(today|tomorrow|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b\d+(\.\d+)?\s*(lb|lbs|pounds?)\b/gi, "")
    .replace(/\b\d+\s*[x×]\s*\d+\s*[x×]\s*\d+\b/gi, "")
    .replace(/[.;]+$/g, "")
    .trim();
}

function normalizePackageType(value: unknown): PackageItem["type"] {
  const lower = String(value ?? "").toLowerCase();

  if (lower.includes("luggage") || lower.includes("suitcase")) return "luggage";
  if (lower.includes("document") || lower.includes("envelope")) return "envelope";
  if (lower.includes("golf")) return "golf";
  if (lower.includes("ski") || lower.includes("snowboard")) return "skis";
  if (lower.includes("other") || lower.includes("tube") || lower.includes("crate")) return "other";

  return "boxes";
}

function getNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}

function inferPackageFromMessage(message: string): PackageItem | null {
  const lower = message.toLowerCase();

  const weightMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/);
  const dimensionMatch = lower.match(
    /\b(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\b/,
  );
  const qtyMatch = lower.match(/\b(?:qty|quantity)\s*(?:is|:)?\s*(\d+)\b/);

  if (!weightMatch && !dimensionMatch && !qtyMatch) {
    return null;
  }

  return {
    type: normalizePackageType(lower),
    qty: qtyMatch?.[1] ?? "1",
    weight: weightMatch?.[1] ?? "",
    l: dimensionMatch?.[1] ?? "",
    w: dimensionMatch?.[2] ?? "",
    h: dimensionMatch?.[3] ?? "",
    handling: lower.includes("fragile") ? "fragile" : "standard",
  };
}

function packageFromConciergeState(state: ConciergeState): PackageItem | null {
  const slots = state.slots ?? {};

  const weight = getNumber(slots.weight_lbs);
  const l = getNumber(slots.length_in);
  const w = getNumber(slots.width_in);
  const h = getNumber(slots.height_in);
  const category = slots.category;

  if (!weight && !l && !w && !h && !category) return null;

  return {
    type: normalizePackageType(category),
    qty: getNumber(slots.quantity) || "1",
    weight,
    l,
    w,
    h,
    handling: String(slots.handling ?? "").toLowerCase().includes("fragile")
      ? "fragile"
      : "standard",
  };
}

function applyFormSnapshotToState(
  state: ConciergeState,
  snapshot?: ShipmentDraftSnapshot | null,
): ConciergeState {
  if (!snapshot) return state;

  const slots = { ...(state.slots ?? {}) };
  const firstPackage = snapshot.packages[0];

  if (snapshot.origin) slots.origin = snapshot.origin;
  if (snapshot.dest) slots.destination = snapshot.dest;
  if (snapshot.dropDateStr) slots.drop_off_date = snapshot.dropDateStr;
  if (snapshot.delivDateStr) slots.expected_delivery_date = snapshot.delivDateStr;
  if (firstPackage?.weight) slots.weight_lbs = Number(firstPackage.weight);
  if (firstPackage?.l) slots.length_in = Number(firstPackage.l);
  if (firstPackage?.w) slots.width_in = Number(firstPackage.w);
  if (firstPackage?.h) slots.height_in = Number(firstPackage.h);
  if (firstPackage?.type) slots.category = firstPackage.type;
  if (firstPackage?.qty) slots.quantity = Number(firstPackage.qty);
  if (firstPackage?.handling) slots.handling = firstPackage.handling;

  return {
    ...state,
    slots,
  };
}

function quoteIntent(message: string) {
  return /\b(cheapest|lowest|fastest|earliest|best|which one|option|carrier|rate|price|cost|arrival|transit|ups|fedex|dhl|usps)\b/i.test(
    message,
  );
}

function formatQuoteOption(option: CompareOption, index: number) {
  const price =
    typeof option.price_usd === "number"
      ? `$${option.price_usd.toFixed(2)}`
      : "price unavailable";

  const transit =
    option.transit_days !== undefined && option.transit_days !== null
      ? `${option.transit_days} day${option.transit_days === 1 ? "" : "s"}`
      : option.arrival_label || option.arrival_date || "transit unavailable";

  const guarantee = option.guaranteed ? "guaranteed" : "not guaranteed";

  return `${index + 1}. ${option.carrier} ${option.service_name}: ${price}, ${transit}, ${guarantee}`;
}

function buildQuoteContext(
  message: string,
  quoteOptions?: CompareOption[],
  selectedPriority?: Priority,
) {
  if (!quoteOptions?.length || !quoteIntent(message)) return message;

  const optionsBlock = quoteOptions
    .slice(0, 10)
    .map((option, index) => formatQuoteOption(option, index))
    .join("\n");

  return `
${message}

Current quote options visible in the ShipSmart UI:
User priority: ${selectedPriority ?? "unknown"}

${optionsBlock}

Use the visible quote options above when answering. If the user asks for cheapest, fastest, earliest, safest, or best, compare these options directly.
`.trim();
}

function fieldList(fields?: ScalarField[]) {
  if (!fields?.length) return "";
  return fields.map((field) => FIELD_LABEL[field] ?? field).join(", ");
}

function compactReplyText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}

function buildDraftSummary(
  draft: ShipmentDraft,
  snapshot?: ShipmentDraftSnapshot | null,
) {
  const origin = draft.origin?.value ?? snapshot?.origin;
  const destination = draft.destination?.value ?? snapshot?.dest;
  const weight = draft.weightLbs?.value ?? snapshot?.packages[0]?.weight;
  const deliveryDate = draft.deliveryDate?.value ?? snapshot?.delivDateStr;

  const parts = [
    origin && destination ? `${origin} → ${destination}` : null,
    weight ? `${weight} lbs` : null,
    deliveryDate ? `Need by ${deliveryDate}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}


type LocalFormFillResult = {
  patch: Partial<Record<ScalarField, unknown>>;
  item: PackageItem | null;
  patchedFields: ScalarField[];
  filledSummary?: string;
  reply: string;
  nextField: FormFillField;
  quickReplies?: QuickReply[];
};

type DraftView = {
  origin?: string;
  destination?: string;
  dropOffDate?: string;
  deliveryDate?: string;
  priority?: Priority;
  description?: string;
  weightLbs?: string;
  item?: PackageItem;
};

const LOCATION_ALIASES: Record<string, string> = {
  la: "Los Angeles, CA",
  lax: "Los Angeles, CA",
  "los angeles": "Los Angeles, CA",
  ny: "New York, NY",
  nyc: "New York, NY",
  "new york": "New York, NY",
  atl: "Atlanta, GA",
  atlanta: "Atlanta, GA",
  chicago: "Chicago, IL",
  boston: "Boston, MA",
  seattle: "Seattle, WA",
  miami: "Miami, FL",
  dallas: "Dallas, TX",
  houston: "Houston, TX",
  denver: "Denver, CO",
  phoenix: "Phoenix, AZ",
  "san francisco": "San Francisco, CA",
  sf: "San Francisco, CA",
};

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLocation(value: string) {
  const cleaned = cleanupLocation(value)
    .replace(/^(?:a|an|the|my|this)\s+/i, "")
    .replace(/\b(current|package|box|shipment|parcel)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const aliasKey = cleaned.toLowerCase().replace(/[.]/g, "").trim();
  return LOCATION_ALIASES[aliasKey] ?? titleCase(cleaned);
}

function parseFlexibleDateFromText(text: string) {
  const lower = text.toLowerCase().trim();

  const existing = parseDateFromText(lower);
  if (existing) return existing;

  const weekdayOnly = lower.match(
    /\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );

  if (weekdayOnly?.[1]) {
    return nextWeekdayIso(weekdayOnly[1]);
  }

  const monthMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(20\d{2}))?\b/,
  );

  if (monthMatch?.[1] && monthMatch?.[2]) {
    const month = MONTH_INDEX[monthMatch[1]];
    const day = Number(monthMatch[2]);
    const year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
    const date = new Date(year, month, day);

    if (!Number.isNaN(date.getTime())) {
      return toIsoDate(date);
    }
  }

  return null;
}

function hasShipmentPlanningIntent(message: string) {
  return /\b(ship|shipping|send|mail|deliver|delivery|quote|rate|label)\b/i.test(
    message,
  );
}

function isPureRecommendationQuestion(message: string) {
  const lower = message.toLowerCase();
  const asksForRecommendation =
    /\b(cheapest|lowest|best|fastest|compare|option|recommend|current package|current shipment)\b/.test(
      lower,
    );
  const hasRouteFacts = /\bfrom\s+.+?\s+(?:to|→)\s+.+/i.test(message);
  const hasPackageFacts =
    /\b(box|boxes|luggage|suitcase|envelope|documents|golf|skis|snowboard)\b/i.test(
      message,
    ) || /\b\d+(?:\.\d+)?\s*(lb|lbs|pounds?)\b/i.test(message);

  return asksForRecommendation && !hasRouteFacts && !hasPackageFacts;
}

function extractRoutePatch(message: string) {
  const patch: Partial<Record<ScalarField, unknown>> = {};

  if (!hasShipmentPlanningIntent(message)) return patch;

  const routeWithFrom = message.match(
    /\bfrom\s+(.+?)\s+(?:to|→)\s+(.+?)(?=\s+(?:by|before|on|for|with|weighing|weight|need|arrive|deliver|delivery|and|please)\b|[,.;!?]|$)/i,
  );

  if (routeWithFrom?.[1] && routeWithFrom?.[2]) {
    const origin = normalizeLocation(routeWithFrom[1]);
    const destination = normalizeLocation(routeWithFrom[2]);

    if (origin) patch.origin = origin;
    if (destination) patch.destination = destination;
  }

  return patch;
}

function extractExplicitEditPatch(message: string) {
  const patch: Partial<Record<ScalarField, unknown>> = {};

  const destination = message.match(
    /\b(?:set|change|update|use|make)\s+(?:the\s+)?(?:destination|delivery|deliver to|to)\s+(?:to|as)?\s*(.+?)(?=[,.;!?]|$)/i,
  );

  if (destination?.[1]) {
    const value = normalizeLocation(destination[1]);
    if (value) patch.destination = value;
  }

  const origin = message.match(
    /\b(?:set|change|update|use|make)\s+(?:the\s+)?(?:origin|pickup|pick up|from)\s+(?:to|as)?\s*(.+?)(?=[,.;!?]|$)/i,
  );

  if (origin?.[1]) {
    const value = normalizeLocation(origin[1]);
    if (value) patch.origin = value;
  }

  const weight = message.match(
    /\b(?:set|change|update|use|make)?\s*(?:weight)\s*(?:to|as|is|:)?\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)?\b/i,
  );

  if (weight?.[1]) {
    const value = Number(weight[1]);
    if (Number.isFinite(value) && value > 0) patch.weightLbs = value;
  }

  return patch;
}

function extractPackageType(message: string): PackageItem["type"] | null {
  const lower = message.toLowerCase();

  if (/\b(luggage|suitcase|duffel)\b/.test(lower)) return "luggage";
  if (/\b(box|boxes|package|parcel)\b/.test(lower)) return "boxes";
  if (/\b(envelope|document|documents|mailer)\b/.test(lower)) return "envelope";
  if (/\b(golf|clubs?)\b/.test(lower)) return "golf";
  if (/\b(skis?|snowboard)\b/.test(lower)) return "skis";
  if (/\b(tube|crate|tire|irregular)\b/.test(lower)) return "other";

  return null;
}

function estimatePackageFromMessage(message: string): PackageItem | null {
  const lower = message.toLowerCase();
  const type = extractPackageType(lower) ?? "boxes";

  if (/\bsmall\b/.test(lower)) {
    return {
      type,
      qty: "1",
      weight: "3",
      l: "12",
      w: "9",
      h: "4",
      handling: "standard",
    };
  }

  if (/\bmedium\b/.test(lower)) {
    return {
      type,
      qty: "1",
      weight: "10",
      l: "16",
      w: "12",
      h: "12",
      handling: "standard",
    };
  }

  if (/\blarge\b/.test(lower)) {
    return {
      type,
      qty: "1",
      weight: "25",
      l: "20",
      w: "20",
      h: "20",
      handling: "standard",
    };
  }

  return null;
}

function packageWithType(type: PackageItem["type"]): PackageItem {
  return {
    type,
    qty: "1",
    weight: "",
    l: "",
    w: "",
    h: "",
    handling: "standard",
  };
}

function mergePackage(base: PackageItem | undefined, incoming: PackageItem) {
  return {
    type: incoming.type || base?.type || "boxes",
    qty: incoming.qty || base?.qty || "1",
    weight: incoming.weight || base?.weight || "",
    l: incoming.l || base?.l || "",
    w: incoming.w || base?.w || "",
    h: incoming.h || base?.h || "",
    handling: incoming.handling || base?.handling || "standard",
  } satisfies PackageItem;
}

function getDraftView(
  draft: ShipmentDraft,
  snapshot: ShipmentDraftSnapshot | null | undefined,
  patch: Partial<Record<ScalarField, unknown>> = {},
  item: PackageItem | null = null,
): DraftView {
  const currentItem = item ?? draft.items[0] ?? snapshot?.packages[0];

  return {
    origin: String(patch.origin ?? draft.origin?.value ?? snapshot?.origin ?? ""),
    destination: String(
      patch.destination ?? draft.destination?.value ?? snapshot?.dest ?? "",
    ),
    dropOffDate: String(
      patch.dropOffDate ?? draft.dropOffDate?.value ?? snapshot?.dropDateStr ?? "",
    ),
    deliveryDate: String(
      patch.deliveryDate ?? draft.deliveryDate?.value ?? snapshot?.delivDateStr ?? "",
    ),
    priority: (patch.priority ?? draft.priority?.value) as Priority | undefined,
    description: String(patch.description ?? draft.description?.value ?? ""),
    weightLbs: String(
      patch.weightLbs ?? draft.weightLbs?.value ?? currentItem?.weight ?? "",
    ),
    item: currentItem,
  };
}

function nextMissingField(view: DraftView): FormFillField {
  if (!view.origin) return "origin";
  if (!view.destination) return "destination";
  if (!view.dropOffDate) return "dropOffDate";
  if (!view.deliveryDate && view.priority !== "price") return "deliveryDate";

  const item = view.item;
  if (!item?.type) return "packageDetails";
  if (!item.weight || !item.l || !item.w || !item.h) return "packageDetails";

  return null;
}

function questionForField(field: FormFillField): string {
  switch (field) {
    case "origin":
      return "Where are you shipping from?";
    case "destination":
      return "Where is it going?";
    case "dropOffDate":
      return "When do you want to ship it?";
    case "deliveryDate":
      return "When does it need to arrive?";
    case "packageDetails":
      return "Do you know the package size and weight, or should I estimate it?";
    default:
      return "Your form is ready. Want me to find the best shipping options?";
  }
}

function quickRepliesForField(field: FormFillField): QuickReply[] | undefined {
  if (field !== "packageDetails") return undefined;

  return [
    { label: "Small box", prompt: "Use a small box estimate" },
    { label: "Medium box", prompt: "Use a medium box estimate" },
    { label: "Large box", prompt: "Use a large box estimate" },
    { label: "I know exact details", prompt: "I know the exact size and weight" },
  ];
}

function formatFilledSummary(
  patch: Partial<Record<ScalarField, unknown>>,
  item: PackageItem | null,
) {
  const parts: string[] = [];

  if (patch.origin && patch.destination) {
    parts.push(`${patch.origin} → ${patch.destination}`);
  } else {
    if (patch.origin) parts.push(`Pickup: ${patch.origin}`);
    if (patch.destination) parts.push(`Destination: ${patch.destination}`);
  }

  if (patch.dropOffDate) parts.push(`Ship date: ${patch.dropOffDate}`);
  if (patch.deliveryDate) parts.push(`Need by: ${patch.deliveryDate}`);
  if (patch.priority === "price") parts.push("Priority: cheapest");
  if (patch.weightLbs) parts.push(`Weight: ${patch.weightLbs} lbs`);

  if (item?.type) {
    const details = [
      item.type === "boxes" ? "Box" : titleCase(item.type),
      item.weight ? `${item.weight} lbs` : null,
      item.l && item.w && item.h ? `${item.l} × ${item.w} × ${item.h} in` : null,
    ].filter(Boolean);

    parts.push(details.join(" · "));
  }

  return parts.join("\n");
}

function buildLocalReply(
  patch: Partial<Record<ScalarField, unknown>>,
  item: PackageItem | null,
  nextField: FormFillField,
) {
  const summary = formatFilledSummary(patch, item);
  const nextQuestion = questionForField(nextField);

  if (summary && nextField) {
    return `Got it — I added this to the form:\n${summary}\n\n${nextQuestion}`;
  }

  if (summary) {
    return `Got it — I added this to the form:\n${summary}\n\nYour form looks ready. Want me to find the best shipping options?`;
  }

  return nextQuestion;
}

function shouldStartGuidedFill(message: string) {
  return /\b(help me fill|fill out the shipping form|start shipping form|build the shipment|create a shipment)\b/i.test(
    message,
  );
}

function applyActiveFieldAnswer(
  message: string,
  activeField: FormFillField,
  draft: ShipmentDraft,
  snapshot: ShipmentDraftSnapshot | null | undefined,
  items: PackageItem[],
): LocalFormFillResult | null {
  if (!activeField) return null;

  const patch: Partial<Record<ScalarField, unknown>> = {};
  let item: PackageItem | null = null;

  if (activeField === "origin") {
    const value = normalizeLocation(message);
    if (value) patch.origin = value;
  }

  if (activeField === "destination") {
    const value = normalizeLocation(message);
    if (value) patch.destination = value;
  }

  if (activeField === "dropOffDate") {
    const value = parseFlexibleDateFromText(message);
    if (value) patch.dropOffDate = value;
  }

  if (activeField === "deliveryDate") {
    const value = parseFlexibleDateFromText(message);

    if (value) {
      patch.deliveryDate = value;
    } else if (/\b(no rush|cheapest|lowest price|whenever|flexible)\b/i.test(message)) {
      patch.priority = "price";
    }
  }

  if (activeField === "packageDetails") {
    const estimated = estimatePackageFromMessage(message);
    const inferred = inferPackageFromMessage(message);
    const packageType = extractPackageType(message);

    if (estimated) {
      item = estimated;
    } else if (inferred) {
      item = inferred;
    } else if (packageType) {
      item = packageWithType(packageType);
    } else if (/\b(exact|know the exact|i know)\b/i.test(message)) {
      return {
        patch: {},
        item: null,
        patchedFields: [],
        reply:
          "Great — send it like this: weight and dimensions. Example: 11.8 lbs, 12 × 12 × 12 in.",
        nextField: "packageDetails",
      };
    }

    if (item) {
      item = mergePackage(items[0] ?? snapshot?.packages[0], item);
    }
  }

  const patchedFields = Object.keys(patch) as ScalarField[];

  if (patchedFields.length === 0 && !item) {
    return {
      patch: {},
      item: null,
      patchedFields: [],
      reply: `I didn’t catch that clearly. ${questionForField(activeField)}`,
      nextField: activeField,
      quickReplies: quickRepliesForField(activeField),
    };
  }

  const view = getDraftView(draft, snapshot, patch, item);
  const nextField = nextMissingField(view);

  return {
    patch,
    item,
    patchedFields,
    filledSummary: formatFilledSummary(patch, item),
    reply: buildLocalReply(patch, item, nextField),
    nextField,
    quickReplies: quickRepliesForField(nextField),
  };
}

function buildLocalFormFillResult(
  message: string,
  activeField: FormFillField,
  draft: ShipmentDraft,
  snapshot: ShipmentDraftSnapshot | null | undefined,
  items: PackageItem[],
): LocalFormFillResult | null {
  const trimmed = message.trim();

  if (activeField) {
    return applyActiveFieldAnswer(trimmed, activeField, draft, snapshot, items);
  }

  if (shouldStartGuidedFill(trimmed)) {
    const view = getDraftView(draft, snapshot);
    const nextField = nextMissingField(view);

    return {
      patch: {},
      item: null,
      patchedFields: [],
      reply: `Sure — I’ll help step by step. ${questionForField(nextField)}`,
      nextField,
      quickReplies: quickRepliesForField(nextField),
    };
  }

  if (isPureRecommendationQuestion(trimmed)) {
    return null;
  }

  const patch: Partial<Record<ScalarField, unknown>> = {
    ...extractRoutePatch(trimmed),
    ...extractExplicitEditPatch(trimmed),
  };

  const deliveryDate = parseDateFromText(trimmed);
  if (
    deliveryDate &&
    /\b(by|before|arrive|arrival|deliver|delivery|need)\b/i.test(trimmed)
  ) {
    patch.deliveryDate = deliveryDate;
  }

  const dropOff = trimmed.match(
    /\b(?:ship|send|drop off|pickup|pick up)\s+(?:it\s+|this\s+|the\s+package\s+)?(?:on\s+)?(.+?)(?=[,.;!?]|$)/i,
  );

  if (dropOff?.[1]) {
    const date = parseFlexibleDateFromText(dropOff[1]);
    if (date) patch.dropOffDate = date;
  }

  if (/\b(cheapest|lowest price|lowest cost|least expensive|no rush)\b/i.test(trimmed)) {
    patch.priority = "price";
  } else if (/\b(fastest|earliest|soonest)\b/i.test(trimmed)) {
    patch.priority = "speed";
  }

  let item: PackageItem | null = null;
  const packageType = extractPackageType(trimmed);
  const inferredPackage = inferPackageFromMessage(trimmed);
  const estimatedPackage = estimatePackageFromMessage(trimmed);

  if (estimatedPackage) {
    item = estimatedPackage;
  } else if (inferredPackage) {
    item = inferredPackage;
  } else if (packageType && hasShipmentPlanningIntent(trimmed)) {
    item = packageWithType(packageType);
  }

  if (item) {
    item = mergePackage(items[0] ?? snapshot?.packages[0], item);
  }

  const patchedFields = Object.keys(patch) as ScalarField[];
  const hasUsefulPatch = patchedFields.length > 0 || item !== null;

  if (!hasUsefulPatch) return null;

  const view = getDraftView(draft, snapshot, patch, item);
  const nextField = nextMissingField(view);

  return {
    patch,
    item,
    patchedFields,
    filledSummary: formatFilledSummary(patch, item),
    reply: buildLocalReply(patch, item, nextField),
    nextField,
    quickReplies: quickRepliesForField(nextField),
  };
}

function shouldAllowServerPatch(message: string, activeField: FormFillField) {
  if (activeField) return true;
  if (shouldStartGuidedFill(message)) return true;
  if (isPureRecommendationQuestion(message)) return false;

  return (
    Object.keys(extractRoutePatch(message)).length > 0 ||
    Object.keys(extractExplicitEditPatch(message)).length > 0
  );
}

export default function ShipSmartAssistant({
  quoteOptions = [],
  selectedPriority,
  formSnapshot,
}: ShipSmartAssistantProps) {
  const {
    draft,
    items,
    setItems,
    applyPatch,
    conflicts,
    resolveConflict,
    reset,
  } = useShipmentDraft();

  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [thread, setThread] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [convState, setConvState] = useState<ConciergeState | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingStage, setPendingStage] =
    useState<PendingStage>("analyzing");
  const [activeFormField, setActiveFormField] =
    useState<FormFillField>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [pillText, setPillText] = useState("");
  const [pillMode, setPillMode] = useState<PillTextMode>("typing");

  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SESSION_KEY)
      : null,
  );

  const seq = useRef(0);
  const recalled = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const draftSummary = useMemo(
    () => buildDraftSummary(draft, formSnapshot),
    [draft, formSnapshot],
  );

  const suggestions = showMore
    ? [...INITIAL_SUGGESTIONS, ...MORE_SUGGESTIONS]
    : INITIAL_SUGGESTIONS;

  useEffect(() => {
    if (open) return;

    const currentText = ROTATING_PILL_TEXT[promptIndex];
    const delay =
      pillMode === "holding"
        ? PILL_HOLD_MS
        : pillMode === "deleting" && pillText.length === 0
          ? PILL_GAP_MS
          : pillMode === "deleting"
            ? PILL_DELETE_SPEED_MS
            : PILL_TYPE_SPEED_MS;

    const timeout = window.setTimeout(() => {
      if (pillMode === "typing") {
        if (pillText.length < currentText.length) {
          setPillText(currentText.slice(0, pillText.length + 1));
          return;
        }

        setPillMode("holding");
        return;
      }

      if (pillMode === "holding") {
        setPillMode("deleting");
        return;
      }

      if (pillText.length > 0) {
        setPillText(pillText.slice(0, -1));
        return;
      }

      setPromptIndex((current) => (current + 1) % ROTATING_PILL_TEXT.length);
      setPillMode("typing");
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [open, promptIndex, pillMode, pillText]);

  useEffect(() => {
    if (!open || recalled.current || !sessionId) return;

    recalled.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const history = await getConciergeHistory(sessionId);

        if (cancelled) return;

        const turns: AssistantTurn[] = [];
        let lastQuestion = "";

        for (const message of history.messages) {
          if (message.role === "user") {
            lastQuestion = message.content;
          }

          if (message.role === "assistant") {
            turns.push({
              id: seq.current++,
              question: lastQuestion,
              reply: message.content,
            });

            lastQuestion = "";
          }
        }

        setThread(turns);
        setConvState(history.state);

        const patch = conciergeStateToPatch(history.state, emptyDraft());

        if (Object.keys(patch).length > 0) {
          applyPatch(patch, "hydrated");
        }

        const packageFromServer = packageFromConciergeState(history.state);

        if (packageFromServer) {
          setItems([packageFromServer]);
        }
      } catch {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(SESSION_KEY);
        }

        setSessionId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionId, applyPatch, setItems]);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [thread, pending, pendingStage]);

  useEffect(() => {
    if (!pending) {
      setPendingStage("analyzing");
      return;
    }

    setPendingStage("analyzing");

    const timeout = window.setTimeout(() => {
      setPendingStage("summarizing");
    }, 1100);

    return () => window.clearTimeout(timeout);
  }, [pending]);

  const trimmed = input.trim();
  const overLimit = input.length > ASSISTANT_INPUT_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !overLimit && !pending;

  const send = async (rawMessage?: string) => {
    const cleanMessage = (rawMessage ?? input).trim();

    if (!cleanMessage || pending) return;

    const currentReplyTarget = rawMessage ? null : replyTarget;

    const localFormFill = buildLocalFormFillResult(
      cleanMessage,
      activeFormField,
      draft,
      formSnapshot,
      items,
    );

    if (localFormFill) {
      if (localFormFill.patchedFields.length > 0) {
        applyPatch(localFormFill.patch, "chat");
      }

      if (localFormFill.item) {
        const nextItems =
          items.length > 0
            ? [mergePackage(items[0], localFormFill.item), ...items.slice(1)]
            : [localFormFill.item];

        setItems(nextItems);
      }

      setThread((prev) => [
        ...prev,
        {
          id: seq.current++,
          question: cleanMessage,
          reply: localFormFill.reply,
          patchedFields: localFormFill.patchedFields,
          filledSummary: localFormFill.filledSummary,
          replyTo: currentReplyTarget?.text,
          quickReplies: localFormFill.quickReplies,
        },
      ]);

      setActiveFormField(localFormFill.nextField);
      setInput("");
      setReplyTarget(null);
      setOpen(true);
      return;
    }

    const messageForAssistant = currentReplyTarget
      ? `Replying to this previous assistant message:\n"${currentReplyTarget.text}"\n\nUser reply:\n${cleanMessage}`
      : cleanMessage;

    const baseState = applyFormSnapshotToState(
      draftToConciergeState(draft, convState),
      formSnapshot,
    );

    const backendMessage = buildQuoteContext(
      messageForAssistant,
      quoteOptions,
      selectedPriority,
    );

    const allowServerPatch = shouldAllowServerPatch(
      cleanMessage,
      activeFormField,
    );

    const turnId = seq.current++;

    setThread((prev) => [
      ...prev,
      {
        id: turnId,
        question: cleanMessage,
        patchedFields: [],
        replyTo: currentReplyTarget?.text,
      },
    ]);

    setInput("");
    setReplyTarget(null);
    setPendingStage("analyzing");
    setPending(true);
    setOpen(true);

    try {
      const response = await postConciergeChat(
        backendMessage,
        baseState,
        sessionId,
      );

      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);

        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SESSION_KEY, response.session_id);
        }
      }

      setConvState(response.state);

      if (allowServerPatch) {
        const serverPatch = conciergeStateToPatch(response.state, draft);

        if (Object.keys(serverPatch).length > 0) {
          applyPatch(serverPatch, "chat");
        }

        const packageFromServer = packageFromConciergeState(response.state);

        if (packageFromServer) {
          setItems(
            items.length > 0
              ? [mergePackage(items[0], packageFromServer), ...items.slice(1)]
              : [packageFromServer],
          );
        }
      }

      setThread((prev) =>
        prev.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                reply: response.reply,
              }
            : turn,
        ),
      );
    } catch (error) {
      const friendly = friendlyAdvisorError(error);

      setThread((prev) =>
        prev.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                reply: friendly.message,
              }
            : turn,
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();

    if (canSend) {
      void send();
    }
  };

  const startOver = () => {
    reset();
    setThread([]);
    setConvState(null);
    setInput("");
    setReplyTarget(null);
    setShowMore(false);
    setActiveFormField(null);
    setSessionId(null);
    recalled.current = true;

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  return (
    <>
      <aside className={`ss-assistant-dock ${open ? "open" : ""}`}>
        <header className="ss-assistant-header">
          <div>
            <div className="ss-assistant-title">
              <img
                src={assistantLogo}
                alt=""
                aria-hidden="true"
                className="ss-assistant-logo"
              />
              <span>ShipSmart assistant</span>
            </div>

            {draftSummary && (
              <div className="ss-assistant-context">{draftSummary}</div>
            )}
          </div>

          <button
            type="button"
            className="ss-assistant-close"
            onClick={() => setOpen(false)}
            aria-label="Close ShipSmart assistant"
          >
            ×
          </button>
        </header>

        <div ref={bodyRef} className="ss-assistant-body">
          {thread.length === 0 && !pending ? (
            <>
              <section className="ss-assistant-intro" aria-label="ShipSmart assistant introduction">
                <div className="ss-assistant-intro-mark">
                  <img
                    src={assistantLogo}
                    alt=""
                    aria-hidden="true"
                    className="ss-assistant-intro-logo"
                  />
                </div>

                <div className="ss-assistant-intro-copy">
                  <h2>Ask ShipSmart</h2>
                  <p>
                    I can help fill the form, compare prices, check package
                    details, and explain the best shipping choice.
                  </p>
                </div>
              </section>

              <div className="ss-assistant-start-row">
                <h3>Getting Started</h3>

                <button
                  type="button"
                  onClick={() => setShowMore((value) => !value)}
                >
                  {showMore ? "Show less" : "Show more"}
                </button>
              </div>

              <div className="ss-assistant-suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    className="ss-assistant-suggestion"
                    onClick={() => void send(suggestion.prompt)}
                  >
                    <span className="ss-assistant-suggestion-icon">
                      {suggestion.icon}
                    </span>
                    <span className="ss-assistant-suggestion-label">
                      {suggestion.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="ss-assistant-messages">
              {thread.map((turn) => (
                <div key={turn.id} className="ss-assistant-turn">
                  {turn.replyTo && (
                    <div className="ss-assistant-reply-context user-context">
                      <span>Replying to</span>
                      <strong>{compactReplyText(turn.replyTo)}</strong>
                    </div>
                  )}

                  <div className="ss-assistant-message user">
                    {turn.question}
                  </div>

                  {turn.patchedFields && turn.patchedFields.length > 0 && (
                    <div className="ss-assistant-filled">
                      Filled: {fieldList(turn.patchedFields)}
                    </div>
                  )}

                  {turn.filledSummary && (
                    <div className="ss-assistant-form-update">
                      <span>Added to form</span>
                      <pre>{turn.filledSummary}</pre>
                    </div>
                  )}

                  {turn.reply ? (
                    <div className="ss-assistant-message-group assistant-group">
                      <div className="ss-assistant-message assistant">
                        {turn.reply}
                      </div>

                      {turn.quickReplies && turn.quickReplies.length > 0 && (
                        <div className="ss-assistant-quick-replies">
                          {turn.quickReplies.map((quickReply) => (
                            <button
                              key={quickReply.label}
                              type="button"
                              onClick={() => void send(quickReply.prompt)}
                            >
                              {quickReply.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        className="ss-assistant-reply-btn"
                        onClick={() =>
                          setReplyTarget({
                            turnId: turn.id,
                            text: turn.reply ?? "",
                          })
                        }
                      >
                        Reply
                      </button>
                    </div>
                  ) : (
                    <AssistantThinkingLoader stage={pendingStage} />
                  )}
                </div>
              ))}
            </div>
          )}

          {conflicts.map((conflict) => (
            <div key={conflict.field} className="ss-assistant-conflict">
              <div>
                Your form has <strong>{String(conflict.current)}</strong> for{" "}
                {FIELD_LABEL[conflict.field]}, but assistant found{" "}
                <strong>{String(conflict.incoming)}</strong>.
              </div>

              <div className="ss-assistant-conflict-actions">
                <button
                  type="button"
                  onClick={() => resolveConflict(conflict.field, "current")}
                >
                  Keep current
                </button>

                <button
                  type="button"
                  onClick={() => resolveConflict(conflict.field, "incoming")}
                >
                  Use assistant value
                </button>
              </div>
            </div>
          ))}
        </div>

        {thread.length > 0 && (
          <button
            type="button"
            className="ss-assistant-start-over"
            onClick={startOver}
          >
            Start over
          </button>
        )}

        <form className="ss-assistant-input-wrap" onSubmit={handleSubmit}>
          <div className="ss-assistant-input-shell">
            {replyTarget && (
              <div className="ss-assistant-reply-preview">
                <div>
                  <span>Replying to assistant</span>
                  <strong>{compactReplyText(replyTarget.text)}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  aria-label="Cancel reply"
                >
                  ×
                </button>
              </div>
            )}

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={thread.length > 0 ? "Ask follow up..." : "Ask about your shipment..."}
              className="ss-assistant-input"
              maxLength={ASSISTANT_INPUT_MAX_LENGTH}
              rows={3}
            />

            <div className="ss-assistant-input-footer">
              {input.length > 0 && (
                <span className="ss-assistant-char-count">
                  {input.length}/{ASSISTANT_INPUT_MAX_LENGTH}
                </span>
              )}

              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className="ss-assistant-send"
              >
                →
              </button>
            </div>
          </div>

          {overLimit && (
            <div className="ss-assistant-limit">Message is too long.</div>
          )}
        </form>
      </aside>

      <button
        type="button"
        className={`ss-ai-pill ${open ? "hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open ShipSmart assistant"
      >
        <img
          src={assistantLogo}
          alt=""
          aria-hidden="true"
          className="ss-ai-logo"
        />
        <span className="ss-ai-pill-text">{pillText}</span>
      </button>
    </>
  );
}
