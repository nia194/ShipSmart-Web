import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  CompareOption,
  Priority,
} from "@/components/shipping/compare.types";
import { AssistantResultView } from "@/components/assistant/AssistantResult";
import { friendlyAdvisorError } from "@/lib/advisor-api";
import {
  CONCIERGE_MAX_MESSAGE_LENGTH,
  getConciergeHistory,
  postConciergeChat,
  type ConciergeState,
} from "@/lib/concierge-api";
import { useShipmentDraft } from "@/state/ShipmentDraftContext";
import {
  conciergeStateToPatch,
  draftToConciergeState,
  emptyDraft,
  type ScalarField,
} from "@/state/shipmentDraft";

const SESSION_KEY = "ss_concierge_session";

type ConciergePanelProps = {
  quoteOptions?: CompareOption[];
  selectedPriority?: Priority;
};

type Turn = {
  id: number;
  question: string;
  reply?: string;
  dispatched?: string | null;
  patchedFields?: ScalarField[];
  // Structured assistant contract (Product Roadmap §6). When the backend emits it,
  // the turn renders typed cards instead of prose; null keeps today's text render.
  assistant?: import("@/lib/typed-outputs").AssistantResponse | null;
};

const INITIAL_SUGGESTIONS = [
  {
    icon: "📦",
    label: "Ship a 12 lb box from Atlanta to Seattle by Friday",
  },
  {
    icon: "🖼️",
    label: "Upload a package photo and help fill the details",
  },
  {
    icon: "📍",
    label: "Use my current location as pickup",
  },
  {
    icon: "❓",
    label: "What info do I need to get a quote?",
  },
];

const MORE_SUGGESTIONS = [
  {
    icon: "⚡",
    label: "What is the fastest option for this shipment?",
  },
  {
    icon: "💸",
    label: "Which one is the cheapest?",
  },
  {
    icon: "📏",
    label: "Explain how package dimensions affect price",
  },
  {
    icon: "🚚",
    label: "Which carrier should I choose?",
  },
];

const FIELD_LABEL: Record<ScalarField, string> = {
  origin: "origin",
  destination: "destination",
  originCountry: "origin country",
  destinationCountry: "destination country",
  dropOffDate: "drop-off date",
  deliveryDate: "delivery date",
  weightLbs: "weight",
  priority: "priority",
  description: "description",
  declaredValueUsd: "declared value",
};

const DISPATCH_LABEL: Record<string, string> = {
  agent: "AI shipping advisor",
  summary: "shipment summary",
  workflow: "shipment workflow",
  compliance: "compliance check",
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

const CITY_ALIASES: Record<string, string> = {
  atlanta: "Atlanta, GA",
  seattle: "Seattle, WA",
  boston: "Boston, MA",
  "new york": "New York, NY",
  nyc: "New York, NY",
  "los angeles": "Los Angeles, CA",
  la: "Los Angeles, CA",
  chicago: "Chicago, IL",
  dallas: "Dallas, TX",
  miami: "Miami, FL",
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextWeekdayIso(dayName: string) {
  const target = WEEKDAY_INDEX[dayName.toLowerCase()];
  if (target === undefined) return null;

  const today = new Date();
  const result = new Date(today);
  const current = today.getDay();

  let diff = target - current;
  if (diff <= 0) diff += 7;

  result.setDate(today.getDate() + diff);

  return toIsoDate(result);
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toIsoDate(date);
}

function cleanupLocation(value: string) {
  return value
    .replace(/\b(package|box|shipment|parcel|luggage)\b/gi, "")
    .replace(
      /\bby\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      "",
    )
    .replace(/\b\d+(\.\d+)?\s*(lb|lbs|pounds?)\b/gi, "")
    .replace(/[.;]+$/g, "")
    .trim();
}

function normalizeLocation(value: string) {
  const cleaned = cleanupLocation(value);
  const key = cleaned.toLowerCase().replace(/\s+/g, " ").trim();

  return CITY_ALIASES[key] ?? cleaned;
}

function parseDateFromText(text: string) {
  const lower = text.toLowerCase();

  const isoMatch = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) return isoMatch[1];

  const slashMatch = lower.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
  );

  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3]
      ? Number(
          slashMatch[3].length === 2
            ? `20${slashMatch[3]}`
            : slashMatch[3],
        )
      : new Date().getFullYear();

    const date = new Date(year, month - 1, day);

    if (!Number.isNaN(date.getTime())) {
      return toIsoDate(date);
    }
  }

  if (/\btomorrow\b/.test(lower)) {
    return tomorrowIso();
  }

  const weekdayMatch = lower.match(
    /\b(?:by|before|on|arrive by|deliver by|need by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );

  if (weekdayMatch?.[1]) {
    return nextWeekdayIso(weekdayMatch[1]);
  }

  return null;
}

