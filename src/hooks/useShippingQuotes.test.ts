import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

// Force the Java backend path (the toggle under test).
vi.mock("@/config/api", () => ({
  apiConfig: { useJavaQuotes: true },
  javaApi: { quotes: () => "http://java/api/v1/quotes" },
}));

import { useShippingQuotes } from "@/hooks/useShippingQuotes";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("useShippingQuotes (Java path)", () => {
  it("POSTs to the Java quotes endpoint and stores the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ services: [{ id: "s1" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShippingQuotes());
    await act(async () => {
      await result.current.fetchQuotes("10001", "90210", "2026-06-01", "2026-06-07", []);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://java/api/v1/quotes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.data).toEqual({ services: [{ id: "s1" }] });
    expect(result.current.loading).toBe(false);
    expect(invoke).not.toHaveBeenCalled(); // legacy Supabase path untouched
  });

  it("surfaces a destructive toast and leaves data null on a failed fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({ error: "boom" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShippingQuotes());
    await act(async () => {
      await result.current.fetchQuotes("10001", "90210", "2026-06-01", "2026-06-07", []);
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
