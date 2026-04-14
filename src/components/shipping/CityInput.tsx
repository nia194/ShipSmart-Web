import { useState, useEffect, useRef, type RefObject } from "react";
import { filterCities } from "@/lib/shipping-data";

interface CityInputProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (city: string) => void;
  placeholder: string;
  icon: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onBlurExtra?: () => void;
}

export const CityInput = ({ value, onChange, onSelect, placeholder, icon, inputRef, onBlurExtra }: CityInputProps) => {
  const [sug, setSug] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const wr = useRef<HTMLDivElement>(null);

  useEffect(() => { setSug(focused ? filterCities(value) : []); }, [value, focused]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wr.current && !wr.current.contains(e.target as Node)) setFocused(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wr} style={{ flex: 1, position: "relative", zIndex: focused ? 60 : 1 }}>
      <span style={{ position: "absolute", left: 12, top: 12, fontSize: 13, color: "#9ca3af", zIndex: 1, pointerEvents: "none" }}>{icon}</span>
      <input
        ref={inputRef}
        className="ss-inp ss-inp-icon"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setTimeout(() => { setFocused(false); onBlurExtra?.(); }, 180); }}
        onKeyDown={e => {
          if (e.key === "Enter" && sug.length) { onSelect(sug[0]); setFocused(false); }
          else if (e.key === "Enter") onBlurExtra?.();
        }}
      />
      {sug.length > 0 && focused && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", borderRadius: 12, border: "1.5px solid #e5e7eb", boxShadow: "0 12px 40px rgba(0,0,0,.15)", zIndex: 999, overflow: "hidden" }}>
          {sug.map((c, i) => (
            <div key={i} onMouseDown={e => { e.preventDefault(); onSelect(c); setFocused(false); }}
              style={{ padding: "11px 16px", fontSize: 14, color: "#374151", cursor: "pointer", borderBottom: i < sug.length - 1 ? "1px solid #f5f5f5" : "none", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f5ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >
              <span style={{ color: "#0071e3", fontSize: 12 }}>📍</span>{c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