function inferPatchFromMessage(
  message: string,
): Partial<Record<ScalarField, unknown>> {
  const patch: Partial<Record<ScalarField, unknown>> = {};
  const text = message.trim();

  const weightMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/i);

  if (weightMatch?.[1]) {
    const weight = Number(weightMatch[1]);

    if (Number.isFinite(weight) && weight > 0) {
      patch.weightLbs = weight;
    }
  }

  const declaredValueMatch = text.match(
    /\b(?:declared value|value|worth)\s*(?:is|of|:)?\s*\$?(\d+(?:\.\d+)?)\b/i,
  );

  if (declaredValueMatch?.[1]) {
    const value = Number(declaredValueMatch[1]);

    if (Number.isFinite(value) && value > 0) {
      patch.declaredValueUsd = value;
    }
  }

  const routeWithFrom = text.match(
    /\bfrom\s+(.+?)\s+(?:to|→)\s+(.+?)(?=\s+(?:by|before|on|for|with|weighing|weight|need|arrive|deliver)\b|[,.;]|$)/i,
  );

  if (routeWithFrom?.[1] && routeWithFrom?.[2]) {
    const origin = normalizeLocation(routeWithFrom[1]);
    const destination = normalizeLocation(routeWithFrom[2]);

    if (origin) patch.origin = origin;
    if (destination) patch.destination = destination;
  }

  const routeWithoutFrom =
    patch.origin || patch.destination
      ? null
      : text.match(
          /^(.+?)\s+(?:to|→)\s+(.+?)(?=\s+(?:by|before|on|for|with|weighing|weight|need|arrive|deliver)\b|[,.;]|$)/i,
        );

  if (routeWithoutFrom) {
    const [, originRaw, destinationRaw] = routeWithoutFrom;

    if (originRaw && destinationRaw) {
      const origin = normalizeLocation(originRaw);
      const destination = normalizeLocation(destinationRaw);

      if (origin) patch.origin = origin;
      if (destination) patch.destination = destination;
    }
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

    if (dropOffDate) {
      patch.dropOffDate = dropOffDate;
    }
  }

  if (/\b(cheapest|lowest price|lowest cost|least expensive)\b/i.test(text)) {
    patch.priority = "price";
  } else if (/\b(fastest|earliest|soonest)\b/i.test(text)) {
    patch.priority = "speed";
  } else if (/\b(on time|on-time|guaranteed)\b/i.test(text)) {
    patch.priority = "ontime";
  } else if (/\b(damage|protection|fragile)\b/i.test(text)) {
    patch.priority = "damage";
  }

  return patch;
}

