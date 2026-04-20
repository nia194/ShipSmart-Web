/**
 * Shared fetch wrapper.
 *
 * - Mints X-Request-Id and W3C traceparent per request so all three services
 *   (Web → API/Java → MCP) log the same correlation IDs.
 * - Attaches Supabase bearer JWT if available.
 * - Optionally attaches Idempotency-Key for write endpoints that require it.
 * - Parses RFC 7807 ProblemDetail responses from the Java orchestrator and
 *   also tolerates the older `{message}` shape.
 */
import { supabase } from "@/integrations/supabase/client";

export interface HttpOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  idempotent?: boolean;
  skipAuth?: boolean;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  traceId?: string;
  errors?: Array<{ field: string; message: string }>;
  message?: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;
  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail || problem.title || problem.message || `HTTP ${status}`);
    this.status = status;
    this.problem = problem;
  }
}

const randomHex = (bytes: number): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

const newTraceparent = () => `00-${randomHex(16)}-${randomHex(8)}-01`;

async function bearer(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

export async function http<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const { idempotent, skipAuth, headers = {}, ...init } = options;

  const merged: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": crypto.randomUUID(),
    traceparent: newTraceparent(),
    ...headers,
  };

  if (idempotent && !merged["Idempotency-Key"]) {
    merged["Idempotency-Key"] = crypto.randomUUID();
  }

  if (!skipAuth) {
    const token = await bearer();
    if (token) merged["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers: merged });

  if (!res.ok) {
    let problem: ProblemDetail = { status: res.status };
    try {
      problem = { ...(await res.json()), status: res.status };
    } catch {
      /* non-JSON body */
    }
    throw new HttpError(res.status, problem);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
