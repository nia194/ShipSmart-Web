// src/components/shipment-form/PackageCard.tsx

import { PackageTypeDropdown } from "@/components/shipping/PackageTypeDropDown";
import {
  PKG_TYPES,
  getItemErrors,
  type PackageItem,
} from "@/lib/shipping-data";

interface PackageCardProps {
  pkg: PackageItem;
  index: number;
  expanded: boolean;
  showErrors: boolean;
  totalPackages: number;
  onExpand: (index: number) => void;
  onChange: (index: number, field: keyof PackageItem, value: string) => void;
  onRemove: (index: number) => void;
}

interface NumberInputProps {
  value: string;
  placeholder: string;
  error?: boolean;
  onChange: (value: string) => void;
}

function NumberInput({
  value,
  placeholder,
  error,
  onChange,
}: NumberInputProps) {
  return (
    <input
      className={`ss-inp ss-number-input ${error ? "err" : ""}`}
      type="number"
      min="0"
      step="0.1"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function isPackageComplete(pkg: PackageItem) {
  const qty = Number(pkg.qty);
  const weight = Number(pkg.weight);
  const length = Number(pkg.l);
  const width = Number(pkg.w);
  const height = Number(pkg.h);

  return (
    Number.isFinite(qty) &&
    qty >= 1 &&
    Number.isFinite(weight) &&
    weight > 0 &&
    Number.isFinite(length) &&
    length > 0 &&
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
  );
}

export function getPackageTypeLabel(pkg: PackageItem) {
  const found = PKG_TYPES.find((item) => item.id === pkg.type);
  return found?.label ?? found?.title ?? "Package";
}

export function getPackageTypeSubtitle(pkg: PackageItem) {
  const found = PKG_TYPES.find((item) => item.id === pkg.type);
  return found?.subtitle ?? "";
}

export function getPackageSummary(pkg: PackageItem) {
  const type = getPackageTypeLabel(pkg);
  const qty = pkg.qty || "1";

  const dimensions =
    pkg.l && pkg.w && pkg.h
      ? `${pkg.l} × ${pkg.w} × ${pkg.h} in`
      : "dimensions pending";

  const weight = pkg.weight ? `${pkg.weight} lbs` : "weight pending";

  return `${type} · Qty ${qty} · ${dimensions} · ${weight}`;
}

export default function PackageCard({
  pkg,
  index,
  expanded,
  showErrors,
  totalPackages,
  onExpand,
  onChange,
  onRemove,
}: PackageCardProps) {
  const errors = showErrors ? getItemErrors(pkg) : [];
  const completed = isPackageComplete(pkg);

  return (
    <div
      className={`ss-package-card ${expanded ? "expanded" : "collapsed"} ${
        errors.length ? "err" : ""
      }`}
    >
      <button
        type="button"
        className="ss-package-header"
        onClick={() => onExpand(index)}
      >
        <span
          className={
            expanded || completed
              ? "ss-package-index checked"
              : "ss-package-index"
          }
        >
          {expanded || completed ? "✓" : index + 1}
        </span>

        <span className="ss-package-title">Package {index + 1}</span>

        {!expanded && (
          <span className="ss-package-summary">{getPackageSummary(pkg)}</span>
        )}

        <span className="ss-package-chevron">{expanded ? "⌃" : "⌄"}</span>
      </button>

      {expanded && (
        <div className="ss-package-body">
          <div className="ss-package-grid">
            <div>
              <label className="ss-field-label">Type of package</label>

              <PackageTypeDropdown
                value={pkg.type}
                onChange={(value) => onChange(index, "type", value)}
              />

              <p className="ss-package-help">{getPackageTypeSubtitle(pkg)}</p>
            </div>

            <div>
              <label className="ss-field-label">Quantity</label>

              <NumberInput
                value={pkg.qty}
                placeholder="1"
                error={showErrors && (!pkg.qty || Number(pkg.qty) < 1)}
                onChange={(value) => onChange(index, "qty", value)}
              />
            </div>

            <div>
              <label className="ss-field-label">
                Dimensions ( L × W × H, in )
              </label>

              <div className="ss-dimensions-row">
                <NumberInput
                  value={pkg.l}
                  placeholder="L"
                  error={showErrors && (!pkg.l || Number(pkg.l) <= 0)}
                  onChange={(value) => onChange(index, "l", value)}
                />

                <NumberInput
                  value={pkg.w}
                  placeholder="W"
                  error={showErrors && (!pkg.w || Number(pkg.w) <= 0)}
                  onChange={(value) => onChange(index, "w", value)}
                />

                <NumberInput
                  value={pkg.h}
                  placeholder="H"
                  error={showErrors && (!pkg.h || Number(pkg.h) <= 0)}
                  onChange={(value) => onChange(index, "h", value)}
                />
              </div>
            </div>

            <div>
              <label className="ss-field-label">Weight (lbs)</label>

              <NumberInput
                value={pkg.weight}
                placeholder="0"
                error={showErrors && (!pkg.weight || Number(pkg.weight) <= 0)}
                onChange={(value) => onChange(index, "weight", value)}
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div className="ss-package-errors">
              {errors.map((error, errorIndex) => (
                <div key={errorIndex}>⚠ {error}</div>
              ))}
            </div>
          )}

          {totalPackages > 1 && (
            <button
              type="button"
              className="ss-remove-package"
              onClick={() => onRemove(index)}
            >
              🗑 Remove package
            </button>
          )}
        </div>
      )}
    </div>
  );
}