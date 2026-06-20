/**
 * Multi-agent workflow page (UC3/UC4).
 *
 * Submit a shipment → see the assembled multi-agent result. When the workflow
 * suspends for human review, an officer clears or blocks it and it resumes. A
 * "Refresh status" action demonstrates the durable GET /workflow/{id} read.
 *
 * Behind the VITE_USE_WORKFLOW flag (the route is only mounted when enabled).
 */
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { ReviewPanel } from "@/components/workflow/ReviewPanel";
import { WorkflowForm } from "@/components/workflow/WorkflowForm";
import { WorkflowResult } from "@/components/workflow/WorkflowResult";
import {
  type Determination,
  type WorkflowProcessRequest,
  type WorkflowResponse,
  friendlyWorkflowError,
  getWorkflow,
  postWorkflowProcess,
  postWorkflowReview,
} from "@/lib/workflow-api";

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const process = useMutation({
    mutationFn: postWorkflowProcess,
    onSuccess: (s) => { setState(s); setError(null); },
    onError: (e) => setError(friendlyWorkflowError(e).message),
  });

  const review = useMutation({
    mutationFn: ({ id, determination, note }: { id: string; determination: Determination; note: string }) =>
      postWorkflowReview(id, { determination, note }),
    onSuccess: (s) => { setState(s); setError(null); },
    onError: (e) => setError(friendlyWorkflowError(e).message),
  });

  const refresh = useMutation({
    mutationFn: (id: string) => getWorkflow(id),
    onSuccess: (s) => { setState(s); setError(null); },
    onError: (e) => setError(friendlyWorkflowError(e).message),
  });

  const onSubmit = (body: WorkflowProcessRequest) => process.mutate(body);
  const onReview = (determination: Determination, note: string) => {
    if (state) review.mutate({ id: state.workflow_id, determination, note });
  };

  const busy = process.isPending || review.isPending || refresh.isPending;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px", display: "grid", gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Shipment workflow</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          Classify → landed cost &amp; routing → compliance → documents. High-risk shipments that
          can't be auto-verified pause for human review.
        </p>
      </header>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
        <WorkflowForm onSubmit={onSubmit} busy={busy} />
      </section>

      {error && (
        <div style={{
          border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b",
          borderRadius: 10, padding: "10px 12px", fontSize: 13,
        }}>{error}</div>
      )}

      {state && (
        <section style={{ display: "grid", gap: 12 }}>
          <WorkflowResult state={state} />
          {state.status === "awaiting_review" && (
            <>
              <ReviewPanel
                pendingAreas={state.pending_review_areas}
                onReview={onReview}
                busy={busy}
              />
              <button type="button" disabled={busy} onClick={() => refresh.mutate(state.workflow_id)}
                style={{
                  justifySelf: "start", fontSize: 12, fontWeight: 600, color: "#0071e3",
                  background: "none", border: "none", cursor: busy ? "default" : "pointer", padding: 0,
                }}>
                Refresh status
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
