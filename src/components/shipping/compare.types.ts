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

export interface OptionInsight {
  option_id: string;
  role_label: string;   // "Best for urgency", "Budget pick", etc.
  strength: string;
  consideration: string;
  choose_when: string;
  skip_when: string;
}

export interface ComparisonDimension {
  dimension: string;
  values: Record<string, string>;
  winner_id: string;
  note: string;
}

export interface Scenario {
  winner_id: string;
  option_insights: OptionInsight[];
  comparison_dimensions: ComparisonDimension[];
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
