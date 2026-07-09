/**
 * UI-side AI trust boundary (Governance & Guardrails Control System §5.6).
 *
 * The mirror of ShipSmart-Orchestrator's AiClaimGuard, on the client: model output
 * is advisory. The product may render an AI proposal, but anything that moves money
 * or writes state — a quote/price field, a write/high-risk action — must be
 * confirmed by the user before it is applied. A price the model typed is never
 * treated as authoritative on its own; it is a suggestion pending confirmation (the
 * authoritative figure comes from the server quote the Orchestrator re-derives).
 */

import type { Action, AssistantResponse, FieldPatch, RiskTier } from "@/lib/typed-outputs";

/** Tiers whose effects touch money or write state — never auto-applied. */
const CONFIRM_TIERS: readonly RiskTier[] = ["quote", "write", "high"];

/** Field paths whose value is authoritative (money/quote) and so can't be AI-set silently. */
const AUTHORITATIVE_FIELD = /(price|total|amount|rate|cost|quote|duty|fee)/i;

export function actionRequiresConfirmation(action: Action): boolean {
  return action.requires_confirmation || CONFIRM_TIERS.includes(action.risk_tier);
}

export function patchRequiresConfirmation(patch: FieldPatch): boolean {
  if (patch.requires_confirmation) return true;
  // A patch that sets an authoritative (money/quote) field from anything other than
  // the user's own words must be confirmed — the model can propose it, not commit it.
  return patch.source !== "user_text" && AUTHORITATIVE_FIELD.test(patch.field_path);
}

/**
 * Whether the UI must gate this response behind explicit user confirmation before
 * applying any of its actions/patches. A plain read-tier answer with nothing to
 * apply does not; anything advisory that touches money/write does.
 */
export function responseNeedsConfirmation(response: AssistantResponse): boolean {
  return (
    response.requires_confirmation ||
    CONFIRM_TIERS.includes(response.risk_tier) ||
    response.actions.some(actionRequiresConfirmation) ||
    (response.form_patch?.patches ?? []).some(patchRequiresConfirmation)
  );
}
