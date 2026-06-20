import { describe, expect, it } from "vitest";

import { HttpError } from "@/lib/http";
import {
  WORKFLOW_MAX_DESCRIPTION_LENGTH,
  friendlyWorkflowError,
  verdictLabel,
} from "@/lib/workflow-api";

describe("friendlyWorkflowError", () => {
  it.each([
    [404, "not found"],
    [409, "already resolved"],
    [422, "check the details"],
    [429, "busy"],
    [503, "unavailable"],
    [401, "sign in"],
  ])("maps HTTP %i to friendly, non-technical copy", (status, needle) => {
    const friendly = friendlyWorkflowError(new HttpError(status, { status }));
    const blob = `${friendly.title} ${friendly.message}`.toLowerCase();
    expect(blob).toContain(needle);
  });

  it("falls back to a generic message for non-HttpError and unknown status", () => {
    expect(friendlyWorkflowError(new Error("boom")).title).toBe("Something went wrong");
    expect(friendlyWorkflowError(new HttpError(418, { status: 418 })).title).toBe(
      "Something went wrong",
    );
  });
});

describe("verdictLabel", () => {
  it("maps advisory verdicts to friendly labels, never 'compliant'", () => {
    expect(verdictLabel("action_required")).toBe("Action required");
    expect(verdictLabel("review_recommended")).toBe("Review recommended");
    expect(verdictLabel("advisory")).toBe("Advisory");
    expect(verdictLabel("something_new")).toBe("something_new"); // passthrough
  });
});

describe("constants", () => {
  it("mirrors the server-side description cap", () => {
    expect(WORKFLOW_MAX_DESCRIPTION_LENGTH).toBe(2000);
  });
});
