// src/components/shipment-form/LocationStep.tsx

import type { RefObject } from "react";
import { CityInput } from "@/components/shipping/CityInput";

interface LocationStepProps {
  origin: string;
  dest: string;
  active: boolean;
  complete: boolean;
  showError: boolean;
  destRef: RefObject<HTMLInputElement | null>;
  onOriginChange: (value: string) => void;
  onDestChange: (value: string) => void;
  onOriginSelect: (value: string) => void;
  onDestSelect: (value: string) => void;
  onSwap: () => void;
  onEdit: () => void;
}

function CheckIcon() {
  return <span className="ss-check-icon">✓</span>;
}

function LocationSummary({
  origin,
  dest,
  onEdit,
}: {
  origin: string;
  dest: string;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="ss-summary-row" onClick={onEdit}>
      <div className="ss-summary-left">
        <CheckIcon />
        <span>
          {origin} <span className="ss-arrow">→</span> {dest}
        </span>
      </div>
    </button>
  );
}

export default function LocationStep({
  origin,
  dest,
  active,
  complete,
  showError,
  destRef,
  onOriginChange,
  onDestChange,
  onOriginSelect,
  onDestSelect,
  onSwap,
  onEdit,
}: LocationStepProps) {
  if (complete && !active) {
    return <LocationSummary origin={origin} dest={dest} onEdit={onEdit} />;
  }

  return (
    <div className="ss-form-card ss-location-card">
      <div className="ss-location-grid">
        <div>
          <label className="ss-mini-label">Pick up</label>

          <CityInput
            value={origin}
            onChange={onOriginChange}
            onSelect={onOriginSelect}
            placeholder="From city or ZIP code"
            icon=""
          />
        </div>

        <button
          type="button"
          className="ss-swap-btn"
          onClick={onSwap}
          aria-label="Swap pickup and delivery"
        >
          ⇄
        </button>

        <div>
          <label className="ss-mini-label">Deliver to</label>

          <CityInput
            inputRef={destRef}
            value={dest}
            onChange={onDestChange}
            onSelect={onDestSelect}
            placeholder="To city or ZIP code"
            icon=""
          />
        </div>
      </div>

      {showError && (
        <p className="ss-error-text">
          Select both pickup and delivery locations from the suggestions.
        </p>
      )}
    </div>
  );
}