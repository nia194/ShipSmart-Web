import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { filterCities } from "@/lib/shipping-data";

interface CityInputProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (city: string) => void;
  placeholder: string;
  icon: string;
  inputRef?: RefObject<HTMLInputElement>;
}

export const CityInput = ({
  value,
  onChange,
  onSelect,
  placeholder,
  icon,
  inputRef,
}: CityInputProps) => {
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);

  const suggestions = useMemo(() => {
    return focused ? filterCities(value) : [];
  }, [value, focused]);

  const finalInputRef = inputRef ?? internalInputRef;
  const showSuggestions = focused && suggestions.length > 0;

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleClear = () => {
    onChange("");
    setFocused(true);
    setTimeout(() => {
      finalInputRef.current?.focus();
    }, 0);
  };

  const handleSelect = (city: string) => {
    onSelect(city);
    setFocused(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", flex: 1 }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 16,
            color: focused ? "#2563eb" : "#9ca3af",
            pointerEvents: "none",
          }}
        >
          {icon}
        </span>

        <input
          ref={finalInputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions.length > 0) {
              event.preventDefault();
              handleSelect(suggestions[0]);
            }

            if (event.key === "Escape") {
              setFocused(false);
            }
          }}
          className="ss-inp"
          style={{
            width: "100%",
            paddingLeft: 40,
            paddingRight: value ? 42 : 14,
            height: 52,
            borderRadius: 12,
            border: focused ? "1px solid #e5e7eb" : "1px solid #d1d5db",
            boxShadow: focused
              ? "0 12px 34px rgba(15, 23, 42, 0.14)"
              : "none",
            transition: "all 0.2s ease",
            background: "#ffffff",
          }}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear location"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "#111827",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          style={{
            position: "absolute",
            top: 66,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "#ffffff",
            borderRadius: 28,
            boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
            border: "1px solid #f1f5f9",
            padding: "18px 0",
            overflow: "hidden",
          }}
        >
          {suggestions.map((city) => (
            <button
              key={city}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(city);
              }}
              style={{
                width: "100%",
                border: "none",
                background: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "12px 32px",
                fontFamily: "inherit",
                textAlign: "left",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#ffffff";
              }}
            >
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "#f4f4f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LocationPinIcon />
              </span>

              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                {city}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function LocationPinIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#111827"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}