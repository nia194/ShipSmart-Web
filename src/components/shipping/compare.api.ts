/**
 * API client for the compare endpoint.
 */

import { apiConfig } from "@/config/api";
import { CompareRequest, CompareResponse } from "./compare.types";

export async function postCompare(request: CompareRequest): Promise<CompareResponse> {
  const url = `${apiConfig.pythonApiBaseUrl}/api/v1/compare`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Compare API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
