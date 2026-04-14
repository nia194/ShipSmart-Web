/**
 * CompareSection — one unified comparison component.
 *
 * Layout (single card, one grid):
 *   Row 1  · Option header per column (logo + service name + price)
 *   Row 2  · LLM-generated insight copy, directly under each column
 *   Group  · AT A GLANCE  — Price, Speed, Reliability
 *   Group  · DETAILS      — Insurance, Tracking, Handling
 *
 * Columns in the table match the option columns at the top exactly —
 * no redundant second header with logos.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CompareRequest,
  CompareResponse,
  Priority,
  CompareOption,
  ComparisonDimension,
  OptionInsight,
} from "./compare.types";
import { postCompare } from "./compare.api";
import { Logo } from "./Logo";
import styles from "./CompareSection.module.css";

const ANCHOR_DIMENSIONS = ["Price", "Speed", "Reliability"];
const SPEC_DIMENSIONS = ["Insurance", "Tracking", "Handling"];

function cleanName(carrier: string, serviceName: string): string {
  if (serviceName.startsWith(carrier + " ")) {
    return serviceName.slice(carrier.length + 1);
  }
  return serviceName;
}

function displayName(carrier: string, serviceName: string): string {
  return `${carrier} ${cleanName(carrier, serviceName)}`;
}

export interface CompareSectionProps {
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

const LoadingSkeleton: React.FC = () => (
  <div className={styles.unifiedCard} style={{ animation: "fadeUp .3s both" }}>
    <div className={styles.grid} style={{ "--col-count": 3 } as React.CSSProperties}>
      <div />
      {[1, 2, 3].map((i) => (
        <div key={i} className={styles.optionHeader}>
          <div className={styles.skeleton} style={{ width: 32, height: 32, borderRadius: 8, marginBottom: 10 }} />
          <div className={styles.skeleton} style={{ width: "80%", height: 12, marginBottom: 8 }} />
          <div className={styles.skeleton} style={{ width: "55%", height: 22 }} />
        </div>
      ))}
      <div />
      {[1, 2, 3].map((i) => (
        <div key={i} className={styles.insightCell}>
          <div className={styles.skeleton} style={{ width: "100%", height: 10, marginBottom: 6 }} />
          <div className={styles.skeleton} style={{ width: "88%", height: 10, marginBottom: 6 }} />
          <div className={styles.skeleton} style={{ width: "72%", height: 10 }} />
        </div>
      ))}
    </div>
  </div>
);

export const CompareSection: React.FC<CompareSectionProps> = ({
  shipment,
  allOptions,
  selectedPriority,
}) => {
  const [state, setState] = useState<CompareState>(() => {
    const initialIds = selectDefaultOptions(allOptions);
    return { optionIds: initialIds, data: null, isLoading: true, error: null };
  });

  const allOptionKey = useMemo(
    () => allOptions.map((o) => o.id).sort().join(","),
    [allOptions]
  );

  const prevOptionKeyRef = React.useRef(allOptionKey);
  useEffect(() => {
    if (prevOptionKeyRef.current !== allOptionKey) {
      prevOptionKeyRef.current = allOptionKey;
      const newIds = selectDefaultOptions(allOptions);
      setState({ optionIds: newIds, data: null, isLoading: true, error: null });
    }
  }, [allOptionKey, allOptions]);

  useEffect(() => {
    const fetchCompare = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const selectedOpts = allOptions.filter((o) => state.optionIds.includes(o.id));
      if (selectedOpts.length < 2) {
        setState((prev) => ({ ...prev, isLoading: false, error: "Need at least 2 options to compare" }));
        return;
      }

      try {
        const request: CompareRequest = {
          shipment,
          option_ids: state.optionIds,
          options: selectedOpts,
          selected_priority: selectedPriority,
        };
        const response = await postCompare(request);
        setState((prev) => ({ ...prev, data: response, isLoading: false }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load comparison";
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
      }
    };
    fetchCompare();
  }, [state.optionIds, shipment, allOptions, selectedPriority]);

  const handleRemoveOption = useCallback((optionId: string) => {
    setState((prev) => {
      const newIds = prev.optionIds.filter((id) => id !== optionId);
      if (newIds.length < 2) return prev;
      return { ...prev, optionIds: newIds };
    });
  }, []);

  const handleAddOption = useCallback((optionId: string) => {
    setState((prev) => {
      if (prev.optionIds.length >= 3 || prev.optionIds.includes(optionId)) return prev;
      return { ...prev, optionIds: [...prev.optionIds, optionId] };
    });
  }, []);

  const remainingOptions = useMemo(
    () => allOptions.filter((o) => !state.optionIds.includes(o.id)),
    [allOptions, state.optionIds]
  );

  const selectedOptions = useMemo(
    () => allOptions.filter((o) => state.optionIds.includes(o.id)),
    [allOptions, state.optionIds]
  );

  const activeScenario = state.data?.scenarios[selectedPriority];

  const insightsById = useMemo(() => {
    const map: Record<string, OptionInsight> = {};
    activeScenario?.option_insights.forEach((ins) => { map[ins.option_id] = ins; });
    return map;
  }, [activeScenario]);

  const { anchors, specs } = useMemo(() => {
    const dims = activeScenario?.comparison_dimensions ?? [];
    return {
      anchors: ANCHOR_DIMENSIONS
        .map((n) => dims.find((d) => d.dimension === n))
        .filter((d): d is ComparisonDimension => Boolean(d)),
      specs: SPEC_DIMENSIONS
        .map((n) => dims.find((d) => d.dimension === n))
        .filter((d): d is ComparisonDimension => Boolean(d)),
    };
  }, [activeScenario]);

  if (!state.data && !state.isLoading) return null;

  const canShowAddSlot = selectedOptions.length < 3 && remainingOptions.length > 0;
  const colCount = selectedOptions.length + (canShowAddSlot ? 1 : 0);

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>Compare Service Options</div>

      {state.data && (
        <div className={styles.contextStrip}>{state.data.shipment_summary}</div>
      )}

      {state.isLoading ? (
        <LoadingSkeleton />
      ) : state.data && activeScenario ? (
        <div className={styles.unifiedCard}>
          <div
            className={styles.grid}
            style={{ "--col-count": colCount } as React.CSSProperties}
          >
            {/* Row: option headers (logo + name + price) */}
            <div className={styles.cornerCell} />
            {selectedOptions.map((opt) => (
              <OptionHeaderCell
                key={opt.id}
                option={opt}
                canRemove={selectedOptions.length > 2}
                onRemove={handleRemoveOption}
              />
            ))}
            {canShowAddSlot && (
              <AddCarrierCell
                remainingOptions={remainingOptions}
                onAdd={handleAddOption}
              />
            )}

            {/* Row: insight copy under each option */}
            <div className={styles.cornerCell} />
            {selectedOptions.map((opt) => (
              <InsightCell key={opt.id} insight={insightsById[opt.id]} />
            ))}
            {canShowAddSlot && <div className={styles.insightCell} />}

            {/* Group: At a glance */}
            {anchors.length > 0 && (
              <DimensionGroup
                title="At a glance"
                dims={anchors}
                options={selectedOptions}
                hasAddSlot={canShowAddSlot}
              />
            )}

            {/* Group: Details */}
            {specs.length > 0 && (
              <DimensionGroup
                title="Details"
                dims={specs}
                options={selectedOptions}
                hasAddSlot={canShowAddSlot}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const OptionHeaderCell: React.FC<{
  option: CompareOption;
  canRemove: boolean;
  onRemove: (id: string) => void;
}> = ({ option, canRemove, onRemove }) => (
  <div className={styles.optionHeader}>
    <button
      className={styles.removeBtn}
      onClick={() => onRemove(option.id)}
      disabled={!canRemove}
      aria-label={`Remove ${option.carrier} from comparison`}
      title={!canRemove ? "Keep at least 2 options" : "Remove"}
    >
      ×
    </button>
    <Logo name={option.carrier} sz={34} />
    <div className={styles.optionName}>
      {displayName(option.carrier, option.service_name)}
    </div>
    <div className={styles.optionPrice}>${option.price_usd.toFixed(2)}</div>
  </div>
);

const AddCarrierCell: React.FC<{
  remainingOptions: CompareOption[];
  onAdd: (id: string) => void;
}> = ({ remainingOptions, onAdd }) => (
  <div className={styles.addCell}>
    <Popover>
      <PopoverTrigger asChild>
        <button className={styles.addBtn}>+ Add carrier</button>
      </PopoverTrigger>
      <PopoverContent className={styles.popoverContent} align="start">
        {remainingOptions.map((opt) => (
          <div key={opt.id} className={styles.popoverItem} onClick={() => onAdd(opt.id)}>
            {displayName(opt.carrier, opt.service_name)}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  </div>
);

const InsightCell: React.FC<{ insight: OptionInsight | undefined }> = ({ insight }) => {
  if (!insight) return <div className={styles.insightCell} />;
  return (
    <div className={styles.insightCell}>
      {insight.role_label && (
        <div className={styles.insightRole}>{insight.role_label}</div>
      )}
      {insight.strength && (
        <p className={styles.insightParagraph}>{insight.strength}</p>
      )}
      {insight.consideration && (
        <p className={styles.insightParagraph}>{insight.consideration}</p>
      )}
      {(insight.choose_when || insight.skip_when) && (
        <div className={styles.insightGuidance}>
          {insight.choose_when && (
            <div className={styles.guidanceRow}>
              <span className={styles.guidanceCheck}>✓</span>
              <span>{insight.choose_when}</span>
            </div>
          )}
          {insight.skip_when && (
            <div className={styles.guidanceRow}>
              <span className={styles.guidanceSkip}>✗</span>
              <span>{insight.skip_when}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DimensionGroup: React.FC<{
  title: string;
  dims: ComparisonDimension[];
  options: CompareOption[];
  hasAddSlot: boolean;
}> = ({ title, dims, options, hasAddSlot }) => (
  <>
    <div className={styles.groupHeader}>
      <div className={styles.groupTitle}>{title}</div>
    </div>
    {dims.map((dim) => (
      <React.Fragment key={dim.dimension}>
        <div className={styles.rowLabel}>{dim.dimension}</div>
        {options.map((opt) => {
          const isWinner = dim.winner_id === opt.id;
          return (
            <div
              key={opt.id}
              className={`${styles.cell} ${isWinner ? styles.cellWinner : ""}`}
            >
              {dim.values[opt.id] || "\u2014"}
            </div>
          );
        })}
        {hasAddSlot && <div className={styles.cell} />}
      </React.Fragment>
    ))}
  </>
);

function selectDefaultOptions(allOptions: CompareOption[]): string[] {
  if (allOptions.length < 2) return allOptions.map((o) => o.id);

  const selected: string[] = [];

  const publicOptions = allOptions.filter(
    (o) => o.carrier_type === "public" || o.carrier === "USPS"
  );
  if (publicOptions.length > 0) {
    selected.push(
      publicOptions.reduce((prev, curr) => (curr.price_usd < prev.price_usd ? curr : prev)).id
    );
  }

  const privateOptions = allOptions.filter(
    (o) => o.carrier_type === "private" && !selected.includes(o.id) &&
      (o.carrier === "UPS" || o.carrier === "FedEx" || o.carrier === "DHL")
  );
  if (privateOptions.length > 0) {
    selected.push(
      privateOptions.reduce((prev, curr) =>
        curr.arrival_date < prev.arrival_date ||
        (curr.arrival_date === prev.arrival_date && curr.price_usd < prev.price_usd)
          ? curr : prev
      ).id
    );
  }

  const remaining = allOptions.filter((o) => !selected.includes(o.id));
  if (remaining.length > 0 && selected.length < 3) {
    selected.push(
      remaining.reduce((prev, curr) => (curr.price_usd < prev.price_usd ? curr : prev)).id
    );
  }

  return selected;
}
