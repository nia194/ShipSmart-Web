interface StepNumProps { n: string; done?: boolean }
export const StepNum = ({ n, done }: StepNumProps) => (
  <div style={{ width: 24, height: 24, borderRadius: 7, background: done ? "#f0fdf4" : "#f0f5ff", border: `1.5px solid ${done ? "#86efac" : "#bfdbfe"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: done ? "#15803d" : "#0071e3", flexShrink: 0 }}>
    {done ? "✓" : n}
  </div>
);

interface PriceBadgeProps { amount: string; label: string }
export const PriceBadge = ({ amount, label }: PriceBadgeProps) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0", animation: "fadeIn .4s both" }}>
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 10, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1.5px solid #bbf7d0" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#15803d" }}>Starting at ${amount}</span>
      <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
    </div>
  </div>
);

interface PriceBreakdownProps {
  breakdown: { shipping: { label: string; amount: number }[]; pickup: { label: string; amount: number }[] } | null;
  total: number;
}

export const PriceBreakdown = ({ breakdown, total }: PriceBreakdownProps) => {
  if (!breakdown) return null;
  const L = ({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: bold ? "none" : "1px solid #f0f0f2" }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 500, color: bold ? "#111827" : "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: amount < 0 ? "#15803d" : bold ? "#111827" : "#374151" }}>
        {amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : amount === 0 ? "Free" : `$${amount.toFixed(2)}`}
      </span>
    </div>
  );
  return (
    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>Shipping</div>
      {breakdown.shipping.map((item, i) => <L key={i} label={item.label} amount={item.amount} />)}
      {breakdown.pickup.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", margin: "10px 0 6px" }}>Pickup</div>
          {breakdown.pickup.map((item, i) => <L key={i} label={item.label} amount={item.amount} />)}
        </>
      )}
      <div style={{ borderTop: "2px solid #e5e7eb", marginTop: 8, paddingTop: 8 }}>
        <L label="Total" amount={total} bold />
      </div>
    </div>
  );
};
