// src/components/shipment-form/DateStep.tsx

import { useCallback, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateStepProps {
  dropDate?: Date;
  delivDate?: Date;
  active: boolean;
  complete: boolean;
  showError: boolean;
  onDropDateChange: (date: Date | undefined) => void;
  onDelivDateChange: (date: Date | undefined) => void;
  onEdit: () => void;
}

const today = startOfDay(new Date());

function CheckIcon() {
  return <span className="ss-check-icon">✓</span>;
}

function DateSummary({
  dropDate,
  delivDate,
  onEdit,
}: {
  dropDate: Date;
  delivDate: Date;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="ss-summary-row" onClick={onEdit}>
      <div className="ss-summary-left">
        <CheckIcon />
        <span>
          {format(dropDate, "MMM d, yyyy")}{" "}
          <span className="ss-arrow">→</span>{" "}
          {format(delivDate, "MMM d, yyyy")}
        </span>
      </div>
    </button>
  );
}

export default function DateStep({
  dropDate,
  delivDate,
  active,
  complete,
  showError,
  onDropDateChange,
  onDelivDateChange,
  onEdit,
}: DateStepProps) {
  const [dropOpen, setDropOpen] = useState(false);
  const [delivOpen, setDelivOpen] = useState(false);

  const handleDropDateSelect = useCallback(
    (date: Date | undefined) => {
      onDropDateChange(date);
      setDropOpen(false);

      if (date && !delivDate) {
        setTimeout(() => setDelivOpen(true), 150);
      }
    },
    [delivDate, onDropDateChange],
  );

  const handleDelivDateSelect = useCallback(
    (date: Date | undefined) => {
      onDelivDateChange(date);
      setDelivOpen(false);
    },
    [onDelivDateChange],
  );

  if (complete && dropDate && delivDate && !active) {
    return (
      <DateSummary
        dropDate={dropDate}
        delivDate={delivDate}
        onEdit={onEdit}
      />
    );
  }

  if (!active) {
    return null;
  }

  return (
    <div className="ss-form-card ss-date-card">
      <div className="ss-date-grid">
        <div>
          <label className="ss-mini-label">Drop off</label>

          <Popover open={dropOpen} onOpenChange={setDropOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`ss-date-trigger ${dropDate ? "has-value" : ""}`}
              >
                {dropDate ? format(dropDate, "EEEE, MMM d") : "Select date"}
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-auto p-0"
              align="start"
              style={{ zIndex: 200 }}
            >
              <Calendar
                mode="single"
                selected={dropDate}
                onSelect={handleDropDateSelect}
                disabled={(date) => isBefore(date, today)}
                autoFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="ss-mini-label">Delivery by</label>

          <Popover open={delivOpen} onOpenChange={setDelivOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`ss-date-trigger ${delivDate ? "has-value" : ""}`}
              >
                {delivDate ? format(delivDate, "EEEE, MMM d") : "Select date"}
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-auto p-0"
              align="start"
              style={{ zIndex: 200 }}
            >
              <Calendar
                mode="single"
                selected={delivDate}
                onSelect={handleDelivDateSelect}
                disabled={(date) => isBefore(date, dropDate || today)}
                autoFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {showError && (
        <p className="ss-error-text">Add a drop-off and delivery date.</p>
      )}
    </div>
  );
}