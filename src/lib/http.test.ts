import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase client so the bearer() lookup is deterministic.
const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

import { http } from "@/lib/http";

function res(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: null } });
});
afterEach(() => vi.unstubAllGlobals());

describe("http wrapper", () => {
  it("returns parsed JSON and stamps correlation headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await http<{ ok: number }>("http://x/api", { skipAuth: true });
    expect(out).toEqual({ ok: 1 });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Request-Id"]).toBeTruthy();
    expect(init.headers["traceparent"]).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("attaches a bearer token when a Supabase session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } });
    const fetchMock = vi.fn().mockResolvedValue(res({}));
    vi.stubGlobal("fetch", fetchMock);

    await http("http://x/api");
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer tok-1");
  });

  it("skips the auth lookup entirely when skipAuth is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({}));
    vi.stubGlobal("fetch", fetchMock);

    await http("http://x/api", { skipAuth: true });
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBeUndefined();
  });

  it("adds an Idempotency-Key for idempotent writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({}));
    vi.stubGlobal("fetch", fetchMock);

    await http("http://x/api", { method: "POST", idempotent: true, skipAuth: true });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBeTruthy();
  });

  it("throws HttpError carrying status + ProblemDetail on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      res({ title: "Not Found", detail: "missing", status: 404 }, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(http("http://x/api", { skipAuth: true })).rejects.toMatchObject({
      status: 404,
      message: "missing", // HttpError surfaces problem.detail as the message
    });
  });

  it("tolerates a non-JSON error body", async () => {
    const bad = {
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bad));

    await expect(http("http://x/api", { skipAuth: true })).rejects.toMatchObject({
      status: 500,
    });
  });

  it("returns undefined for 204 No Content", async () => {
    const noContent = { ok: true, status: 204, json: async () => ({}) } as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(noContent));

    expect(await http("http://x/api", { skipAuth: true })).toBeUndefined();
  });
});
