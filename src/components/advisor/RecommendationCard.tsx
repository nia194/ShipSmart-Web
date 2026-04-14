import { ServiceOption } from "@/lib/advisor-api";
import React from "react";

interface RecommendationCardProps {
  recommendation: ServiceOption;
  isHighlighted?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  isHighlighted = false,
}) => {
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "cheapest":
        return "💰 Cheapest";
      case "fastest":
        return "⚡ Fastest";
      case "best_value":
        return "✨ Best Value";
      case "balanced":
        return "⚖️ Balanced";
      default:
        return type;
    }
  };

  return (
    <div
      className={`p-4 border-2 rounded-lg transition-colors ${
        isHighlighted
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-lg">{recommendation.service_name}</h4>
          <p className="text-xs text-gray-600">{getTypeLabel(recommendation.recommendation_type)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">${recommendation.price_usd.toFixed(2)}</p>
          <p className="text-xs text-gray-600">{recommendation.estimated_days} day(s)</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-3">{recommendation.explanation}</p>

      {isHighlighted && (
        <div className="bg-blue-100 border border-blue-300 rounded px-3 py-2 text-sm font-medium text-blue-900">
          ✓ Recommended for you
        </div>
      )}
    </div>
  );
};
