// src/components/home/ShipSmartAssistantDock.tsx

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { CompareOption, Priority } from "@/components/shipping/compare.types";
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
} from "@/state/shipmentDraft";
import type { PackageItem } from "@/lib/shipping-data";

type AssistantTurn = {
  id: number;
  question: string;
  reply?: string;
  patchedFields?: ScalarField[];
  dispatched?: string | null;
};

type AssistantSuggestion = {
  icon: string;
  label: string;
  prompt: string;
};

interface ShipSmartAssistantDockProps {
  quoteOptions?: CompareOption[];
  selectedPriority?: Priority;
}

const SESSION_KEY = "ss_concierge_session";

const ROTATING_PILL_TEXT = [
  "Help me fill out the shipping form",
  "Find the cheapest way to ship",
  "Compare speed vs price",
  "Help me choose package details",
];

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

const SLOT_BY_FIELD: Record<ScalarField, string> = {
  origin: "origin",
  destination: "destination",
  originCountry: "origin_country",
  destinationCountry: "destination_country",
  dropOffDate: "drop_off_date",
  deliveryDate: "expected_delivery_date",
  weightLbs: "weight_lbs",
  priority: "priority",
  description: "description",
  declaredValueUsd: "declared_value_usd",
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

  if (/\btomorrow\b/.test(lower)) return tomorrowIso();

  const weekdayMatch = lower.match(
    /\b(?:by|before|on|arrive by|deliver by|delivery by|need by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );

  if (weekdayMatch?.[1]) return nextWeekdayIso(weekdayMatch[1]);

  return null;
}

function cleanupLocation(value: string) {
  return value
    .replace(/\b(package|box|shipment|parcel|luggage|suitcase)\b/gi, "")
    .replace(/\bby\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b\d+(\.\d+)?\s*(lb|lbs|pounds?)\b/gi, "")
    .replace(/\b\d+\s*[x×]\s*\d+\s*[x×]\s*\d+\b/gi, "")
    .replace(/[.;]+$/g, "")
    .trim();
}

function inferPackageFromMessage(message: string): PackageItem | null {
  const lower = message.toLowerCase();

  const weightMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/);
  const dimensionMatch = lower.match(
    /\b(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\b/,
  );
  const qtyMatch = lower.match(/\b(?:qty|quantity)\s*(?:is|:)?\s*(\d+)\b/);

  const type =
    lower.includes("luggage") || lower.includes("suitcase")
      ? "luggage"
      : lower.includes("box") || lower.includes("boxes")
        ? "boxes"
        : lower.includes("document")
          ? "documents"
          : lower.includes("fragile")
            ? "fragile"
            : lower.includes("electronics") || lower.includes("laptop")
              ? "electronics"
              : "boxes";

  if (!weightMatch && !dimensionMatch && !qtyMatch) return null;

  return {
    type,
    qty: qtyMatch?.[1] ?? "1",
    weight: weightMatch?.[1] ?? "",
    l: dimensionMatch?.[1] ?? "",
    w: dimensionMatch?.[2] ?? "",
    h: dimensionMatch?.[3] ?? "",
    handling: lower.includes("fragile") ? "fragile" : "standard",
  };
}

function inferPatchFromMessage(message: string): Partial<Record<ScalarField, unknown>> {
  const patch: Partial<Record<ScalarField, unknown>> = {};
  const text = message.trim();

  const routeWithFrom = text.match(
    /\bfrom\s+(.+?)\s+(?:to|→)\s+(.+?)(?=\s+(?:by|before|on|for|with|weighing|weight|need|arrive|deliver|delivery)\b|[,.;]|$)/i,
  );

  if (routeWithFrom?.[1] && routeWithFrom?.[2]) {
    const origin = cleanupLocation(routeWithFrom[1]);
    const destination = cleanupLocation(routeWithFrom[2]);

    if (origin) patch.origin = origin;
    if (destination) patch.destination = destination;
  }

  const routeWithoutFrom =
  !patch.origin && !patch.destination
    ? text.match(
        /^(.+?)\s+(?:to|→)\s+(.+?)(?=\s+(?:by|before|on|for|with|weighing|weight|need|arrive|deliver|delivery)\b|[,.;]|$)/i,
      )
    : null;

    if (routeWithoutFrom?.[1] && routeWithoutFrom?.[2]) {
    const origin = cleanupLocation(routeWithoutFrom[1]);
    const destination = cleanupLocation(routeWithoutFrom[2]);

    if (origin) patch.origin = origin;
    if (destination) patch.destination = destination;
    }

  const weightMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/i);
  if (weightMatch?.[1]) {
    const weight = Number(weightMatch[1]);
    if (Number.isFinite(weight) && weight > 0) patch.weightLbs = weight;
  }

  const declaredValueMatch = text.match(
    /\b(?:declared value|value|worth)\s*(?:is|of|:)?\s*\$?(\d+(?:\.\d+)?)\b/i,
  );

  if (declaredValueMatch?.[1]) {
    const value = Number(declaredValueMatch[1]);
    if (Number.isFinite(value) && value > 0) patch.declaredValueUsd = value;
  }

  const deliveryDate = parseDateFromText(text);
  if (
    deliveryDate &&
    /\b(by|before|arrive|arrival|deliver|delivery|need)\b/i.test(text)
  ) {
    patch.deliveryDate = deliveryDate;
  }

  const dropOffMatch = text.match(
    /\b(?:drop off|pickup|pick up|send|ship)\s+(?:on\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
  );

  if (dropOffMatch?.[1]) {
    const dropOffDate = parseDateFromText(dropOffMatch[1]);
    if (dropOffDate) patch.dropOffDate = dropOffDate;
  }

  if (/\b(cheapest|lowest price|lowest cost|least expensive)\b/i.test(text)) {
    patch.priority = "price";
  } else if (/\b(fastest|earliest|soonest)\b/i.test(text)) {
    patch.priority = "speed";
  } else if (/\b(on time|on-time|guaranteed)\b/i.test(text)) {
    patch.priority = "ontime";
  } else if (/\b(damage|protection|fragile|safe|safest)\b/i.test(text)) {
    patch.priority = "damage";
  }

  if (
    /\b(electronics|laptop|phone|clothes|clothing|documents|books|fragile|luggage|suitcase|box|boxes)\b/i.test(
      text,
    )
  ) {
    patch.description = text;
  }

  return patch;
}

function applyPatchToState(
  state: ConciergeState,
  patch: Partial<Record<ScalarField, unknown>>,
): ConciergeState {
  const slots = { ...(state.slots ?? {}) };

  for (const [field, value] of Object.entries(patch) as [ScalarField, unknown][]) {
    const slot = SLOT_BY_FIELD[field];

    if (slot && value !== undefined && value !== null && value !== "") {
      slots[slot] = value;
    }
  }

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

function buildDraftSummary(draft: ReturnType<typeof useShipmentDraft>["draft"]) {
  const parts = [
    draft.origin?.value && draft.destination?.value
      ? `${draft.origin.value} → ${draft.destination.value}`
      : null,
    draft.weightLbs?.value ? `${draft.weightLbs.value} lbs` : null,
    draft.deliveryDate?.value ? `Need by ${draft.deliveryDate.value}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export default function ShipSmartAssistantDock({
  quoteOptions = [],
  selectedPriority,
}: ShipSmartAssistantDockProps) {
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
  const [convState, setConvState] = useState<ConciergeState | null>(null);
  const [pending, setPending] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SESSION_KEY)
      : null,
  );

  const seq = useRef(0);
  const recalled = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const draftSummary = useMemo(() => buildDraftSummary(draft), [draft]);

  const suggestions = showMore
    ? [...INITIAL_SUGGESTIONS, ...MORE_SUGGESTIONS]
    : INITIAL_SUGGESTIONS;

  useEffect(() => {
    if (open) return;

    const interval = window.setInterval(() => {
      setPromptIndex((current) => (current + 1) % ROTATING_PILL_TEXT.length);
    }, 2300);

    return () => window.clearInterval(interval);
  }, [open]);

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
  }, [open, sessionId, applyPatch]);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [thread, pending]);

  const trimmed = input.trim();
  const overLimit = input.length > CONCIERGE_MAX_MESSAGE_LENGTH;
  const canSend = trimmed.length >= 2 && !overLimit && !pending;

  const send = async (rawMessage?: string) => {
    const cleanMessage = (rawMessage ?? input).trim();

    if (!cleanMessage || cleanMessage.length < 2 || pending) return;

    const optimisticPatch = inferPatchFromMessage(cleanMessage);
    const patchedFields = Object.keys(optimisticPatch) as ScalarField[];

    if (patchedFields.length > 0) {
      applyPatch(optimisticPatch, "chat");
    }

    const inferredPackage = inferPackageFromMessage(cleanMessage);

    if (inferredPackage) {
      const nextItems =
        items.length > 0
          ? [{ ...items[0], ...inferredPackage }]
          : [inferredPackage];

      setItems(nextItems);
    }

    const baseState = draftToConciergeState(draft, convState);
    const stateForServer = applyPatchToState(baseState, optimisticPatch);

    const backendMessage = buildQuoteContext(
      cleanMessage,
      quoteOptions,
      selectedPriority,
    );

    const turnId = seq.current++;

    setThread((prev) => [
      ...prev,
      {
        id: turnId,
        question: cleanMessage,
        patchedFields,
      },
    ]);

    setInput("");
    setPending(true);
    setOpen(true);

    try {
      const response = await postConciergeChat(
        backendMessage,
        stateForServer,
        sessionId,
      );

      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);

        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SESSION_KEY, response.session_id);
        }
      }

      setConvState(response.state);

      const serverPatch = conciergeStateToPatch(response.state, draft);

      if (Object.keys(serverPatch).length > 0) {
        applyPatch(serverPatch, "chat");
      }

      setThread((prev) =>
        prev.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                reply: response.reply,
                dispatched: response.dispatched_to,
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

  const startOver = () => {
    reset();
    setThread([]);
    setConvState(null);
    setInput("");
    setShowMore(false);
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
              <span className="ss-assistant-spark">✦</span>
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
                    <span>{suggestion.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="ss-assistant-messages">
              {thread.map((turn) => (
                <div key={turn.id}>
                  <div className="ss-assistant-message user">
                    {turn.question}
                  </div>

                  {turn.patchedFields && turn.patchedFields.length > 0 && (
                    <div className="ss-assistant-filled">
                      Filled: {fieldList(turn.patchedFields)}
                    </div>
                  )}

                  {turn.reply ? (
                    <div className="ss-assistant-message assistant">
                      {turn.reply}
                    </div>
                  ) : (
                    <div className="ss-assistant-message assistant muted">
                      Thinking…
                    </div>
                  )}
                </div>
              ))}

              {pending && thread.every((turn) => turn.reply) && (
                <div className="ss-assistant-message assistant muted">
                  Thinking…
                </div>
              )}
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
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Shipping where next?"
              className="ss-assistant-input"
              maxLength={CONCIERGE_MAX_MESSAGE_LENGTH}
            />

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="ss-assistant-send"
            >
              ↗
            </button>
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
        <span className="ss-ai-spark">✦</span>
        <span className="ss-ai-pill-text">
          {ROTATING_PILL_TEXT[promptIndex]}
        </span>
      </button>
    </>
  );
}