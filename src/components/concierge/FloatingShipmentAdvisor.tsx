import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ADVISOR_MAX_QUESTION_LENGTH,
  type AdvisorContext,
  type AdvisorSource,
  type DecisionPath,
  type ReplyContext,
  friendlyAdvisorError,
  postShippingAdvice,
} from "@/lib/advisor-api";
import type {
  CompareOption,
  Priority,
} from "@/components/shipping/compare.types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorSource[];
  decisionPath?: DecisionPath | null;
  question?: string;
  // Set on a user turn that replied to an earlier message (for the subtle indicator).
  replyTo?: { role: "user" | "assistant"; snippet: string };
};

const REPLY_SNIPPET_MAX = 90;

function replySnippet(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > REPLY_SNIPPET_MAX ? `${t.slice(0, REPLY_SNIPPET_MAX - 1)}…` : t;
}

function ReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-slate-400 transition hover:text-blue-600"
    >
      ↩ Reply
    </button>
  );
}

type ParsedSection = {
  label: string;
  body?: string;
  bullets?: string[];
};

type CarrierBrand = {
  name: string;
  shortName: string;
  logoSrc?: string;
  fallbackClass: string;
};

interface FloatingShipmentAdvisorProps {
  context: AdvisorContext;
  options?: CompareOption[] | null;
  selectedPriority: Priority;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  pinnedPrompt?: string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanServiceName(carrier: string, serviceName: string) {
  let clean = serviceName.replace(/\s+/g, " ").trim();

  clean = clean
    .replace(new RegExp(`^${escapeRegExp(carrier)}\\s+`, "i"), "")
    .trim();

  const lowerCarrier = carrier.toLowerCase();
  const lowerService = clean.toLowerCase();

  const isLuggageCarrier =
    lowerCarrier.includes("lugless") ||
    lowerCarrier.includes("luggageto") ||
    lowerCarrier.includes("luggage");

  if (isLuggageCarrier && lowerService.includes("standard")) return "Standard";
  if (isLuggageCarrier && lowerService.includes("economy")) return "Economy";
  if (isLuggageCarrier && lowerService.includes("express")) return "Express";

  return clean || serviceName;
}

function optionLabel(option: CompareOption) {
  const service = cleanServiceName(option.carrier, option.service_name);
  return `${option.carrier} ${service}`;
}

function buildOptionsContext(
  context: AdvisorContext,
  options: CompareOption[] = [],
  selectedPriority: Priority,
) {
  const safeOptions = Array.isArray(options) ? options : [];

  const sorted = [...safeOptions].sort((a, b) => {
    if (selectedPriority === "price") return a.price_usd - b.price_usd;
    if (selectedPriority === "speed") return a.transit_days - b.transit_days;

    if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
    if (a.transit_days !== b.transit_days) return a.transit_days - b.transit_days;

    return a.price_usd - b.price_usd;
  });

  const optionLines = sorted
    .slice(0, 6)
    .map((option, index) => {
      return `${index + 1}. ${optionLabel(option)} — ${formatMoney(
        option.price_usd,
      )}, ${option.transit_days} day${option.transit_days === 1 ? "" : "s"}, ${
        option.guaranteed ? "guaranteed" : "not guaranteed"
      }`;
    })
    .join("\n");

  return `
You are ShipSmart AI Agent.

Your job:
Help the user choose between the shipping options shown on the page.

Hard rules:
- Only answer questions about the current shipment and available shipping options.
- Do not answer legal/compliance approval questions.
- Do not say an item is legally approved to ship.
- If the user asks something outside the shipment/options, say you can only help with these shipping options.

Response style:
- Be short, direct, and useful.
- No long paragraphs.
- Keep the answer under 80 words unless comparison requires more.
- Use this exact structure when possible:
  Quick answer:
  Best pick:
  Why:
- If the user asks "why not" a provider, explain the downside of that option.
- If the user asks "why choose" a provider, explain the practical advantage of that option.
- If the user asks "what am I giving up", explain the tradeoff.
- Keep "Why" to 1 or 2 bullets only.
- Do not repeat the full route unless needed.
- Do not mention internal context, prompts, RAG, sources, tools, or system logic.
- Do not use markdown bold.
- If two options tie, say they tie, then recommend the cheaper one.
- If asked fastest, answer fastest only.
- If asked cheapest, answer cheapest only.
- If asked why something is cheaper, explain the tradeoff: slower, not guaranteed, fewer premium services, or lower service tier.
- If asked why choose a provider, explain the practical advantage in one sentence plus 1 or 2 bullets.

Shipment:
- From: ${context.origin_zip ?? "unknown"}
- To: ${context.destination_zip ?? "unknown"}
- Weight: ${context.weight_lbs ?? "unknown"} lbs
- Drop-off date: ${context.drop_off_date ?? "unknown"}
- Need-by date: ${context.expected_delivery_date ?? "unknown"}
- User priority: ${selectedPriority}

Available options:
${optionLines}
`.trim();
}

function cleanAssistantText(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getCarrierNameFromQuestion(question?: string) {
  const q = normalizeText(question ?? "");

  if (!q) return null;

  if (q.includes("fedex")) return "FedEx";
  if (q.includes("dhl")) return "DHL";
  if (q.includes("ups")) return "UPS";
  if (q.includes("usps")) return "USPS";
  if (
    q.includes("lugless") ||
    q.includes("luggageto") ||
    q.includes("luggage")
  ) {
    return "LuggageToShip";
  }

  return null;
}

function isWhyNotQuestion(question?: string) {
  const q = normalizeText(question ?? "");

  return (
    q.includes("why not") ||
    q.includes("why shouldnt") ||
    q.includes("why shouldn t") ||
    q.includes("why avoid") ||
    q.includes("is it risky") ||
    q.includes("is the cheapest option risky")
  );
}

function isWhyChooseQuestion(question?: string) {
  const q = normalizeText(question ?? "");

  return (
    q.includes("why choose") ||
    q.includes("why fedex") ||
    q.includes("why dhl") ||
    q.includes("why ups") ||
    q.includes("why usps") ||
    q.includes("why lugless") ||
    q.includes("why luggageto") ||
    q.includes("why luggage") ||
    q.includes("explain fedex") ||
    q.includes("explain dhl") ||
    q.includes("explain ups") ||
    q.includes("explain usps") ||
    q.includes("explain lugless") ||
    q.includes("explain luggageto") ||
    q.includes("explain luggage")
  );
}

function inferLabelFromQuestion(question?: string) {
  const q = normalizeText(question ?? "");
  const carrier = getCarrierNameFromQuestion(question);

  if (!q) return null;

  if (isWhyNotQuestion(question) && carrier) return `Why not ${carrier}`;
  if (isWhyChooseQuestion(question) && carrier) return `Why ${carrier}`;

  if (q.includes("why") && q.includes("cheaper")) return "Why it’s cheaper";
  if (q.includes("why") && q.includes("expensive")) return "Why it costs more";
  if (q.includes("what am i giving up") || q.includes("giving up")) {
    return "What you give up";
  }

  if (q.includes("fastest")) return "Fastest";
  if (q.includes("cheapest")) return "Cheapest";
  if (q.includes("guaranteed")) return "Guaranteed options";
  if (q.includes("best overall")) return "Best overall";
  if (q.includes("compare")) return "Comparison";
  if (q.includes("tradeoff")) return "Main tradeoff";

  return null;
}

function getReasonLabel(question?: string) {
  const q = normalizeText(question ?? "");
  const carrier = getCarrierNameFromQuestion(question);

  if (isWhyNotQuestion(question)) return "Main concern";

  if (isWhyChooseQuestion(question) && carrier) {
    return `Why ${carrier} works`;
  }

  if (q.includes("cheaper") || q.includes("lowest price")) {
    return "The tradeoff";
  }

  if (q.includes("expensive") || q.includes("costs more")) {
    return "Why it costs more";
  }

  if (q.includes("what am i giving up") || q.includes("giving up")) {
    return "What you give up";
  }

  if (q.includes("compare")) return "Main difference";
  if (q.includes("safe") || q.includes("reliable")) return "Why it’s safer";
  if (q.includes("guaranteed")) return "Guarantee details";

  return "Why it wins";
}

function inferPrimaryLabel(body: string, question?: string) {
  const questionLabel = inferLabelFromQuestion(question);
  if (questionLabel) return questionLabel;

  const lower = body.toLowerCase();

  if (
    lower.includes("cheaper") ||
    lower.includes("less expensive") ||
    lower.includes("lower cost")
  ) {
    return "Why it’s cheaper";
  }

  if (lower.includes("fastest")) return "Fastest";

  if (
    lower.includes("cheapest") ||
    lower.includes("lowest cost") ||
    lower.includes("lowest price")
  ) {
    return "Cheapest";
  }

  if (lower.includes("recommended") || lower.includes("best")) {
    return "Best option";
  }

  return "Answer";
}

function normalizeSectionLabel(rawLabel: string, body = "", question?: string) {
  const key = rawLabel.trim().toLowerCase();

  if (key === "quick answer") return inferPrimaryLabel(body, question);

  if (key === "best pick" || key === "best option") {
    if (isWhyNotQuestion(question)) return "Option in question";
    return "Best choice";
  }

  if (key === "option in question") return "Option in question";
  if (key === "fastest option") return "Fastest";
  if (key === "cheapest option") return "Cheapest";
  if (key === "why") return getReasonLabel(question);
  if (key === "tradeoff") return "Tradeoff";
  if (key === "price") return "Price";
  if (key === "note") return "Note";

  return rawLabel;
}

function parseAssistantSections(text: string, question?: string): ParsedSection[] {
  const clean = cleanAssistantText(text);
  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  const allowedLabels = new Set([
    "quick answer",
    "best pick",
    "best option",
    "option in question",
    "fastest option",
    "cheapest option",
    "price",
    "tradeoff",
    "why",
    "note",
  ]);

  const pushCurrent = () => {
    if (!current) return;

    if (current.body || current.bullets?.length) {
      sections.push(current);
    }

    current = null;
  };

  for (const line of lines) {
    const colonMatch = line.match(/^([^:]{2,40}):\s*(.*)$/);
    const bulletMatch = line.match(/^[-•]\s+(.*)$/);

    if (colonMatch) {
      const rawLabel = colonMatch[1].trim();
      const body = colonMatch[2]?.trim() || "";
      const lower = rawLabel.toLowerCase();

      if (allowedLabels.has(lower)) {
        pushCurrent();

        current = {
          label: normalizeSectionLabel(rawLabel, body, question),
          body: body || undefined,
          bullets: [],
        };

        continue;
      }
    }

    if (bulletMatch) {
      if (!current) {
        current = {
          label: getReasonLabel(question),
          bullets: [],
        };
      }

      current.bullets = [...(current.bullets ?? []), bulletMatch[1].trim()];
      continue;
    }

    if (!current) {
      current = {
        label: inferPrimaryLabel(line, question),
        body: line,
        bullets: [],
      };
    } else if (current.body) {
      current.body = `${current.body} ${line}`;
    } else {
      current.body = line;
    }
  }

  pushCurrent();

  if (sections.length === 0 && clean) {
    return [{ label: inferPrimaryLabel(clean, question), body: clean }];
  }

  return sections;
}

function getCarrierBrand(carrier: string): CarrierBrand {
  const value = carrier.toLowerCase();

  if (value.includes("fedex")) {
    return {
      name: "FedEx",
      shortName: "FedEx",
      logoSrc: "/carrier-logos/fedex.svg",
      fallbackClass: "bg-purple-600 text-white",
    };
  }

  if (value.includes("dhl")) {
    return {
      name: "DHL",
      shortName: "DHL",
      logoSrc: "/carrier-logos/dhl.svg",
      fallbackClass: "bg-yellow-300 text-red-700",
    };
  }

  if (value.includes("ups")) {
    return {
      name: "UPS",
      shortName: "UPS",
      logoSrc: "/carrier-logos/ups.svg",
      fallbackClass: "bg-amber-900 text-yellow-200",
    };
  }

  if (value.includes("usps")) {
    return {
      name: "USPS",
      shortName: "USPS",
      logoSrc: "/carrier-logos/usps.svg",
      fallbackClass: "bg-blue-700 text-white",
    };
  }

  if (
    value.includes("lugless") ||
    value.includes("luggageto") ||
    value.includes("luggage")
  ) {
    return {
      name: carrier,
      shortName: "Luggage",
      logoSrc: "/carrier-logos/luggagetoship.svg",
      fallbackClass: "bg-slate-900 text-white",
    };
  }

  return {
    name: carrier,
    shortName: carrier.slice(0, 8),
    fallbackClass: "bg-slate-700 text-white",
  };
}

function CarrierLogoBadge({ carrier }: { carrier: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const brand = getCarrierBrand(carrier);

  return (
    <div className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 shadow-sm">
      {brand.logoSrc && !logoFailed ? (
        <img
          src={brand.logoSrc}
          alt={`${brand.name} logo`}
          className="max-h-5 max-w-[76px] object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-extrabold tracking-tight ${brand.fallbackClass}`}
        >
          {brand.shortName}
        </span>
      )}
    </div>
  );
}

function findOptionInText(text: string, options: CompareOption[]) {
  const clean = normalizeText(text);

  const exactMatch = options.find((option) => {
    const fullName = normalizeText(`${option.carrier} ${option.service_name}`);
    return clean.includes(fullName);
  });

  if (exactMatch) return exactMatch;

  const displayNameMatch = options.find((option) => {
    return clean.includes(normalizeText(optionLabel(option)));
  });

  if (displayNameMatch) return displayNameMatch;

  const serviceAndCarrierMatch = options.find((option) => {
    return (
      clean.includes(normalizeText(option.carrier)) &&
      clean.includes(
        normalizeText(cleanServiceName(option.carrier, option.service_name)),
      )
    );
  });

  if (serviceAndCarrierMatch) return serviceAndCarrierMatch;

  const carrierAndPriceMatch = options.find((option) => {
    const priceWithDecimal = option.price_usd.toFixed(2);
    const priceWithoutDecimal = Math.round(option.price_usd).toString();

    return (
      clean.includes(normalizeText(option.carrier)) &&
      (clean.includes(normalizeText(priceWithDecimal)) ||
        clean.includes(normalizeText(priceWithoutDecimal)))
    );
  });

  if (carrierAndPriceMatch) return carrierAndPriceMatch;

  const serviceOnlyMatch = options.find((option) => {
    return clean.includes(
      normalizeText(cleanServiceName(option.carrier, option.service_name)),
    );
  });

  return serviceOnlyMatch ?? null;
}

function findOptionFromQuestion(question: string | undefined, options: CompareOption[]) {
  const carrier = getCarrierNameFromQuestion(question);

  if (!carrier) return null;

  const normalizedCarrier = normalizeText(carrier);

  const matching = options.filter((option) => {
    const optionCarrier = normalizeText(option.carrier);

    return (
      optionCarrier.includes(normalizedCarrier) ||
      normalizedCarrier.includes(optionCarrier) ||
      (normalizedCarrier.includes("luggage") &&
        (optionCarrier.includes("luggage") ||
          optionCarrier.includes("lugless") ||
          optionCarrier.includes("luggageto")))
    );
  });

  if (matching.length === 0) return null;

  return [...matching].sort((a, b) => {
    if (isWhyNotQuestion(question)) {
      if (a.price_usd !== b.price_usd) return a.price_usd - b.price_usd;
    }

    if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
    if (a.transit_days !== b.transit_days) return a.transit_days - b.transit_days;
    return a.price_usd - b.price_usd;
  })[0];
}

function findBestChoiceOption(
  section: ParsedSection,
  fullText: string,
  options: CompareOption[],
  question?: string,
) {
  if (isWhyNotQuestion(question)) {
    const fromQuestion = findOptionFromQuestion(question, options);
    if (fromQuestion) return fromQuestion;
  }

  if (section.body) {
    const matchFromBody = findOptionInText(section.body, options);
    if (matchFromBody) return matchFromBody;
  }

  const fromText = findOptionInText(fullText, options);
  if (fromText) return fromText;

  return findOptionFromQuestion(question, options);
}

function isCheapestOption(option: CompareOption, options: CompareOption[]) {
  const cheapest = [...options].sort((a, b) => a.price_usd - b.price_usd)[0];
  return cheapest?.id === option.id;
}

function isFastestOption(option: CompareOption, options: CompareOption[]) {
  const fastest = [...options].sort((a, b) => a.transit_days - b.transit_days)[0];
  return fastest?.transit_days === option.transit_days;
}

function OptionPill({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      {children}
    </span>
  );
}

function BestChoiceOptionCard({
  option,
  options,
}: {
  option: CompareOption;
  options: CompareOption[];
}) {
  const service = cleanServiceName(option.carrier, option.service_name);
  const pills: string[] = [];

  if (isCheapestOption(option, options)) pills.push("Lowest price");
  if (isFastestOption(option, options)) pills.push("Fastest");

  pills.push(`${option.transit_days} day${option.transit_days === 1 ? "" : "s"}`);
  pills.push(option.guaranteed ? "Guaranteed" : "Not guaranteed");

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <CarrierLogoBadge carrier={option.carrier} />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold leading-snug text-slate-950">
            {option.carrier} {service}
          </div>

          <div className="mt-0.5 text-xs font-semibold text-slate-500">
            {formatMoney(option.price_usd)}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills.slice(0, 4).map((pill) => (
              <OptionPill key={pill}>{pill}</OptionPill>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMentionedCarriers(text: string, options: CompareOption[]) {
  const clean = normalizeText(text);
  const seen = new Set<string>();
  const carriers: string[] = [];

  for (const option of options) {
    const carrier = option.carrier;
    const service = `${option.carrier} ${option.service_name}`;

    if (
      clean.includes(normalizeText(carrier)) ||
      clean.includes(normalizeText(service))
    ) {
      if (!seen.has(carrier)) {
        seen.add(carrier);
        carriers.push(carrier);
      }
    }
  }

  return carriers.slice(0, 3);
}

function findComparableMoreExpensiveOption(
  option: CompareOption,
  options: CompareOption[],
) {
  return options
    .filter((candidate) => candidate.id !== option.id)
    .filter((candidate) => candidate.transit_days === option.transit_days)
    .filter((candidate) => candidate.price_usd > option.price_usd)
    .sort((a, b) => a.price_usd - b.price_usd)[0];
}

function polishBodyText(
  body: string,
  question?: string,
  options: CompareOption[] = [],
) {
  let clean = body.trim();
  const targetOption = findOptionFromQuestion(question, options);
  const matched = findOptionInText(clean, options) ?? targetOption;

  if (isWhyChooseQuestion(question) && matched) {
    const service = cleanServiceName(matched.carrier, matched.service_name);
    const comparable = findComparableMoreExpensiveOption(matched, options);

    if (/^choose\s+/i.test(clean) || clean.length < 35) {
      if (comparable) {
        return `${matched.carrier} ${service} is the safer pick when delivery timing matters because it gives you ${matched.guaranteed ? "guaranteed " : ""}${matched.transit_days}-day delivery for less than ${comparable.carrier}.`;
      }

      return `${matched.carrier} ${service} is the safer pick when delivery timing matters because it offers ${matched.guaranteed ? "guaranteed " : ""}${matched.transit_days}-day delivery.`;
    }
  }

  if (isWhyNotQuestion(question) && targetOption) {
    const service = cleanServiceName(targetOption.carrier, targetOption.service_name);

    if (/^choose\s+/i.test(clean) || clean.length < 45) {
      return `${targetOption.carrier} ${service} can be cheaper, but it is weaker if delivery certainty matters.`;
    }
  }

  clean = clean
    .replace(
      /because it offers a standard shipping service that is less expensive than express options\.?/i,
      "because it trades speed and guarantee for a lower price.",
    )
    .replace(
      /because it is less expensive than express options\.?/i,
      "because it trades speed and guarantee for a lower price.",
    )
    .replace(/\s+/g, " ")
    .trim();

  return clean;
}

function cleanBulletText(bullet: string) {
  let clean = bullet
    .replace(/^however,\s*/i, "")
    .replace(/^although\s*/i, "")
    .replace(/^it\s+/i, "")
    .replace(/compared to cheaper options that are not guaranteed,\s*/i, "")
    .replace(/ensuring your shipment arrives on time\.?/i, "better delivery confidence.")
    .replace(/meeting your need-by date of\s*/i, "Meets your deadline: ")
    .replace(/by your need-by date\.?/i, "")
    .replace(/\s+/g, " ")
    .trim();

  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  if (clean.length <= 100) return clean;

  return `${clean.slice(0, 97).trim()}...`;
}

function shouldHideBullet(sectionLabel: string, bullet: string) {
  const label = sectionLabel.toLowerCase();
  const lower = bullet.toLowerCase();

  if (
    label.includes("cheaper") &&
    (lower.includes("for on-time delivery") ||
      lower.includes("consider express") ||
      lower.includes("if you need guaranteed"))
  ) {
    return true;
  }

  return false;
}

function BotMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
    >
      <rect
        x="5"
        y="7"
        width="14"
        height="11"
        rx="4"
        className="fill-white"
      />
      <path
        d="M9 7V5.8C9 4.8 9.8 4 10.8 4h2.4C14.2 4 15 4.8 15 5.8V7"
        className="stroke-white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="12.2" r="1.1" className="fill-blue-600" />
      <circle cx="14.5" cy="12.2" r="1.1" className="fill-blue-600" />
      <path
        d="M9.5 15.2h5"
        className="stroke-blue-600"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
      <BotMark />
    </div>
  );
}

function AssistantAnswer({
  text,
  options,
  question,
}: {
  text: string;
  options: CompareOption[];
  question?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const clean = cleanAssistantText(text);
  const tooLong = clean.length > 650;
  const displayText = !tooLong || expanded ? clean : `${clean.slice(0, 650)}...`;
  const sections = parseAssistantSections(displayText, question);

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const isPrimary = index === 0;
        const lowerLabel = section.label.toLowerCase();

        const shouldRenderOptionCard =
          lowerLabel === "best choice" || lowerLabel === "option in question";

        const matchedOption = shouldRenderOptionCard
          ? findBestChoiceOption(section, clean, options, question)
          : null;

        const polishedBody = section.body
          ? polishBodyText(section.body, question, options)
          : undefined;

        const bullets = (section.bullets ?? [])
          .filter((bullet) => !shouldHideBullet(section.label, bullet))
          .map(cleanBulletText)
          .slice(0, 2);

        return (
          <div key={`${section.label}-${index}`}>
            <div
              className={
                isPrimary
                  ? "text-[11px] font-bold tracking-wide text-blue-700"
                  : "text-[11px] font-bold tracking-wide text-slate-500"
              }
            >
              {section.label}
            </div>

            {matchedOption ? (
              <BestChoiceOptionCard option={matchedOption} options={options} />
            ) : (
              polishedBody && (
                <p
                  className={
                    isPrimary
                      ? "mt-1 text-[15px] font-semibold leading-relaxed text-slate-950"
                      : "mt-1 text-sm leading-relaxed text-slate-700"
                  }
                >
                  {polishedBody}
                </p>
              )
            )}

            {bullets.length > 0 && (
              <ul className="mt-1.5 space-y-1.5">
                {bullets.map((bullet, bulletIndex) => (
                  <li
                    key={`${bullet}-${bulletIndex}`}
                    className="flex gap-2 text-sm leading-relaxed text-slate-700"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {tooLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function SourceDisclosure({ sources }: { sources?: AdvisorSource[] }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
      >
        Based on carrier guides
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sources.slice(0, 4).map((source, index) => (
            <span
              key={`${source.source}-${index}`}
              className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {source.source}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2">
      <BotAvatar />

      <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-slate-50 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: "240ms" }}
        />
      </div>
    </div>
  );
}

function PriorityLabel({ priority }: { priority: Priority }) {
  const labels: Record<Priority, string> = {
    ontime: "On-time",
    damage: "Protection",
    price: "Lowest price",
    speed: "Fastest",
  };

  return labels[priority] ?? "Balanced";
}

function getCheapestOption(options: CompareOption[]) {
  return [...options].sort((a, b) => a.price_usd - b.price_usd)[0];
}

function getFastestOptions(options: CompareOption[]) {
  const sorted = [...options].sort((a, b) => a.transit_days - b.transit_days);
  const fastestDays = sorted[0]?.transit_days;

  return sorted.filter((option) => option.transit_days === fastestDays);
}

function getGuaranteedOptions(options: CompareOption[]) {
  return options.filter((option) => option.guaranteed);
}


function formatTransit(option: CompareOption) {
  return `${option.transit_days} day${option.transit_days === 1 ? "" : "s"}`;
}

function optionSummary(option: CompareOption) {
  return `${optionLabel(option)} — ${formatMoney(option.price_usd)}, ${formatTransit(option)}, ${
    option.guaranteed ? "guaranteed" : "not guaranteed"
  }`;
}

function sortOptionsByPriority(options: CompareOption[], priority: Priority) {
  return [...options].sort((a, b) => {
    if (priority === "price") return a.price_usd - b.price_usd;
    if (priority === "speed") {
      if (a.transit_days !== b.transit_days) return a.transit_days - b.transit_days;
      return a.price_usd - b.price_usd;
    }

    if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
    if (a.transit_days !== b.transit_days) return a.transit_days - b.transit_days;
    return a.price_usd - b.price_usd;
  });
}

function getBestOverallOption(options: CompareOption[], priority: Priority) {
  return sortOptionsByPriority(options, priority)[0] ?? null;
}

function getCheapestOptions(options: CompareOption[]) {
  const cheapest = getCheapestOption(options);
  if (!cheapest) return [];

  return options.filter((option) => option.price_usd === cheapest.price_usd);
}

function getFastestOption(options: CompareOption[]) {
  const fastest = getFastestOptions(options)[0];
  if (!fastest) return null;

  return getFastestOptions(options).sort((a, b) => a.price_usd - b.price_usd)[0];
}

function priceDifference(a: CompareOption, b: CompareOption) {
  return Math.abs(a.price_usd - b.price_usd);
}

function describeOptionTradeoff(option: CompareOption, options: CompareOption[]) {
  const fastest = getFastestOption(options);
  const cheapest = getCheapestOption(options);

  if (cheapest?.id === option.id && fastest && fastest.id !== option.id) {
    const extraDays = option.transit_days - fastest.transit_days;

    if (extraDays > 0) {
      return `Tradeoff: it saves money, but takes ${extraDays} more day${extraDays === 1 ? "" : "s"} than the fastest option.`;
    }

    if (!option.guaranteed) {
      return "Tradeoff: it saves money, but delivery is not guaranteed.";
    }
  }

  if (fastest?.id === option.id && cheapest && cheapest.id !== option.id) {
    return `Tradeoff: it is faster, but costs ${formatMoney(priceDifference(option, cheapest))} more than the cheapest option.`;
  }

  if (!option.guaranteed) return "Tradeoff: delivery is not guaranteed.";

  return "Tradeoff: it may cost more, but gives better delivery confidence.";
}

function buildCheapestAnswer(options: CompareOption[]) {
  const cheapestOptions = getCheapestOptions(options);
  const cheapest = cheapestOptions[0];

  if (!cheapest) return null;

  const tieText = cheapestOptions.length > 1 ? "There is a tie for the cheapest option." : "";

  return `Quick answer: ${tieText || `The cheapest option is ${optionLabel(cheapest)} at ${formatMoney(cheapest.price_usd)}.`}
Best pick: ${optionSummary(cheapest)}
Why:
- Lowest price among the available options on this page.
- ${describeOptionTradeoff(cheapest, options)}`;
}

function buildFastestAnswer(options: CompareOption[]) {
  const fastest = getFastestOption(options);

  if (!fastest) return null;

  return `Quick answer: The fastest option is ${optionLabel(fastest)} with ${formatTransit(fastest)} delivery.
Best pick: ${optionSummary(fastest)}
Why:
- Shortest transit time among the available options.
- ${describeOptionTradeoff(fastest, options)}`;
}

function buildBestOverallAnswer(options: CompareOption[], selectedPriority: Priority) {
  const best = getBestOverallOption(options, selectedPriority);

  if (!best) return null;

  const priorityLine: Record<Priority, string> = {
    ontime: "It balances delivery confidence, speed, and price for your deadline.",
    damage: "It is the safer pick when reliability and handling matter more than the absolute lowest price.",
    price: "It best matches your lowest-price priority.",
    speed: "It best matches your fastest-arrival priority.",
  };

  return `Quick answer: ${optionLabel(best)} is the best overall fit for your selected priority.
Best pick: ${optionSummary(best)}
Why:
- ${priorityLine[selectedPriority] ?? priorityLine.ontime}
- ${describeOptionTradeoff(best, options)}`;
}

function buildComparePriceSpeedAnswer(options: CompareOption[]) {
  const cheapest = getCheapestOption(options);
  const fastest = getFastestOption(options);

  if (!cheapest || !fastest) return null;

  if (cheapest.id === fastest.id) {
    return `Quick answer: ${optionLabel(cheapest)} is both the cheapest and fastest option.
Best pick: ${optionSummary(cheapest)}
Why:
- It gives you the lowest price without sacrificing speed.
- ${cheapest.guaranteed ? "Delivery is guaranteed." : "Delivery is not guaranteed, so confirm timing before booking."}`;
  }

  return `Quick answer: Cheapest and fastest are different options.
Best pick: ${optionSummary(fastest)}
Why:
- Cheapest: ${optionSummary(cheapest)}.
- Fastest: ${optionSummary(fastest)}.`;
}

function buildWhyChooseAnswer(question: string, options: CompareOption[]) {
  const option = findOptionFromQuestion(question, options);

  if (!option) return null;

  return `Quick answer: ${optionLabel(option)} works best when you care about ${
    option.guaranteed ? "delivery certainty" : "keeping the price lower"
  }.
Best pick: ${optionSummary(option)}
Why:
- ${option.guaranteed ? "Guaranteed delivery gives you stronger confidence for the deadline." : "Lower service tier can reduce cost if your timing is flexible."}
- ${describeOptionTradeoff(option, options)}`;
}

function buildWhyNotAnswer(question: string, options: CompareOption[]) {
  const option = findOptionFromQuestion(question, options);

  if (!option) return null;

  return `Quick answer: ${optionLabel(option)} can still make sense, but it is not the safest choice if timing matters.
Best pick: ${optionSummary(option)}
Why:
- ${option.guaranteed ? "Main concern is price if there is a cheaper option close enough." : "Main concern is that delivery is not guaranteed."}
- ${describeOptionTradeoff(option, options)}`;
}

function buildCheaperTradeoffAnswer(question: string, options: CompareOption[]) {
  const target = findOptionFromQuestion(question, options) ?? getCheapestOption(options);

  if (!target) return null;

  return `Quick answer: ${optionLabel(target)} is cheaper because it likely trades premium delivery confidence for cost.
Best pick: ${optionSummary(target)}
Why:
- Lower-priced options usually mean slower transit, fewer premium guarantees, or a lower service tier.
- ${describeOptionTradeoff(target, options)}`;
}

function buildGivingUpAnswer(question: string, options: CompareOption[], selectedPriority: Priority) {
  const target = findOptionFromQuestion(question, options) ?? getCheapestOption(options);
  const best = getBestOverallOption(options, selectedPriority);

  if (!target) return null;

  const comparedTo = best && best.id !== target.id ? ` compared with ${optionLabel(best)}` : "";

  return `Quick answer: You are mostly giving up delivery confidence or speed${comparedTo}.
Best pick: ${optionSummary(target)}
Why:
- ${describeOptionTradeoff(target, options)}
- Choose it only if the savings matter more than the delivery risk.`;
}

function tryBuildLocalAnswer(
  question: string,
  options: CompareOption[],
  selectedPriority: Priority,
) {
  const q = normalizeText(question);

  if (options.length === 0) return null;

  if (isWhyNotQuestion(question)) return buildWhyNotAnswer(question, options);
  if (isWhyChooseQuestion(question)) return buildWhyChooseAnswer(question, options);

  if (q.includes("what am i giving up") || q.includes("giving up")) {
    return buildGivingUpAnswer(question, options, selectedPriority);
  }

  if ((q.includes("why") && q.includes("cheaper")) || q.includes("lowest price")) {
    return buildCheaperTradeoffAnswer(question, options);
  }

  if (q.includes("compare") && q.includes("price") && q.includes("speed")) {
    return buildComparePriceSpeedAnswer(options);
  }

  if (q.includes("cheapest") || q.includes("lowest cost") || q.includes("lowest price")) {
    return buildCheapestAnswer(options);
  }

  if (q.includes("fastest") || q.includes("earliest") || q.includes("quickest")) {
    return buildFastestAnswer(options);
  }

  if (q.includes("best overall") || q.includes("recommended") || q.includes("best option")) {
    return buildBestOverallAnswer(options, selectedPriority);
  }

  return null;
}

function buildDynamicSuggestions(
  messages: ChatMessage[],
  options: CompareOption[],
  selectedPriority: Priority,
) {
  const askedQuestions = messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeText(message.content))
    .join(" | ");

  const lastAssistant =
    [...messages].reverse().find((message) => message.role === "assistant")
      ?.content ?? "";

  const lastQuestion =
    [...messages].reverse().find((message) => message.role === "assistant")
      ?.question ?? "";

  const lastAssistantClean = normalizeText(lastAssistant);
  const lastQuestionClean = normalizeText(lastQuestion);

  const cheapest = getCheapestOption(options);
  const fastest = getFastestOptions(options);
  const guaranteed = getGuaranteedOptions(options);
  const mentionedCarriers = getMentionedCarriers(lastAssistant, options);

  const candidates: string[] = [];

  if (isWhyNotQuestion(lastQuestion)) {
    candidates.push("What is the safer alternative?");
    candidates.push("Compare with best overall");
    candidates.push("What am I giving up?");
  }

  if (isWhyChooseQuestion(lastQuestion)) {
    candidates.push("Compare with cheaper options");
    candidates.push("Is it worth the price?");
    candidates.push("What is the main tradeoff?");
  }

  if (
    lastAssistantClean.includes("cheapest") ||
    selectedPriority === "price" ||
    lastQuestionClean.includes("cheapest")
  ) {
    candidates.push("Compare with fastest");
    candidates.push("What am I giving up?");
    candidates.push("Show best overall");
  }

  if (
    lastAssistantClean.includes("fastest") ||
    selectedPriority === "speed" ||
    lastQuestionClean.includes("fastest")
  ) {
    candidates.push("Compare with cheapest");
    candidates.push("Is faster worth it?");
    candidates.push("Which fastest option is cheaper?");
  }

  if (lastAssistantClean.includes("guaranteed")) {
    candidates.push("Show cheaper non-guaranteed");
    candidates.push("Is guarantee worth it?");
  } else if (guaranteed.length > 0) {
    candidates.push("Which options are guaranteed?");
  }

  if (mentionedCarriers.length > 0) {
    const firstCarrier = mentionedCarriers[0];
    candidates.push(`Why choose ${firstCarrier}?`);
  }

  if (cheapest) {
    candidates.push(`Why is ${cheapest.carrier} cheaper?`);
  }

  if (fastest.length > 1) {
    candidates.push("Which fastest option should I pick?");
  }

  candidates.push("Compare price vs speed");
  candidates.push("Which is best overall?");
  candidates.push("What is the main tradeoff?");

  const unique = Array.from(new Set(candidates));

  return unique
    .filter((suggestion) => {
      const normalized = normalizeText(suggestion);
      return !askedQuestions.includes(normalized);
    })
    .slice(0, 4);
}

export default function FloatingShipmentAdvisor({
  context,
  options,
  selectedPriority,
  open: controlledOpen,
  onOpenChange,
  pinnedPrompt,
}: FloatingShipmentAdvisorProps) {
  const safeOptions = useMemo(
    () => (Array.isArray(options) ? options : []),
    [options],
  );

  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !pinnedPrompt || messages.length > 0) return;

    setInput((current) => (current.trim() ? current : pinnedPrompt));
  }, [open, pinnedPrompt, messages.length]);

  const optionsContext = useMemo(
    () => buildOptionsContext(context, safeOptions, selectedPriority),
    [context, safeOptions, selectedPriority],
  );

  const ask = useMutation({
    mutationFn: async ({ question, reply }: { question: string; reply?: ReplyContext }) => {
      const enrichedQuestion = `${optionsContext}\n\nUser question:\n${question}`;
      return postShippingAdvice(enrichedQuestion, context, reply);
    },
    onSuccess: (response, { question }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: response.answer,
          sources: response.sources ?? [],
          decisionPath: response.decision_path ?? null,
          question,
        },
      ]);

      setInput("");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, open, ask.isPending]);

  const trimmed = input.trim();
  const overLimit = input.length > ADVISOR_MAX_QUESTION_LENGTH;
  const canSend = trimmed.length >= 3 && !overLimit && !ask.isPending;

  const sendQuestion = (question: string) => {
    const clean = question.trim();

    if (clean.length < 3 || ask.isPending) return;

    // Capture the reply target (if any) + a bounded recent history BEFORE this turn.
    const target = replyTarget;
    const reply: ReplyContext | undefined = target
      ? {
          reply_to: { role: target.role, text: target.content },
          recent_history: messages.slice(-6).map((m) => ({ role: m.role, text: m.content })),
        }
      : undefined;

    const localAnswer = tryBuildLocalAnswer(clean, safeOptions, selectedPriority);

    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        {
          id: makeId(),
          role: "user",
          content: clean,
          replyTo: target
            ? { role: target.role, snippet: replySnippet(target.content) }
            : undefined,
        },
      ];

      if (!localAnswer) return next;

      return [
        ...next,
        {
          id: makeId(),
          role: "assistant",
          content: localAnswer,
          sources: [],
          decisionPath: null,
          question: clean,
        },
      ];
    });

    setReplyTarget(null); // a reply is consumed once sent

    if (localAnswer) {
      setInput("");
      return;
    }

    ask.mutate({ question: clean, reply });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!canSend) return;

    sendQuestion(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (canSend) {
        sendQuestion(trimmed);
      }
    }
  };

  const friendlyError = ask.isError ? friendlyAdvisorError(ask.error) : null;

  const starterSuggestions = useMemo(() => {
    const base = [
      "Which option is fastest?",
      "Which option is cheapest?",
      "Which is best overall?",
      "Compare price vs speed",
    ];

    return Array.from(new Set([...(pinnedPrompt ? [pinnedPrompt] : []), ...base])).slice(0, 4);
  }, [pinnedPrompt]);

  const dynamicFollowUps = useMemo(
    () => buildDynamicSuggestions(messages, safeOptions, selectedPriority),
    [messages, safeOptions, selectedPriority],
  );

  const shouldShowFollowUps =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    !ask.isPending &&
    dynamicFollowUps.length > 0;

  if (!mounted) return null;
  if (safeOptions.length === 0) return null;

  const chatWidget = (
    <>
      <style>
        {`
          .shipsmart-chat-scroll {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
          }

          .shipsmart-chat-scroll::-webkit-scrollbar {
            width: 8px;
          }

          .shipsmart-chat-scroll::-webkit-scrollbar-track {
            background: transparent;
          }

          .shipsmart-chat-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 999px;
            border: 2px solid transparent;
            background-clip: content-box;
          }
        `}
      </style>

      {open && (
        <button
          type="button"
          aria-label="Close chat overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[9998] bg-black/10 sm:hidden"
        />
      )}

      <div className="fixed bottom-3 right-3 z-[9999] sm:bottom-5 sm:right-5 lg:bottom-6 lg:right-6">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
              <BotMark />
            </span>
            Ask about these options
          </button>
        ) : (
          <section
            className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{
              width: "clamp(320px, 38vw, 430px)",
              height: "clamp(460px, 78dvh, 660px)",
              maxWidth: "calc(100vw - 24px)",
              maxHeight: "calc(100dvh - 24px)",
            }}
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3 text-left">
                <BotAvatar />

                <div className="min-w-0">
                  <h3 className="text-left text-sm font-bold text-slate-950">
                    ShipSmart AI Agent
                  </h3>
                  <p className="mt-0.5 text-left text-xs font-medium text-slate-500">
                    Ask about price, speed, reliability, or these options.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </header>

            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
              <div className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-600">
                <span className="truncate">
                  {context.origin_zip ?? "?"} → {context.destination_zip ?? "?"}
                </span>

                {context.weight_lbs ? (
                  <>
                    <span className="shrink-0 text-slate-400">·</span>
                    <span className="shrink-0">{context.weight_lbs} lbs</span>
                  </>
                ) : null}

                <span className="shrink-0 text-slate-400">·</span>
                <span className="shrink-0">
                  <PriorityLabel priority={selectedPriority} />
                </span>
              </div>
            </div>

            <div className="shipsmart-chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-2xl bg-blue-50/70 p-4">
                  <div className="text-sm font-bold text-slate-950">
                    Need help choosing?
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Ask about the options on this page. I’ll keep it focused on
                    price, speed, and reliability.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {starterSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendQuestion(suggestion)}
                        disabled={ask.isPending}
                        className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-60"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="ml-auto flex max-w-[82%] flex-col items-end gap-1">
                      {message.replyTo && (
                        <div className="max-w-full truncate rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                          ↩ replying to {message.replyTo.role === "assistant" ? "advisor" : "you"}:{" "}
                          {message.replyTo.snippet}
                        </div>
                      )}
                      <div className="rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm">
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                      <ReplyButton onClick={() => setReplyTarget(message)} />
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="flex items-start gap-2">
                    <BotAvatar />

                    <div className="mr-auto flex max-w-[84%] flex-col items-start gap-1">
                      <div className="rounded-2xl rounded-tl-md bg-slate-50 px-3.5 py-3 text-sm text-slate-800">
                        <AssistantAnswer
                          text={message.content}
                          options={safeOptions}
                          question={message.question}
                        />
                        <SourceDisclosure sources={message.sources} />
                      </div>
                      <ReplyButton onClick={() => setReplyTarget(message)} />
                    </div>
                  </div>
                );
              })}

              {ask.isPending && <TypingBubble />}

              {shouldShowFollowUps && (
                <div className="ml-10 flex flex-wrap gap-2">
                  {dynamicFollowUps.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendQuestion(suggestion)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {friendlyError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <div className="font-semibold">{friendlyError.title}</div>
                  <div>{friendlyError.message}</div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-100 p-3">
              {replyTarget && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <div className="min-w-0 text-xs text-slate-600">
                    <span className="font-semibold text-slate-500">
                      Replying to {replyTarget.role === "assistant" ? "advisor" : "you"}:
                    </span>{" "}
                    <span className="text-slate-500">{replySnippet(replyTarget.content)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    aria-label="Cancel reply"
                    className="shrink-0 text-lg leading-none text-slate-400 transition hover:text-slate-700"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={ADVISOR_MAX_QUESTION_LENGTH}
                  rows={1}
                  placeholder="Ask about these shipping options..."
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200"
                >
                  ➤
                </button>
              </div>

              {overLimit && (
                <div className="mt-1 text-xs font-medium text-red-500">
                  Question is too long.
                </div>
              )}
            </form>
          </section>
        )}
      </div>
    </>
  );

  return createPortal(chatWidget, document.body);
}
