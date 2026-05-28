interface StepNumProps { n: string; done?: boolean }
export const StepNum = ({ n, done }: StepNumProps) => (
  <div style={{ width: 24, height: 24, borderRadius: 7, background: done ? "#f0fdf4" : "#f0f5ff", border: `1.5px solid ${done ? "#86efac" : "#bfdbfe"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: done ? "#15803d" : "#0071e3", flexShrink: 0 }}>
    {done ? "✓" : n}
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
