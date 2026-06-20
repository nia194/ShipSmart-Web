import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkflowPage from "@/pages/WorkflowPage";
import * as api from "@/lib/workflow-api";
import type { WorkflowResponse } from "@/lib/workflow-api";

// Keep the pure helpers (verdictLabel, friendlyWorkflowError) real; mock the network.
vi.mock("@/lib/workflow-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workflow-api")>();
  return {
    ...actual,
    postWorkflowProcess: vi.fn(),
    postWorkflowReview: vi.fn(),
    getWorkflow: vi.fn(),
  };
});

const postProcess = vi.mocked(api.postWorkflowProcess);
const postReview = vi.mocked(api.postWorkflowReview);

afterEach(cleanup);

function makeState(overrides: Partial<WorkflowResponse> = {}): WorkflowResponse {
  return {
    workflow_id: "wf-test-123456",
    status: "awaiting_review",
    hs_code: "8806",
    hs_title: "Unmanned aircraft",
    hs_candidates: [],
    landed_cost: null,
    carrier_quotes: [],
    recommended_carrier: null,
    compliance: {
      verdict: "action_required", summary: "…",
      flagged_areas: [], unverified_areas: ["lithium_battery"],
      critique_rounds: 0, provider: "echo",
    },
    documents: [],
    pending_review_areas: ["lithium_battery"],
    officer_determination: "",
    officer_note: "",
    decisions: ["workflow:start", "workflow:interrupt:human_review"],
    ...overrides,
  };
}

function renderPage(): ReactElement {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}><WorkflowPage /></QueryClientProvider>;
}

describe("WorkflowPage", () => {
  it("submits the shipment and shows a suspended result with the review panel", async () => {
    postProcess.mockResolvedValue(makeState());
    render(renderPage());

    fireEvent.click(screen.getByRole("button", { name: /run workflow/i }));

    expect(await screen.findByText(/awaiting review/i)).toBeInTheDocument();
    expect(screen.getByText(/human review needed/i)).toBeInTheDocument();
    // "lithium_battery" appears in both the compliance line and the review panel.
    expect(screen.getAllByText(/lithium_battery/i).length).toBeGreaterThan(0);
    expect(postProcess).toHaveBeenCalledTimes(1);
  });

  it("resumes to completed when the officer clears the review", async () => {
    postProcess.mockResolvedValue(makeState());
    postReview.mockResolvedValue(
      makeState({
        status: "completed",
        officer_determination: "cleared",
        documents: [{ doc_type: "packing_list", title: "Packing List", fields: {} }],
        pending_review_areas: [],
        decisions: ["workflow:start", "workflow:resume", "workflow:complete"],
      }),
    );
    render(renderPage());

    fireEvent.click(screen.getByRole("button", { name: /run workflow/i }));
    fireEvent.click(await screen.findByRole("button", { name: /clear & continue/i }));

    expect(await screen.findByText(/completed/i)).toBeInTheDocument();
    expect(postReview).toHaveBeenCalledWith("wf-test-123456", {
      determination: "cleared",
      note: "",
    });
  });
});
