import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mutable auth state shared with the hoisted mock below.
const authState = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("@/config/api", () => ({
  apiConfig: { useJavaSavedOptions: true },
  javaApi: { savedOptions: () => "http://java/api/v1/saved-options" },
}));

const httpMock = vi.fn();
vi.mock("@/lib/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
  HttpError: class HttpError extends Error {},
}));

import { buildSnapshotKey, useSavedOptions } from "@/hooks/useSavedOptions";

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
});
afterEach(() => vi.clearAllMocks());

describe("buildSnapshotKey", () => {
  it("builds a stable composite key from the quote snapshot fields", () => {
    expect(buildSnapshotKey("svc-1", "10001", "90210", "2026-06-01", "2026-06-07")).toBe(
      "svc-1|10001|90210|2026-06-01|2026-06-07",
    );
  });
});

describe("useSavedOptions", () => {
  it("clears saved options and never calls the backend when signed out", async () => {
    const { result } = renderHook(() => useSavedOptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.savedOptions).toEqual([]);
    expect(result.current.savedIds.size).toBe(0);
    expect(httpMock).not.toHaveBeenCalled();
  });

  it("hydrates saved options from the Java API when signed in", async () => {
    authState.user = { id: "u1" };
    httpMock.mockResolvedValue([
      { id: "x", svcId: "s", origin: "A", dest: "B", dropDate: "d", delivDate: "e" },
    ]);

    const { result } = renderHook(() => useSavedOptions());
    await waitFor(() => expect(result.current.savedOptions.length).toBe(1));
    expect(httpMock).toHaveBeenCalledWith("http://java/api/v1/saved-options");
  });
});
