import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type CompareRequest,
  type CompareResponse,
  type Priority,
  type CompareOption,
  type ComparisonDimension,
  type OptionInsight,
} from "./compare.types";
import { postCompare } from "./compare.api";
import { Logo } from "./Logo";

const MAX_OPTIONS = 3;

interface CompareSectionProps {
  shipment: {
    item_description: string;
    origin_zip: string;
    destination_zip: string;
    deadline_date: string;
    weight_lb: number;
  };
  allOptions: CompareOption[];
  selectedPriority: Priority;
}

type CompareState = {
  optionIds: string[];
  data: CompareResponse | null;
  isLoading: boolean;
  error: string | null;
};

const PRIORITY_LABELS: Record<Priority, string> = {
  ontime: "on-time delivery",
  damage: "safer handling",
  price: "lowest price",
  speed: "fastest arrival",
};

const BASE_ROWS = [
  "Price",
  "Speed",
  "Reliability",
  "Insurance",
  "Tracking",
  "Handling",
];

function cleanName(carrier: string, serviceName: string): string {
  if (serviceName.startsWith(`${carrier} `)) {
    return serviceName.slice(carrier.length + 1);
  }

  return serviceName;
}

function displayName(carrier: string, serviceName: string): string {
  return `${carrier} ${cleanName(carrier, serviceName)}`;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function compareByPriority(priority: Priority) {
  return (a: CompareOption, b: CompareOption) => {
    if (priority === "price") {
      return a.price_usd - b.price_usd || a.transit_days - b.transit_days;
    }

    if (priority === "speed") {
      return a.transit_days - b.transit_days || a.price_usd - b.price_usd;
    }

    if (priority === "ontime") {
      if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
      return a.transit_days - b.transit_days || a.price_usd - b.price_usd;
    }

    if (priority === "damage") {
      if (a.guaranteed !== b.guaranteed) return a.guaranteed ? -1 : 1;
      return a.price_usd - b.price_usd || a.transit_days - b.transit_days;
    }

    return a.price_usd - b.price_usd;
  };
}

function selectDefaultOptions(
  allOptions: CompareOption[],
  priority: Priority,
): string[] {
  if (allOptions.length <= MAX_OPTIONS) {
    return allOptions.map((option) => option.id);
  }

  const selected: string[] = [];

  const bestForPriority = [...allOptions].sort(compareByPriority(priority))[0];
  const cheapest = [...allOptions].sort(
    (a, b) => a.price_usd - b.price_usd || a.transit_days - b.transit_days,
  )[0];
  const fastest = [...allOptions].sort(
    (a, b) => a.transit_days - b.transit_days || a.price_usd - b.price_usd,
  )[0];

  [bestForPriority, cheapest, fastest].forEach((option) => {
    if (option && !selected.includes(option.id)) {
      selected.push(option.id);
    }
  });

  for (const option of [...allOptions].sort(compareByPriority(priority))) {
    if (selected.length >= MAX_OPTIONS) break;

    if (!selected.includes(option.id)) {
      selected.push(option.id);
    }
  }

  return selected.slice(0, MAX_OPTIONS);
}

function getInsightPrimary(
  insight: OptionInsight | undefined,
  option: CompareOption,
) {
  if (insight?.choose_when) return insight.choose_when;
  if (insight?.strength) return insight.strength;

  if (option.guaranteed) {
    return "Good fit when delivery certainty matters more than absolute lowest cost.";
  }

  return "Good fit when your delivery window is flexible and price matters.";
}

function getInsightTradeoff(
  insight: OptionInsight | undefined,
  option: CompareOption,
) {
  if (insight?.consideration) return insight.consideration;
  if (insight?.skip_when) return insight.skip_when;

  if (option.guaranteed) {
    return "Usually costs more than slower standard options.";
  }

  return "May be less predictable than guaranteed carrier services.";
}

function getFallbackRole(
  option: CompareOption,
  index: number,
  selectedOptions: CompareOption[],
  priority: Priority,
) {
  const cheapestId = [...selectedOptions].sort(
    (a, b) => a.price_usd - b.price_usd,
  )[0]?.id;

  const fastestId = [...selectedOptions].sort(
    (a, b) => a.transit_days - b.transit_days,
  )[0]?.id;

  if (index === 0) return `Best match for ${PRIORITY_LABELS[priority]}`;
  if (option.id === cheapestId) return "Lowest price";
  if (option.id === fastestId) return "Fastest arrival";
  if (option.guaranteed) return "Guaranteed option";

  return "Flexible option";
}

function findDimension(
  dimensions: ComparisonDimension[],
  dimensionName: string,
): ComparisonDimension | undefined {
  return dimensions.find(
    (dimension) =>
      dimension.dimension.toLowerCase() === dimensionName.toLowerCase(),
  );
}

function getFallbackValue(row: string, option: CompareOption): string {
  if (row === "Price") return formatMoney(option.price_usd);
  if (row === "Speed") return formatDays(option.transit_days);
  if (row === "Reliability") return option.guaranteed ? "Guaranteed" : "Estimated";
  if (row === "Insurance") return "Shown during booking";
  if (row === "Tracking") return "Carrier tracking";
  if (row === "Handling") {
    return option.guaranteed
      ? "Standard carrier handling"
      : "Standard handling";
  }

  return "—";
}

function getFallbackWinner(
  row: string,
  options: CompareOption[],
): string | null {
  if (options.length === 0) return null;

  if (row === "Price") {
    return [...options].sort((a, b) => a.price_usd - b.price_usd)[0].id;
  }

  if (row === "Speed") {
    return [...options].sort((a, b) => a.transit_days - b.transit_days)[0].id;
  }

  if (row === "Reliability") {
    return options.find((option) => option.guaranteed)?.id ?? null;
  }

  return null;
}

function LoadingState() {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: "#fff",
        padding: 16,
        marginTop: 10,
      }}
    >
      <div
        style={{
          height: 14,
          width: 180,
          borderRadius: 999,
          background: "#f1f5f9",
          marginBottom: 14,
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            style={{
              height: 120,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #eef2f7",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  option,
  index,
  selectedOptions,
  insight,
  priority,
  canRemove,
  onRemove,
}: {
  option: CompareOption;
  index: number;
  selectedOptions: CompareOption[];
  insight: OptionInsight | undefined;
  priority: Priority;
  canRemove: boolean;
  onRemove: (id: string) => void;
}) {
  const role =
    insight?.role_label ??
    getFallbackRole(option, index, selectedOptions, priority);

  const primary = getInsightPrimary(insight, option);
  const tradeoff = getInsightTradeoff(insight, option);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        border: index === 0 ? "1.5px solid #bfdbfe" : "1px solid #e5e7eb",
        background: index === 0 ? "#f8fbff" : "#fff",
        padding: 13,
        minWidth: 0,
      }}
    >
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(option.id)}
          aria-label={`Remove ${option.carrier}`}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#94a3b8",
            cursor: "pointer",
            fontWeight: 800,
            lineHeight: "18px",
          }}
        >
          ×
        </button>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingRight: 24,
        }}
      >
        <Logo name={option.carrier} sz={32} />

        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 850,
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
            title={displayName(option.carrier, option.service_name)}
          >
            {displayName(option.carrier, option.service_name)}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 650,
              color: "#94a3b8",
              marginTop: 2,
              textAlign: "left",
            }}
          >
            {formatDays(option.transit_days)} ·{" "}
            {option.guaranteed ? "Guaranteed" : "Estimated"}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 950,
            color: "#0f172a",
            letterSpacing: "-.4px",
          }}
        >
          {formatMoney(option.price_usd)}
        </div>

        {index === 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 850,
              color: "#1d4ed8",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              padding: "3px 7px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            Best match
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTop: "1px solid #eef2f7",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: "#7c3aed",
            textTransform: "uppercase",
            letterSpacing: ".7px",
            marginBottom: 5,
          }}
        >
          AI tradeoff summary
        </div>

        <div
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.35,
            marginBottom: 5,
          }}
        >
          {role}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            lineHeight: 1.45,
          }}
        >
          {primary}
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: "#64748b",
            lineHeight: 1.45,
          }}
        >
          Tradeoff: {tradeoff}
        </div>
      </div>
    </div>
  );
}

