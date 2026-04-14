import { RecommendationCard } from "@/components/advisor/RecommendationCard";
import { SharedUI } from "@/components/shipping/SharedUI";
import {
  ShippingAdvisorResponse,
  TrackingAdvisorResponse,
  advisorService,
} from "@/lib/advisor-api";
import React, { useState } from "react";

type AdvisorTab = "shipping" | "tracking";

export const AdvisorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdvisorTab>("shipping");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingResponse, setShippingResponse] = useState<ShippingAdvisorResponse | null>(null);
  const [trackingResponse, setTrackingResponse] = useState<TrackingAdvisorResponse | null>(null);

  const handleShippingAdvice = async () => {
    if (!query.trim()) {
      setError("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await advisorService.getShippingAdvice({
        query,
      });
      setShippingResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Advisor service is currently unavailable. Please try again later.");
      } else {
        setError(msg || "Failed to get shipping advice. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTrackingGuidance = async () => {
    if (!query.trim()) {
      setError("Please enter your issue");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await advisorService.getTrackingGuidance({
        issue: query,
      });
      setTrackingResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Advisor service is currently unavailable. Please try again later.");
      } else {
        setError(msg || "Failed to get tracking guidance. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = () => {
    if (activeTab === "shipping") {
      handleShippingAdvice();
    } else {
      handleTrackingGuidance();
    }
  };

  return (
    <SharedUI>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">ShipSmart Advisor</h1>
        <p className="text-gray-600 mb-6">
          Get AI-powered advice on shipping and delivery questions.
        </p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "shipping"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => {
              setActiveTab("shipping");
              setShippingResponse(null);
              setTrackingResponse(null);
              setQuery("");
              setError(null);
            }}
          >
            Shipping Advisor
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "tracking"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => {
              setActiveTab("tracking");
              setShippingResponse(null);
              setTrackingResponse(null);
              setQuery("");
              setError(null);
            }}
          >
            Tracking Guidance
          </button>
        </div>

        {/* Input Section */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {activeTab === "shipping" ? "Your shipping question" : "Describe your issue"}
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder={
              activeTab === "shipping"
                ? "e.g., What shipping options are available for a 5 lb package from NY to CA?"
                : "e.g., What should I do if my package is delayed?"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400"
            onClick={handleAsk}
            disabled={loading}
          >
            {loading ? "Getting advice..." : "Ask Advisor"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-800">
            {error}
          </div>
        )}

        {/* Shipping Advisor Response */}
        {activeTab === "shipping" && shippingResponse && (
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Advice</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{shippingResponse.answer}</p>
            </div>

            {shippingResponse.sources.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-bold mb-3">Sources</h3>
                <ul className="space-y-2">
                  {shippingResponse.sources.map((source, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      • {source.source} (relevance: {(source.score * 100).toFixed(0)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {shippingResponse.tools_used.length > 0 && (
              <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
                Tools used: {shippingResponse.tools_used.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Tracking Advisor Response */}
        {activeTab === "tracking" && trackingResponse && (
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-2">Guidance</h2>
              <p className="text-sm text-gray-600 mb-4">{trackingResponse.issue_summary}</p>
              <p className="text-gray-700 whitespace-pre-wrap">{trackingResponse.guidance}</p>
            </div>

            {trackingResponse.next_steps.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-3 text-blue-900">Next Steps</h3>
                <ol className="space-y-2">
                  {trackingResponse.next_steps.map((step, idx) => (
                    <li key={idx} className="text-blue-900">
                      <span className="font-medium">{idx + 1}.</span> {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {trackingResponse.sources.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-bold mb-3">Sources</h3>
                <ul className="space-y-2">
                  {trackingResponse.sources.map((source, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      • {source.source} (relevance: {(source.score * 100).toFixed(0)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </SharedUI>
  );
};

export default AdvisorPage;
