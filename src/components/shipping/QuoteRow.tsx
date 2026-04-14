import { useState } from "react";
import { Logo } from "./Logo";
import { BookmarkIcon } from "./BookmarkIcon";
import { PriceBreakdown } from "./SharedUI";
import { TIER_BADGES, type ShippingService } from "@/lib/shipping-data";
// Booking redirect: toggle between legacy Supabase edge function and new Java API.
// Set VITE_USE_JAVA_BOOKING_REDIRECT=true to use the new Java API.
import { supabase } from "@/integrations/supabase/client";
import { apiConfig, javaApi } from "@/config/api";

const COLS = "36px 1fr 70px 80px 110px 40px 24px";

interface DetailProps { svc: ShippingService; open: boolean; bookUrl: string; onBook: () => void }

const Detail = ({ svc, open, bookUrl, onBook }: DetailProps) => {
  if (!open) return null;
  return (
    <div style={{ padding: "0 18px 16px", animation: "fadeIn .2s both" }}>
      {svc.promo && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 9, background: "#f0fdf4", border: "1.5px solid #bbf7d0", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>{svc.promo.pct} OFF</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Code: <strong>{svc.promo.code}</strong></span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>Save ${svc.promo.save}</span>
        </div>
      )}
      {svc.ai && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "linear-gradient(135deg,#eff6ff,#f5f3ff)", border: "1px solid #ddd6fe", marginBottom: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <div><div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", marginBottom: 2 }}>AI RECOMMENDATION</div><div style={{ fontSize: 12.5, color: "#4b5563", fontWeight: 500, lineHeight: 1.4 }}>{svc.ai}</div></div>
        </div>
      )}
      <PriceBreakdown breakdown={svc.breakdown} total={svc.price} />
      {Object.keys(svc.details).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(svc.details).map(([k, v]) => (
            <div key={k} style={{ padding: "6px 12px", borderRadius: 8, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {svc.features.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
          {svc.features.map(f => <span key={f} style={{ padding: "3px 10px", borderRadius: 6, background: "#f0f5ff", color: "#0071e3", fontSize: 11, fontWeight: 600 }}>{f}</span>)}
        </div>
      )}
      <a href={bookUrl} target="_blank" rel="noopener noreferrer" onClick={onBook}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 24px", borderRadius: 11, background: "#0071e3", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", fontFamily: "'Outfit',sans-serif", transition: "all .2s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "#005ecb"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#0071e3"; }}
      >
        Book on {svc.carrier} →
      </a>
    </div>
  );
};

export const ColHeader = () => (
  <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "10px 18px 6px", borderBottom: "1.5px solid #f0f0f2", alignItems: "center" }}>
    {["", "Service", "Transit", "Tier", "Rate", "", ""].map((h, i) => (
      <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "#b0b5c0", textTransform: "uppercase", letterSpacing: ".8px", textAlign: i === 4 ? "right" : i >= 2 ? "center" : "left" }}>{h}</span>
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

export const Row = ({ svc, openId, onToggle, idx, animBase = 0, bookUrl, isSaved, onSave, origin, dest }: RowProps) => {
  const [justSaved, setJustSaved] = useState(false);
  const isOpen = openId === svc.id;
  const tb = TIER_BADGES[svc.tier] || TIER_BADGES.STANDARD;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      supabase.functions.invoke("generate-book-redirect", {
        body: payload,
      }).catch(() => {});
    }
  };

  return (
    <div style={{ background: isOpen ? "#f8faff" : "#fff", borderBottom: "1px solid #f0f0f2", cursor: "pointer", animation: `fadeUp .3s ${animBase + idx * 0.05}s both` }}>
      <div onClick={() => onToggle(svc.id)} style={{ padding: "13px 18px", display: "grid", gridTemplateColumns: COLS, alignItems: "center", gap: 8 }}>
        <Logo name={svc.carrier} sz={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{svc.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{svc.carrier}</span>
            {svc.guaranteed && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#15803d", background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>✓ Guaranteed</span>}
            {svc.promo && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#15803d" }}>{svc.promo.pct} off</span>}
          </div>
        </div>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{svc.transitDays}d</div><div style={{ fontSize: 10, color: "#9ca3af" }}>{svc.date}</div></div>
        <div style={{ textAlign: "center" }}><span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: ".4px", background: tb.bg, color: tb.c, border: `1.5px solid ${tb.b}` }}>{svc.tier}</span></div>
        <div style={{ textAlign: "right" }}>
          {svc.originalPrice && <span style={{ fontSize: 11, color: "#9ca3af", textDecoration: "line-through", marginRight: 3 }}>${svc.originalPrice}</span>}
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>${svc.price}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <button className={`ss-save-btn ${isSaved ? "saved" : ""} ${justSaved ? "just-saved" : ""}`} onClick={handleSave} title={isSaved ? "Saved" : "Save"}>
            <BookmarkIcon filled={isSaved} justSaved={justSaved} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#9ca3af", transition: "transform .3s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
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

export const Section = ({ icon, title, subtitle, badge, topRows, moreRows, openId, onToggle, animBase, buildUrl, savedIds, onSaveService, origin, dest }: SectionProps) => {
  const [more, setMore] = useState(false);
  return (
    <div style={{ marginBottom: 22, animation: `fadeUp .35s ${animBase}s both` }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 0 7px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
          <span>{icon}</span>{title}
          {badge && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: badge.bg, color: badge.c }}>{badge.label}</span>}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: -4, marginBottom: 6 }}>{subtitle}</div>
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid #eeeff1", background: "#fff" }}>
        <ColHeader />
        {topRows.map((s, i) => <Row key={s.id} svc={s} openId={openId} onToggle={onToggle} idx={i} animBase={animBase + 0.05} bookUrl={buildUrl(s)} isSaved={savedIds.has(s.id)} onSave={onSaveService} origin={origin} dest={dest} />)}
        {moreRows.length > 0 && (
          <>
            <div onClick={() => setMore(!more)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", cursor: "pointer", borderTop: "1px solid #f0f0f2", color: "#0071e3", fontSize: 13, fontWeight: 600 }}>
              <span style={{ fontSize: 14, transition: "transform .3s", display: "inline-block", transform: more ? "rotate(180deg)" : "none" }}>▾</span>
              {more ? "Hide" : `View ${moreRows.length} more`}
            </div>
            {more && moreRows.map((s, i) => <Row key={s.id} svc={s} openId={openId} onToggle={onToggle} idx={i} animBase={0} bookUrl={buildUrl(s)} isSaved={savedIds.has(s.id)} onSave={onSaveService} origin={origin} dest={dest} />)}
          </>
        )}
      </div>
    </div>
  );
};
