// src/components/shipment-form/PackageDetailsStep.tsx

import type { PackageItem } from "@/lib/shipping-data";

import PackageCard, {
  getPackageTypeLabel,
} from "@/components/shipment-form/PackageCard";

interface PackageDetailsStepProps {
  packages: PackageItem[];
  active: boolean;
  complete: boolean;
  packageSummary: string;
  activePackageIndex: number;
  showErrors: boolean;
  onEdit: () => void;
  onActivePackageChange: (index: number) => void;
  onPackageChange: (
    index: number,
    field: keyof PackageItem,
    value: string,
  ) => void;
  onAddPackage: () => void;
  onRemovePackage: (index: number) => void;
}

function CheckIcon() {
  return <span className="ss-check-icon">✓</span>;
}

function StepIcon() {
  return <span className="ss-step-icon">3</span>;
}

function getPackageLine(pkg: PackageItem, index: number) {
  const type = getPackageTypeLabel(pkg);
  const qty = Number(pkg.qty);
  const weight = Number(pkg.weight);

  const qtyText =
    Number.isFinite(qty) && qty > 1 ? `Qty ${qty} · ` : "";

  const weightText =
    Number.isFinite(weight) && weight > 0
      ? `${weight} lbs`
      : "weight pending";

  return `Package ${index + 1} · ${type} · ${qtyText}${weightText}`;
}

export default function PackageDetailsStep({
  packages,
  active,
  complete,
  packageSummary,
  activePackageIndex,
  showErrors,
  onEdit,
  onActivePackageChange,
  onPackageChange,
  onAddPackage,
  onRemovePackage,
}: PackageDetailsStepProps) {
  if (!active) {
    return (
      <button
        type="button"
        className="ss-summary-row ss-package-summary-row"
        onClick={onEdit}
      >
        <div className="ss-summary-left ss-package-summary-left">
          {complete ? <CheckIcon /> : <StepIcon />}

          <div className="ss-package-summary-stack">
            {packages.map((pkg, index) => (
              <span key={`package-summary-${index}`}>
                {getPackageLine(pkg, index)}
              </span>
            ))}

            {complete && packages.length > 1 && (
              <span className="ss-package-summary-total">
                Total · {packageSummary}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="ss-package-shell">
      <div className="ss-form-card ss-package-master-card">
        {packages.map((pkg, index) => (
          <PackageCard
            key={`package-${index}`}
            pkg={pkg}
            index={index}
            expanded={index === activePackageIndex || packages.length === 1}
            showErrors={showErrors}
            totalPackages={packages.length}
            onExpand={onActivePackageChange}
            onChange={onPackageChange}
            onRemove={onRemovePackage}
          />
        ))}

        <button
          type="button"
          className="ss-add-package-card"
          onClick={onAddPackage}
        >
          <span>＋</span>
          Add another item
        </button>
      </div>
    </div>
  );
}