// TODO: [MIGRATION] This page displays data from the legacy "get-saved-options"
// Supabase edge function. Migrate to Java/Python API when backend is ready.

import { useState } from "react";
import { Logo } from "@/components/shipping/Logo";
import { TIER_BADGES } from "@/lib/shipping-data";
import type { SavedOption } from "@/hooks/useSavedOptions";

interface SavedServicesPageProps {
  savedServices: SavedOption[];
  onRemove: (id: string) => void;
  onNavigateHome: () => void;
}

/** Phone number validation: US format */
function isValidPhone(phone: string): boolean {
  return /^\+?1?\d{10,14}$/.test(phone.replace(/[\s\-()]/g, ""));
}

export default function SavedServicesPage({ savedServices, onRemove, onNavigateHome }: SavedServicesPageProps) {
  // Notification subscription state (local until DB tables are provisioned)
  const [subscriptions, setSubscriptions] = useState<Record<string, { email: boolean; sms: boolean; phone: string; phoneErr: string }>>({});

  const getSub = (id: string) => subscriptions[id] || { email: false, sms: false, phone: "", phoneErr: "" };

  const toggleEmail = (id: string) => {
    const cur = getSub(id);
    setSubscriptions(prev => ({ ...prev, [id]: { ...cur, email: !cur.email } }));
    // TODO: [MIGRATION] MCP PLACEHOLDER: When email credentials are configured,
    // invoke MCP connector to send welcome/confirmation email for this saved service
  };

  const toggleSms = (id: string) => {
    const cur = getSub(id);
    if (cur.sms) {
      setSubscriptions(prev => ({ ...prev, [id]: { ...cur, sms: false, phone: "", phoneErr: "" } }));
    } else {
      setSubscriptions(prev => ({ ...prev, [id]: { ...cur, sms: true } }));
    }
  };

  const updatePhone = (id: string, phone: string) => {
    const cur = getSub(id);
    const phoneErr = phone && !isValidPhone(phone) ? "Enter a valid phone number" : "";
    setSubscriptions(prev => ({ ...prev, [id]: { ...cur, phone, phoneErr } }));
    // TODO: [MIGRATION] MCP PLACEHOLDER: When SMS credentials (e.g. Twilio) are configured,
    // invoke MCP connector to subscribe to price_drop_alert, promo_available, service_expiring events
  };

  if (savedServices.length === 0) {
    return (
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px 80px", animation: "fadeIn .3s both" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 4 }}>Saved Services</h2>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Shipping options you've bookmarked</p>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 16px", opacity: 0.3 }}>
            <path d="M5 7.8C5 6.12 5 5.28 5.327 4.638C5.615 4.074 6.074 3.615 6.638 3.327C7.28 3 8.12 3 9.8 3H14.2C15.88 3 16.72 3 17.362 3.327C17.927 3.615 18.385 4.074 18.673 4.638C19 5.28 19 6.12 19 7.8V21L12 17L5 21V7.8Z" stroke="#9ca3af" strokeWidth="1.8" />
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>No saved services yet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Click the bookmark icon on any shipping option to save it here</div>
          <button className="ss-btn ss-btn-outline ss-btn-sm" onClick={onNavigateHome}>Search for rates {"\u2192"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px 80px", animation: "fadeIn .3s both" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 4 }}>Saved Services</h2>
      <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>{savedServices.length} saved shipping option{savedServices.length > 1 ? "s" : ""}</p>

      {savedServices.map((item, i) => {
        const tb = TIER_BADGES[item.svc.tier] || TIER_BADGES.STANDARD;
        const bookUrl = item.bookUrl || "#";
        const sub = getSub(item.id);

        return (
          <div key={item.id} style={{
            background: "#fff", border: "1.5px solid #eeeff1", borderRadius: 14,
            padding: "18px 20px", marginBottom: 10,
            animation: `fadeUp .3s ${i * 0.05}s both`,
            transition: "border-color .2s, box-shadow .2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#d0d4e0"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#eeeff1"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Logo name={item.svc.carrier} sz={38} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.svc.name}</span>
                    <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: ".4px", background: tb.bg, color: tb.c, border: `1.5px solid ${tb.b}` }}>{item.svc.tier}</span>
                    {item.svc.guaranteed && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#15803d", background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>{"\u2713"} Guaranteed</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{item.svc.carrier}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>${item.svc.price}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>when saved</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f0f0f2" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>Route</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{item.origin} {"\u2192"} {item.dest}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f0f0f2" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>Packages</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{item.pkgSummary}</div>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f0f0f2" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 2 }}>Est. Delivery</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>{item.svc.transitDays} days {"\u00B7"} {item.svc.date}</div>
              </div>
            </div>

            {/* Notification Subscriptions */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #f0f0f2", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8 }}>Notifications</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                  <input type="checkbox" checked={sub.email} onChange={() => toggleEmail(item.id)}
                    style={{ width: 16, height: 16, accentColor: "#0071e3" }} />
                  {"\uD83D\uDCE7"} Email updates
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                  <input type="checkbox" checked={sub.sms} onChange={() => toggleSms(item.id)}
                    style={{ width: 16, height: 16, accentColor: "#0071e3" }} />
                  {"\uD83D\uDCF1"} SMS updates
                </label>
              </div>
              {sub.sms && (
                <div style={{ marginTop: 8 }}>
                  <input
                    className="ss-inp"
                    type="tel"
                    placeholder="Phone number (e.g. +1 555 123 4567)"
                    value={sub.phone}
                    onChange={e => updatePhone(item.id, e.target.value)}
                    style={{ fontSize: 13, padding: "8px 12px" }}
                  />
                  {sub.phoneErr && (
                    <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 500, marginTop: 4 }}>{"\u26A0"} {sub.phoneErr}</div>
                  )}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#b0b5c0", marginTop: 6 }}>
                Get alerts for price drops, promos, and expiring services
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, color: "#b0b5c0" }}>Saved {item.savedAt}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onRemove(item.id)} style={{ color: "#dc2626", fontSize: 12, border: "1px solid #fecaca", borderRadius: 7, padding: "5px 12px", background: "#fff", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 600 }}>Remove</button>
                <a href={bookUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 16px", borderRadius: 7, background: "#0071e3", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "'Outfit',sans-serif" }}>Book Now {"\u2192"}</a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
