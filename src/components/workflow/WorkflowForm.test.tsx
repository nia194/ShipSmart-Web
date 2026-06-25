import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Domestic-only deployment: the form must hide the country fields and pin both
// ends to the home country. Keep the rest of the real config (base URLs, etc.).
vi.mock("@/config/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/api")>();
  return {
    ...actual,
    apiConfig: { ...actual.apiConfig, shippingScope: "domestic", domesticCountry: "US" },
    isDomesticOnly: true,
  };
});

import { WorkflowForm } from "@/components/workflow/WorkflowForm";

afterEach(cleanup);

describe("WorkflowForm (domestic scope)", () => {
  it("hides the country fields and submits the home country for both ends", () => {
    const onSubmit = vi.fn();
    render(<WorkflowForm onSubmit={onSubmit} />);

    // No cross-border inputs in domestic mode; a domestic-only note is shown instead.
    expect(screen.queryByLabelText(/origin/i)).toBeNull();
    expect(screen.queryByLabelText(/destination/i)).toBeNull();
    expect(screen.getByText(/within/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run workflow/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0][0];
    expect(body.origin_country).toBe("US");
    expect(body.destination_country).toBe("US");
  });
});
