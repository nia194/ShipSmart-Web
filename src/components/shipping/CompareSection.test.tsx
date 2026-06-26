import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CompareSection } from "./CompareSection";
import * as api from "./compare.api";
import type { CompareOption, CompareResponse, Scenario } from "./compare.types";

vi.mock("./compare.api", () => ({ postCompare: vi.fn() }));
const postCompare = vi.mocked(api.postCompare);

const OPTIONS: CompareOption[] = [
  {
    id: "ups-ground", carrier: "UPS", service_name: "UPS Ground", carrier_type: "public",
    price_usd: 10, arrival_date: "2026-06-10", arrival_label: "Wed, Jun 10",
    transit_days: 5, guaranteed: false,
  },
  {
    id: "fedex-2day", carrier: "FedEx", service_name: "FedEx 2Day", carrier_type: "private",
    price_usd: 25, arrival_date: "2026-06-07", arrival_label: "Sun, Jun 7",
    transit_days: 2, guaranteed: true,
  },
];

function scenario(): Scenario {
  return {
    winner_id: "ups-ground",
    option_insights: [
      {
        option_id: "ups-ground", role_label: "Budget pick", strength: "Cheapest at $10.00.",
        consideration: "Slower transit.", choose_when: "When cost matters.", skip_when: "",
      },
      {
        option_id: "fedex-2day", role_label: "Fastest", strength: "Arrives Sunday.",
        consideration: "Costs more.", choose_when: "When speed matters.", skip_when: "",
      },
    ],
    comparison_dimensions: [
      {
        dimension: "Price",
        values: { "ups-ground": "$10.00", "fedex-2day": "$25.00" },
        winner_id: "ups-ground",
        note: "",
      },
    ],
  };
}

const RESPONSE: CompareResponse = {
  shipment_summary: "ceramic mugs · 90210 → 10001 · by 2026-06-09",
  scenarios: { ontime: scenario(), damage: scenario(), price: scenario(), speed: scenario() },
};

const SHIPMENT = {
  item_description: "ceramic mugs", origin_zip: "90210", destination_zip: "10001",
  deadline_date: "2026-06-09", weight_lb: 4,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CompareSection", () => {
  it("renders the comparison grid once the compare data resolves", async () => {
    postCompare.mockResolvedValue(RESPONSE);

    render(
      <CompareSection shipment={SHIPMENT} allOptions={OPTIONS} selectedPriority="ontime" />,
    );

    expect(await screen.findByText(/ceramic mugs/)).toBeTruthy();   // shipment summary strip
    expect(screen.getByText((content) => content.includes("Budget pick"))).toBeTruthy(); // per-option insight role
    expect(screen.getByText((content) => content.includes("Compare Service Options"))).toBeTruthy();    // anchor dimension row
    // The component auto-selected its two default options and asked the backend once.
    expect(postCompare).toHaveBeenCalledTimes(1);
  });

  it("shows the section while the comparison is still loading", () => {
    postCompare.mockReturnValue(new Promise<CompareResponse>(() => {})); // never resolves

    render(
      <CompareSection shipment={SHIPMENT} allOptions={OPTIONS} selectedPriority="ontime" />,
    );

    expect(screen.getByText("Compare Service Options")).toBeTruthy();
  });
});
