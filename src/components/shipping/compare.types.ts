/**
 * Types for the Compare Section (decision-cockpit feature)
 * Only real quote facts, no fabricated data.
 */

export type Priority = "ontime" | "damage" | "price" | "speed";

export interface Shipment {
  item_description: string;
  origin_zip: string;
  destination_zip: string;
  deadline_date: string;
  weight_lb: number;
  declared_value_usd?: number;
}

export interface CompareOption {
  id: string;
  carrier: string;
  service_name: string;
  carrier_type: "public" | "private";
  price_usd: number;
  arrival_date: string; // YYYY-MM-DD
  arrival_label: string; // "Fri, Dec 19"
  transit_days: number;
  guaranteed: boolean;
}

export interface Verdict {
  purpose: string;
  pick_name: string;
  reason: string;
  context_note: string;
  override_note: string;
}

export interface OptionInsight {
  option_id: string;
  role_label: string;   // "Best for urgency", "Budget pick", etc.
  strength: string;
  consideration: string;
  choose_when: string;
  skip_when: string;
  card_tag: string;
}

export interface ComparisonDimension {
  dimension: string;
  values: Record<string, string>;
  winner_id: string;
  note: string;
}

export interface DecisionFactors {
  primary_driver: string;
  key_tradeoff: string;
  what_would_change: string;
}

export interface Scenario {
  winner_id: string;
  verdict: Verdict;
  option_insights: OptionInsight[];
  comparison_dimensions: ComparisonDimension[];
  decision_summary: string;
  decision_factors: DecisionFactors | null;
}

export interface CompareResponse {
  shipment_summary: string;
  scenarios: Record<Priority, Scenario>;
}

export interface CompareRequest {
  shipment: Shipment;
  option_ids: string[];
  options: CompareOption[];
  selected_priority: Priority;
}
