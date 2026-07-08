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
  onChange: (value: string) => void;
  onSelect: (city: string) => void;
  placeholder: string;
  icon: string;
  inputRef?: RefObject<HTMLInputElement | null>;
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

  const finalInputRef = inputRef ?? internalInputRef;

  const suggestions = useMemo(() => {
    return focused ? filterCities(value) : [];
  }, [value, focused]);

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
            borderRadius: focused ? 999 : 12,
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
            top: 58,
            left: 0,
            right: 0,
            zIndex: 100,
            borderRadius: 18,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
          }}
        >
          {suggestions.slice(0, 6).map((city) => (
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
                padding: "12px 14px",
                textAlign: "left",
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#ffffff";
              }}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
