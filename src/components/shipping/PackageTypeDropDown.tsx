import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PKG_TYPES } from "@/lib/shipping-data";

interface PackageTypeDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function PackageTypeDropdown({
  value,
  onChange,
}: PackageTypeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = PKG_TYPES.find((pkg) => pkg.id === value) ?? PKG_TYPES[0];

  const updateMenuPosition = useCallback(() => {
    if (!rootRef.current) return;

    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;

    setMenuPosition({
      top: rect.bottom - 1,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(260, Math.min(460, spaceBelow)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      const clickedTrigger = rootRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <>
      <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
            borderRadius: open ? "12px 12px 0 0" : 12,
            border: open ? "2px solid #2563eb" : "1px solid #d1d5db",
            background: open ? "#eef7ff" : "#ffffff",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            transition: "all 0.2s ease",
          }}
        >
          <PackageImage pkg={selected} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.25,
              }}
            >
              {selected.title ?? selected.label}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#8b95a1",
                marginTop: 4,
                lineHeight: 1.35,
              }}
            >
              {selected.subtitle ?? selected.label}
            </div>
          </div>

          <span
            style={{
              fontSize: 14,
              color: "#374151",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            ▾
          </span>
        </button>
      </div>

      {open &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
              overflowY: "auto",
              zIndex: 999999,
              border: "2px solid #2563eb",
              borderTop: "none",
              borderRadius: "0 0 12px 12px",
              background: "#ffffff",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
            }}
          >
            {PKG_TYPES.map((pkg) => {
              const active = pkg.id === value;

              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    onChange(pkg.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    border: "none",
                    borderBottom: "1px solid #d1d5db",
                    background: active ? "#eaf4ff" : "#ffffff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <PackageImage pkg={pkg} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#111827",
                        lineHeight: 1.25,
                      }}
                    >
                      {pkg.title ?? pkg.label}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#8b95a1",
                        marginTop: 4,
                        lineHeight: 1.35,
                      }}
                    >
                      {pkg.subtitle ?? pkg.label}
                    </div>
                  </div>

                  {active && (
                    <span
                      style={{
                        color: "#2563eb",
                        fontSize: 18,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

function PackageImage({
  pkg,
}: {
  pkg: {
    image?: string;
    icon: string;
    label: string;
  };
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!pkg.image || imageFailed) {
    return (
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 10,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          flexShrink: 0,
        }}
      >
        {pkg.icon}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 58,
        height: 58,
        borderRadius: 10,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={pkg.image}
        alt={pkg.label}
        onError={() => setImageFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          padding: 6,
        }}
      />
    </div>
  );
}