function applyPatchToState(
  state: ConciergeState,
  patch: Partial<Record<ScalarField, unknown>>,
): ConciergeState {
  const slots = { ...(state.slots ?? {}) };

  for (const [field, value] of Object.entries(patch) as [
    ScalarField,
    unknown,
  ][]) {
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
  return /\b(cheapest|lowest|fastest|earliest|best|which one|option|carrier|rate|price|cost|arrival|transit|ups|fedex|dhl)\b/i.test(
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
      ? `${option.transit_days}d`
      : option.arrival_label || option.arrival_date || "transit unavailable";

  const guarantee = option.guaranteed ? "guaranteed" : "not guaranteed";

  return `${index + 1}. ${option.carrier} ${option.service_name}: ${price}, ${transit}, ${guarantee}`;
}

function buildQuoteContext(
  message: string,
  quoteOptions?: CompareOption[],
  selectedPriority?: Priority,
) {
  if (!quoteOptions?.length || !quoteIntent(message)) {
    return message;
  }

  const optionsBlock = quoteOptions
    .slice(0, 10)
    .map((option, index) => formatQuoteOption(option, index))
    .join("\n");

  return `
${message}

Current quote options visible in the ShipSmart UI:
User priority: ${selectedPriority ?? "unknown"}

${optionsBlock}

When answering this question, use the visible quote options above. If the user asks for cheapest, fastest, earliest, or best, compare these options directly.
`.trim();
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

function fieldList(fields?: ScalarField[]) {
  if (!fields?.length) return "";

  return fields.map((field) => FIELD_LABEL[field] ?? field).join(", ");
}

export default function ConciergePanel({
  quoteOptions = [],
  selectedPriority,
}: ConciergePanelProps) {
  const { draft, applyPatch, conflicts, resolveConflict, reset } =
    useShipmentDraft();

  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [convState, setConvState] = useState<ConciergeState | null>(null);
  const [pending, setPending] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    role: "assistant";
    text: string;
  } | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SESSION_KEY)
      : null,
  );

  const seq = useRef(0);
  const recalled = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const draftSummary = useMemo(() => buildDraftSummary(draft), [draft]);

  const suggestions = showMore
    ? [...INITIAL_SUGGESTIONS, ...MORE_SUGGESTIONS]
    : INITIAL_SUGGESTIONS;

  useEffect(() => {
    if (recalled.current || !sessionId) return;

    recalled.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const history = await getConciergeHistory(sessionId);

        if (cancelled) return;

        const turns: Turn[] = [];
        let question: string | null = null;

        for (const message of history.messages) {
          if (message.role === "user") {
            question = message.content;
          } else if (message.role === "assistant") {
            turns.push({
              id: seq.current++,
              question: question ?? "",
              reply: message.content,
            });

            question = null;
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
  }, [sessionId, applyPatch]);

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

    const baseState = draftToConciergeState(draft, convState);
    const stateForServer = applyPatchToState(baseState, optimisticPatch);
    const backendMessage = buildQuoteContext(
      cleanMessage,
      quoteOptions,
      selectedPriority,
    );

    const target = replyTarget;

    const replyPayload: Parameters<typeof postConciergeChat>[3] | undefined =
      target
        ? {
            reply_to: {
              role: target.role,
              text: target.text,
            },
            recent_history: thread
              .flatMap((turn) => [
                {
                  role: "user" as const,
                  text: turn.question,
                },
                {
                  role: "assistant" as const,
                  text: turn.reply ?? "",
                },
              ])
              .filter((message) => message.text.trim().length > 0)
              .slice(-6),
          }
        : undefined;

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
    setReplyTarget(null);
    setPending(true);

    try {
      const response = await postConciergeChat(
        backendMessage,
        stateForServer,
        sessionId,
        replyPayload,
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
                assistant: response.assistant ?? null,
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
                reply: `Shipping assistance request failed: ${friendly.message}`,
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

  const handleSuggestionClick = (label: string) => {
    if (label.toLowerCase().includes("upload")) {
      fileInputRef.current?.click();
      return;
    }

    void send(label);
  };

  const startOver = () => {
    reset();
    setThread([]);
    setConvState(null);
    setInput("");
    setSessionId(null);
    setReplyTarget(null);
    recalled.current = true;

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  return (
    <section className="ss-concierge-card">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={() => {
          void send(
            "I uploaded a package photo. Help me estimate the package details and fill the shipment form.",
          );
        }}
      />

      <header className="ss-concierge-header">
        <div>
          <div className="ss-concierge-title">
            <span className="ss-concierge-spark">✦</span>
            <span>Shipping assistance</span>
          </div>

          {draftSummary && (
            <div className="ss-concierge-context">{draftSummary}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {thread.length > 0 && (
            <button
              type="button"
              onClick={startOver}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 11,
                fontWeight: 800,
                color: "#6b7280",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Start over
            </button>
          )}

          <button
            type="button"
            aria-label="Expand concierge"
            className="ss-concierge-expand"
          >
            ↗
          </button>
        </div>
      </header>

      <div className="ss-concierge-body">
        {thread.length === 0 && !pending ? (
          <>
            <div className="ss-concierge-start-row">
              <h3>Getting Started</h3>

              <button
                type="button"
                onClick={() => setShowMore((value) => !value)}
              >
                {showMore ? "Show less" : "Show more"}
              </button>
            </div>

            <div className="ss-concierge-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion.label)}
                  className="ss-concierge-suggestion"
                >
                  <span>{suggestion.icon}</span>
                  <span>{suggestion.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="ss-concierge-messages">
            {thread.map((turn) => (
              <div key={turn.id}>
                <div className="ss-concierge-message user">
                  {turn.question}
                </div>

                {turn.patchedFields && turn.patchedFields.length > 0 && (
                  <div
                    style={{
                      margin: "4px 0 8px auto",
                      maxWidth: "82%",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#2563eb",
                      textAlign: "right",
                    }}
                  >
                    Filled: {fieldList(turn.patchedFields)}
                  </div>
                )}

                {turn.reply ? (
                  <div className="ss-concierge-message assistant">
                    {turn.assistant ? (
                      <AssistantResultView response={turn.assistant} />
                    ) : (
                      turn.reply
                    )}

                    {turn.dispatched && DISPATCH_LABEL[turn.dispatched] && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#2563eb",
                        }}
                      >
                        {DISPATCH_LABEL[turn.dispatched]}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setReplyTarget({
                          role: "assistant",
                          text: turn.reply ?? "",
                        })
                      }
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#9ca3af",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      ↩ Reply
                    </button>
                  </div>
                ) : (
                  <div className="ss-concierge-message assistant muted">
                    Thinking…
                  </div>
                )}
              </div>
            ))}

            {pending && thread.every((turn) => turn.reply) && (
              <div className="ss-concierge-message assistant muted">
                Thinking…
              </div>
            )}
          </div>
        )}

        {conflicts.map((conflict) => (
          <div
            key={conflict.field}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              fontSize: 12,
              color: "#9a3412",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              I found a possible mismatch. Your form has{" "}
              {String(conflict.current)} for{" "}
              {FIELD_LABEL[conflict.field] ?? conflict.field}, but chat found{" "}
              {String(conflict.incoming)}. Which should I use?
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => resolveConflict(conflict.field, "current")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #fdba74",
                  background: "#ffffff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Keep current
              </button>

              <button
  type="button"
  onClick={() => resolveConflict(conflict.field, "incoming")}
  style={{
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #f97316",
    background: "#f97316",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  }}
>
  Use {String(conflict.incoming)}
</button>
            </div>
          </div>
        ))}
      </div>

      {replyTarget && (
        <div
          style={{
            margin: "0 14px 8px",
            padding: "8px 10px",
            borderRadius: 12,
            background: "#eef2ff",
            color: "#3730a3",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>
            Replying to advisor: {replyTarget.text.slice(0, 80)}
            {replyTarget.text.length > 80 ? "…" : ""}
          </span>

          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancel reply"
            style={{
              border: "none",
              background: "transparent",
              color: "#3730a3",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="ss-concierge-input-wrap">
        <div className="ss-concierge-input-shell">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload package photo"
            className="ss-concierge-plus"
          >
            +
          </button>

          <input
            aria-label="Message the concierge"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tell me what you’re shipping..."
            className="ss-concierge-input"
            maxLength={CONCIERGE_MAX_MESSAGE_LENGTH}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send();
              }
            }}
          />

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="ss-concierge-send"
          >
            ↗
          </button>
        </div>

        {overLimit && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#dc2626",
              fontWeight: 700,
            }}
          >
            Message is too long.
          </div>
        )}
      </form>
    </section>
  );
}