function AddOptionCard({
  remainingOptions,
  onAdd,
}: {
  remainingOptions: CompareOption[];
  onAdd: (id: string) => void;
}) {
  if (remainingOptions.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px dashed #cbd5e1",
        background: "#f8fafc",
        padding: 13,
        minHeight: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            style={{
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 850,
              cursor: "pointer",
            }}
          >
            + Add carrier
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" style={{ width: 280, padding: 8 }}>
          {remainingOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onAdd(option.id)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
                padding: "9px 10px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 650,
                color: "#334155",
              }}
            >
              {displayName(option.carrier, option.service_name)}
              <span
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {formatMoney(option.price_usd)} ·{" "}
                {formatDays(option.transit_days)}
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ComparisonRows({
  dimensions,
  options,
}: {
  dimensions: ComparisonDimension[];
  options: CompareOption[];
}) {
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${options.length}, minmax(0, 1fr))`,
          background: "#f8fafc",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            fontSize: 10.5,
            fontWeight: 900,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: ".7px",
          }}
        >
          Detail
        </div>

        {options.map((option) => (
          <div
            key={option.id}
            style={{
              padding: "10px 12px",
              fontSize: 10.5,
              fontWeight: 900,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: ".7px",
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {option.carrier}
          </div>
        ))}
      </div>

      {BASE_ROWS.map((row) => {
        const dimension = findDimension(dimensions, row);
        const winnerId = dimension?.winner_id ?? getFallbackWinner(row, options);

        return (
          <div
            key={row}
            style={{
              display: "grid",
              gridTemplateColumns: `140px repeat(${options.length}, minmax(0, 1fr))`,
              borderBottom:
                row === BASE_ROWS[BASE_ROWS.length - 1]
                  ? "none"
                  : "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 850,
                color: "#334155",
                background: "#fcfcfd",
              }}
            >
              {row}
            </div>

            {options.map((option) => {
              const value =
                dimension?.values?.[option.id] ?? getFallbackValue(row, option);
              const isWinner = winnerId === option.id;

              return (
                <div
                  key={option.id}
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: isWinner ? 850 : 650,
                    color: isWinner ? "#0f172a" : "#475569",
                    background: isWinner ? "#f0fdf4" : "#fff",
                    borderLeft: "1px solid #f8fafc",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={value}
                >
                  {value}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const CompareSection: React.FC<CompareSectionProps> = ({
  shipment,
  allOptions,
  selectedPriority,
}) => {
  const [state, setState] = useState<CompareState>(() => ({
    optionIds: selectDefaultOptions(allOptions, selectedPriority),
    data: null,
    isLoading: true,
    error: null,
  }));

  const optionKey = useMemo(
    () =>
      allOptions
        .map(
          (option) =>
            `${option.id}:${option.price_usd}:${option.transit_days}:${option.guaranteed}`,
        )
        .sort()
        .join("|"),
    [allOptions],
  );

  const shipmentForRequest = useMemo(
    () => ({
      item_description: shipment.item_description,
      origin_zip: shipment.origin_zip,
      destination_zip: shipment.destination_zip,
      deadline_date: shipment.deadline_date,
      weight_lb: shipment.weight_lb,
    }),
    [
      shipment.item_description,
      shipment.origin_zip,
      shipment.destination_zip,
      shipment.deadline_date,
      shipment.weight_lb,
    ],
  );

const resetKeyRef = useRef(`${optionKey}|${selectedPriority}`);

useEffect(() => {
  const nextResetKey = `${optionKey}|${selectedPriority}`;

  if (resetKeyRef.current === nextResetKey) {
    return;
  }

  resetKeyRef.current = nextResetKey;

  setState({
    optionIds: selectDefaultOptions(allOptions, selectedPriority),
    data: null,
    isLoading: true,
    error: null,
  });
}, [optionKey, selectedPriority, allOptions]);

  useEffect(() => {
    const selectedOptions = state.optionIds
      .map((id) => allOptions.find((option) => option.id === id))
      .filter((option): option is CompareOption => Boolean(option));

    if (selectedOptions.length < 2) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Need at least two options to compare.",
      }));
      return;
    }

    let cancelled = false;

    const fetchCompare = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const request: CompareRequest = {
          shipment: shipmentForRequest,
          option_ids: selectedOptions.map((option) => option.id),
          options: selectedOptions,
          selected_priority: selectedPriority,
        };

        const response = await postCompare(request);

        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            data: response,
            isLoading: false,
            error: null,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "AI comparison is unavailable right now.";

          setState((prev) => ({
            ...prev,
            data: null,
            isLoading: false,
            error: message,
          }));
        }
      }
    };

    fetchCompare();

    return () => {
      cancelled = true;
    };
  }, [state.optionIds, allOptions, shipmentForRequest, selectedPriority]);

  const handleRemoveOption = useCallback((optionId: string) => {
    setState((prev) => {
      if (prev.optionIds.length <= 2) return prev;

      return {
        ...prev,
        optionIds: prev.optionIds.filter((id) => id !== optionId),
      };
    });
  }, []);

  const handleAddOption = useCallback((optionId: string) => {
    setState((prev) => {
      if (prev.optionIds.length >= MAX_OPTIONS) return prev;
      if (prev.optionIds.includes(optionId)) return prev;

      return {
        ...prev,
        optionIds: [...prev.optionIds, optionId],
      };
    });
  }, []);

  const selectedOptions = useMemo(
    () =>
      state.optionIds
        .map((id) => allOptions.find((option) => option.id === id))
        .filter((option): option is CompareOption => Boolean(option)),
    [state.optionIds, allOptions],
  );

  const remainingOptions = useMemo(
    () => allOptions.filter((option) => !state.optionIds.includes(option.id)),
    [allOptions, state.optionIds],
  );

  const activeScenario = state.data?.scenarios?.[selectedPriority];
  const dimensions = activeScenario?.comparison_dimensions ?? [];

  const insightsById = useMemo(() => {
    const map: Record<string, OptionInsight> = {};

    activeScenario?.option_insights?.forEach((insight) => {
      map[insight.option_id] = insight;
    });

    return map;
  }, [activeScenario]);

  if (allOptions.length < 2) return null;

  const canRemove = selectedOptions.length > 2;
  const canAdd =
    selectedOptions.length < MAX_OPTIONS && remainingOptions.length > 0;

  return (
    <section
      style={{
        marginTop: 28,
        marginBottom: 28,
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: "#111827",
              letterSpacing: "-.2px",
            }}
          >
            Compare Service Options
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              fontWeight: 600,
              color: "#94a3b8",
            }}
          >
            AI summarizes tradeoffs. Carrier rates and transit times stay unchanged.
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: "#1d4ed8",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            padding: "5px 9px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          Priority: {PRIORITY_LABELS[selectedPriority]}
        </div>
      </div>

      {state.isLoading && !state.data ? (
        <LoadingState />
      ) : (
        <div
          style={{
            borderRadius: 18,
            border: "1.5px solid #e5e7eb",
            background: "#fff",
            padding: 14,
          }}
        >
          {state.data?.shipment_summary && (
            <div
              style={{
                marginBottom: 12,
                padding: "9px 11px",
                borderRadius: 11,
                background: "#f8fafc",
                border: "1px solid #eef2f7",
                color: "#64748b",
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              {state.data.shipment_summary}
            </div>
          )}

          {state.error && (
            <div
              style={{
                marginBottom: 12,
                padding: "9px 11px",
                borderRadius: 11,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              AI comparison is unavailable, so showing a simple carrier-data
              comparison.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: canAdd
                ? `repeat(${selectedOptions.length + 1}, minmax(0, 1fr))`
                : `repeat(${selectedOptions.length}, minmax(0, 1fr))`,
              gap: 10,
            }}
          >
            {selectedOptions.map((option, index) => (
              <OptionCard
                key={option.id}
                option={option}
                index={index}
                selectedOptions={selectedOptions}
                insight={insightsById[option.id]}
                priority={selectedPriority}
                canRemove={canRemove}
                onRemove={handleRemoveOption}
              />
            ))}

            {canAdd && (
              <AddOptionCard
                remainingOptions={remainingOptions}
                onAdd={handleAddOption}
              />
            )}
          </div>

          <ComparisonRows dimensions={dimensions} options={selectedOptions} />
        </div>
      )}
    </section>
  );
};