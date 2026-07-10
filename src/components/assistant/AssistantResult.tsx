/**
 * Typed renderer for the structured assistant contract (Product Roadmap §6 / P0).
 *
 * The frontend renders TYPES, not prose. When the backend emits an
 * `AssistantResponse` (ASSISTANT_CONTRACT_V1), this component renders one card per
 * result type — replacing the regex prose-sectioning anti-pattern (parseAssistantSections).
 * A price is always rendered from the backend's `quote_id`-backed number; the model
 * never authors a figure the UI shows.
 */
import type {
  AssistantResponse,
  AssistantResult,
  ComparisonResult,
  MissingInfoResult,
  PolicyAnswerResult,
  ShippingOptionResult,
  ToolCallTrace,
} from "@/lib/typed-outputs";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function ShippingOptionCard({ result }: { result: ShippingOptionResult }) {
  return (
    <div data-testid="result-shipping-option" className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {result.carrier} {result.service_name}
        </span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{result.label}</span>
      </div>
      <div className="mt-1 text-sm">
        <span className="font-semibold">{money(result.price_usd)}</span>
        {" · "}
        {result.transit_days} day{result.transit_days === 1 ? "" : "s"}
        {result.estimated_delivery_date ? ` · by ${result.estimated_delivery_date}` : ""}
      </div>
      {result.reason ? <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p> : null}
      {result.badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.badges.map((b) => (
            <span key={b} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
              {b}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonCard({ result }: { result: ComparisonResult }) {
  return (
    <div data-testid="result-comparison" className="rounded-lg border p-3">
      {result.summary ? <p className="text-sm">{result.summary}</p> : null}
      <ul className="mt-1 list-disc pl-5 text-sm">
        {result.options.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
    </div>
  );
}

function MissingInfoCard({ result }: { result: MissingInfoResult }) {
  return (
    <div data-testid="result-missing-info" className="rounded-lg border p-3 text-sm">
      {result.next_question ? <p className="font-medium">{result.next_question}</p> : null}
      {result.missing_fields.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Still need: {result.missing_fields.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function PolicyAnswerCard({ result }: { result: PolicyAnswerResult }) {
  return (
    <div data-testid="result-policy-answer" className="rounded-lg border p-3 text-sm">
      <p>{result.answer}</p>
      {result.sources.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Sources: {result.sources.map((s) => s.source).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function ResultCard({ result }: { result: AssistantResult }) {
  switch (result.type) {
    case "shipping_option":
      return <ShippingOptionCard result={result} />;
    case "comparison":
      return <ComparisonCard result={result} />;
    case "missing_info":
      return <MissingInfoCard result={result} />;
    case "policy_answer":
      return <PolicyAnswerCard result={result} />;
    default:
      return null;
  }
}

function ToolChips({ calls }: { calls: ToolCallTrace[] }) {
  return (
    <div data-testid="tool-chips" className="mt-2 flex flex-wrap gap-1">
      {calls.map((c, i) => (
        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
          {c.name} {c.status === "ok" ? "✓" : c.status}
        </span>
      ))}
    </div>
  );
}

export function AssistantResultView({ response }: { response: AssistantResponse }) {
  return (
    <div data-testid="assistant-result">
      {response.message ? <p className="text-sm">{response.message}</p> : null}
      {response.result ? (
        <div className="mt-2">
          <ResultCard result={response.result} />
        </div>
      ) : null}
      {response.tool_calls.length > 0 ? <ToolChips calls={response.tool_calls} /> : null}
    </div>
  );
}

export default AssistantResultView;
