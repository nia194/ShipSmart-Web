import { useState, type MouseEvent } from "react";

import { Logo } from "./Logo";
import { BookmarkIcon } from "./BookmarkIcon";
import { TIER_BADGES, type ShippingService } from "@/lib/shipping-data";

import { supabase } from "@/integrations/supabase/client";
import { apiConfig, javaApi } from "@/config/api";

const COLS = "36px 1fr 70px 80px 110px 40px 24px";

interface DetailProps {
  svc: ShippingService;
  open: boolean;
  bookUrl: string;
  onBook: () => void;
}

function formatMoney(value: number) {
  const abs = Math.abs(value);
  return `$${abs.toFixed(2)}`;
}

function formatSignedMoney(value: number) {
  return `${value < 0 ? "-" : ""}${formatMoney(value)}`;
}

function safeDetails(svc: ShippingService) {
  return (svc.details ?? {}) as Record<string, unknown>;
}

function safeFeatures(svc: ShippingService) {
  return Array.isArray(svc.features) ? svc.features : [];
}

function getDetailValue(
  details: Record<string, unknown>,
  keys: string[],
  fallback: string,
) {
  const entry = Object.entries(details).find(([key]) => {
    const normalized = key.toLowerCase();
    return keys.some((target) => normalized.includes(target));
  });

  return entry ? String(entry[1]) : fallback;
}

function getTrackingLabel(features: string[]) {
  const hasInsight = features.some((feature) =>
    feature.toLowerCase().includes("insight"),
  );

  if (hasInsight) return "Enhanced tracking";

  const hasTracking = features.some((feature) =>
    feature.toLowerCase().includes("tracking"),
  );

  return hasTracking ? "Full tracking" : "Carrier tracking";
}

function getInsuranceLabel(details: Record<string, unknown>, features: string[]) {
  const insurance = getDetailValue(details, ["insurance"], "");

  if (insurance) return insurance;

  const hasInsurance = features.some((feature) =>
    feature.toLowerCase().includes("insurance"),
  );

  return hasInsurance ? "Included" : "Shown during booking";
}

function getCutoffLabel(details: Record<string, unknown>) {
  return getDetailValue(
    details,
    ["cutoff", "ship by", "by"],
    "Confirmed during booking",
  );
}

function getGuaranteeLabel(details: Record<string, unknown>, svc: ShippingService) {
  const guarantee = getDetailValue(details, ["guarantee"], "");

  if (guarantee) return guarantee;

  return svc.guaranteed ? "Guaranteed" : "Estimated";
}

function getPickupLabel(svc: ShippingService) {
  const pickupItems = svc.breakdown?.pickup ?? [];

  if (pickupItems.length === 0) return "Shown during booking";

  const positivePickup = pickupItems.find((item) => item.amount > 0);
  const totalPickup = pickupItems.reduce((sum, item) => sum + item.amount, 0);

  if (positivePickup && totalPickup <= 0) {
    return `${positivePickup.label} included`;
  }

  if (positivePickup) {
    return `${positivePickup.label} · ${formatMoney(positivePickup.amount)}`;
  }

  return "Available";
}

function getUseCaseLabel(svc: ShippingService) {
  const tier = svc.tier.toLowerCase();

  if (tier.includes("express") && svc.guaranteed) {
    return "time-sensitive shipments";
  }

  if (tier.includes("overnight") || tier.includes("next")) {
    return "urgent delivery";
  }

  if (tier.includes("economy")) {
    return "lowest-cost shipping";
  }

  if (svc.guaranteed) {
    return "reliable standard delivery";
  }

  return "flexible delivery windows";
}

function getBreakdownRows(svc: ShippingService) {
  const shippingRows = svc.breakdown?.shipping ?? [];
  const pickupRows = svc.breakdown?.pickup ?? [];

  return [
    ...shippingRows.map((item) => ({
      ...item,
      group: "Shipping",
    })),
    ...pickupRows.map((item) => ({
      ...item,
      group: "Pickup",
    })),
  ];
}

function SectionMark({ icon, title }: { icon: string; title: string }) {
  const normalized = title.toLowerCase();

  const mark = normalized.includes("major")
    ? "▥"
    : normalized.includes("specialty")
      ? "◇"
      : icon;

  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        color: "#475569",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {mark}
    </span>
  );
}

function MiniFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "8px 10px",
        borderRadius: 9,
        background: "#fff",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: ".6px",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function CompactBreakdown({ svc }: { svc: ShippingService }) {
  const rows = getBreakdownRows(svc);

  if (rows.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #eef2f7",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: "#0f172a",
              textTransform: "uppercase",
              letterSpacing: ".7px",
            }}
          >
            Estimated price details
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            Breakdown shown before carrier checkout
          </div>
        </div>

        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          {formatMoney(svc.price)}
        </div>
      </div>

      <div style={{ padding: "8px 12px 10px" }}>
        {rows.slice(0, 5).map((item, index) => (
          <div
            key={`${item.group}-${item.label}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr auto",
              gap: 10,
              alignItems: "center",
              padding: "6px 0",
              borderBottom:
                index === Math.min(rows.length, 5) - 1
                  ? "none"
                  : "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              {item.group}
            </span>

            <span
              style={{
                fontSize: 12.5,
                fontWeight: 650,
                color: "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.label}
            >
              {item.label}
            </span>

            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: item.amount < 0 ? "#15803d" : "#0f172a",
                whiteSpace: "nowrap",
              }}
            >
              {formatSignedMoney(item.amount)}
            </span>
          </div>
        ))}

        {rows.length > 5 && (
          <div
            style={{
              paddingTop: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            + {rows.length - 5} more line item{rows.length - 5 === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

const Detail = ({ svc, open, bookUrl, onBook }: DetailProps) => {
  if (!open) return null;

  const details = safeDetails(svc);
  const features = safeFeatures(svc);

  const guarantee = getGuaranteeLabel(details, svc);
  const cutoff = getCutoffLabel(details);
  const tracking = getTrackingLabel(features);
  const insurance = getInsuranceLabel(details, features);
  const pickup = getPickupLabel(svc);
  const useCase = getUseCaseLabel(svc);

  return (
    <div
      style={{
        padding: "0 18px 16px 62px",
        animation: "fadeIn .2s both",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(260px, .75fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          {svc.ai && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#f8fbff",
                border: "1px solid #bfdbfe",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 5,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    color: "#1d4ed8",
                    textTransform: "uppercase",
                    letterSpacing: ".75px",
                  }}
                >
                  Why this option fits
                </div>

                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#64748b",
                    background: "#fff",
                    border: "1px solid #dbeafe",
                    padding: "2px 7px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  LLM explanation
                </span>
              </div>

              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 650,
                  color: "#334155",
                  textAlign: "left",
                }}
              >
                {svc.ai}
              </div>
            </div>
          )}

          <CompactBreakdown svc={svc} />
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {svc.promo && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: 11,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#15803d",
                  marginBottom: 2,
                }}
              >
                {svc.promo.pct} off applied
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                Code <strong>{svc.promo.code}</strong> · Saves{" "}
                <strong>{formatMoney(svc.promo.save)}</strong>
              </div>
            </div>
          )}

          <div
            style={{
              padding: "12px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 900,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: ".7px",
                marginBottom: 8,
              }}
            >
              Best for
            </div>

            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.35,
                marginBottom: 10,
              }}
            >
              {useCase}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
              }}
            >
              <MiniFact label="Delivery" value={guarantee} />
              <MiniFact label="Tracking" value={tracking} />
              <MiniFact label="Insurance" value={insurance} />
              <MiniFact label="Pickup" value={pickup} />
              <MiniFact label="Cutoff" value={cutoff} />
              <MiniFact label="Rate" value="Estimated" />
            </div>
          </div>

          {features.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
              }}
            >
              {features.slice(0, 4).map((feature) => (
                <span
                  key={feature}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 10.5,
                    fontWeight: 750,
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <a
        href={bookUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onBook}
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "11px 22px",
          borderRadius: 11,
          background: "#0071e3",
          color: "#fff",
          fontSize: 14.5,
          fontWeight: 850,
          textDecoration: "none",
          fontFamily: "'Outfit',sans-serif",
          transition: "all .2s",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "#005ecb";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "#0071e3";
        }}
      >
        Book on {svc.carrier} →
      </a>
    </div>
  );
};

export const ColHeader = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: COLS,
      gap: 8,
      padding: "10px 18px 6px",
      borderBottom: "1.5px solid #f0f0f2",
      alignItems: "center",
    }}
  >
    {["", "Service", "Transit", "Tier", "Rate", "", ""].map((heading, index) => (
      <span
        key={index}
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#b0b5c0",
          textTransform: "uppercase",
          letterSpacing: ".8px",
          textAlign: index === 4 ? "right" : index >= 2 ? "center" : "left",
        }}
      >
        {heading}
      </span>
    ))}
  </div>
);

interface RowProps {
  svc: ShippingService;
  openId: string | null;
  onToggle: (id: string) => void;
  idx: number;
  animBase?: number;
  bookUrl: string;
  isSaved: boolean;
  onSave: (svc: ShippingService) => void;
  origin?: string;
  dest?: string;
}

export const Row = ({
  svc,
  openId,
  onToggle,
  idx,
  animBase = 0,
  bookUrl,
  isSaved,
  onSave,
  origin,
  dest,
}: RowProps) => {
  const [justSaved, setJustSaved] = useState(false);
  const isOpen = openId === svc.id;
  const tb = TIER_BADGES[svc.tier] || TIER_BADGES.STANDARD;

  const handleSave = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSave(svc);

    if (!isSaved) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 500);
    }
  };

  const trackRedirect = () => {
    const payload = {
      serviceId: svc.id,
      carrier: svc.carrier,
      serviceName: svc.name,
      redirectUrl: bookUrl,
      origin: origin || "",
      destination: dest || "",
    };

    if (apiConfig.useJavaBookingRedirect) {
      fetch(javaApi.bookingRedirect(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } else {
      supabase.functions
        .invoke("generate-book-redirect", {
          body: payload,
        })
        .catch(() => {});
    }
  };

  return (
    <div
      style={{
        background: isOpen ? "#f8faff" : "#fff",
        borderBottom: "1px solid #f0f0f2",
        cursor: "pointer",
        animation: `fadeUp .3s ${animBase + idx * 0.05}s both`,
      }}
    >
      <div
        onClick={() => onToggle(svc.id)}
        style={{
          padding: "13px 18px",
          display: "grid",
          gridTemplateColumns: COLS,
          alignItems: "center",
          gap: 8,
        }}
      >
        <Logo name={svc.carrier} sz={32} />

        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 750,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textAlign: "left",
            }}
          >
            {svc.name}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginTop: 2,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{svc.carrier}</span>

            {svc.guaranteed && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 750,
                  color: "#15803d",
                  background: "#f0fdf4",
                  padding: "1px 6px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                ✓ Guaranteed
              </span>
            )}

            {svc.promo && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 750,
                  color: "#15803d",
                  whiteSpace: "nowrap",
                }}
              >
                {svc.promo.pct} off
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
            {svc.transitDays}d
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>{svc.date}</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 5,
              fontSize: 9,
              fontWeight: 850,
              letterSpacing: ".4px",
              background: tb.bg,
              color: tb.c,
              border: `1.5px solid ${tb.b}`,
            }}
          >
            {svc.tier}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          {svc.originalPrice && (
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                textDecoration: "line-through",
                marginRight: 3,
              }}
            >
              {formatMoney(svc.originalPrice)}
            </span>
          )}

          <span style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
            {formatMoney(svc.price)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <button
            className={`ss-save-btn ${isSaved ? "saved" : ""} ${
              justSaved ? "just-saved" : ""
            }`}
            onClick={handleSave}
            title={isSaved ? "Saved" : "Save"}
          >
            <BookmarkIcon filled={isSaved} justSaved={justSaved} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "#9ca3af",
              transition: "transform .3s",
              display: "inline-block",
              transform: isOpen ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      <Detail svc={svc} open={isOpen} bookUrl={bookUrl} onBook={trackRedirect} />
    </div>
  );
};

interface SectionProps {
  icon: string;
  title: string;
  subtitle: string;
  badge?: { bg: string; c: string; label: string };
  topRows: ShippingService[];
  moreRows: ShippingService[];
  openId: string | null;
  onToggle: (id: string) => void;
  animBase: number;
  buildUrl: (svc: ShippingService) => string;
  savedIds: Set<string>;
  onSaveService: (svc: ShippingService) => void;
  origin?: string;
  dest?: string;
}

export const Section = ({
  icon,
  title,
  subtitle,
  badge,
  topRows,
  moreRows,
  openId,
  onToggle,
  animBase,
  buildUrl,
  savedIds,
  onSaveService,
  origin,
  dest,
}: SectionProps) => {
  const [more, setMore] = useState(false);

  return (
    <div style={{ marginBottom: 22, animation: `fadeUp .35s ${animBase}s both` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 0 7px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 850,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#111827",
            textAlign: "left",
          }}
        >
          <SectionMark icon={icon} title={title} />

          <span>{title}</span>

          {badge && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 5,
                background: badge.bg,
                color: badge.c,
              }}
            >
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11.5,
          color: "#9ca3af",
          marginTop: -4,
          marginBottom: 6,
          textAlign: "left",
          paddingLeft: 28,
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1.5px solid #eeeff1",
          background: "#fff",
        }}
      >
        <ColHeader />

        {topRows.map((service, index) => (
          <Row
            key={service.id}
            svc={service}
            openId={openId}
            onToggle={onToggle}
            idx={index}
            animBase={animBase + 0.05}
            bookUrl={buildUrl(service)}
            isSaved={savedIds.has(service.id)}
            onSave={onSaveService}
            origin={origin}
            dest={dest}
          />
        ))}

        {moreRows.length > 0 && (
          <>
            <div
              onClick={() => setMore(!more)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                cursor: "pointer",
                borderTop: "1px solid #f0f0f2",
                color: "#0071e3",
                fontSize: 13,
                fontWeight: 650,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  transition: "transform .3s",
                  display: "inline-block",
                  transform: more ? "rotate(180deg)" : "none",
                }}
              >
                ▾
              </span>

              {more ? "Hide" : `View ${moreRows.length} more`}
            </div>

            {more &&
              moreRows.map((service, index) => (
                <Row
                  key={service.id}
                  svc={service}
                  openId={openId}
                  onToggle={onToggle}
                  idx={index}
                  animBase={0}
                  bookUrl={buildUrl(service)}
                  isSaved={savedIds.has(service.id)}
                  onSave={onSaveService}
                  origin={origin}
                  dest={dest}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
};