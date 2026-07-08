// src/components/home/MiniAssistantPill.tsx

import { useEffect, useRef, useState } from "react";

const ROTATING_PROMPTS = [
  "Cheapest shipping option from Atlanta to New York",
  "Compare fastest vs cheapest delivery",
  "Help me choose the safest carrier",
  "Can I ship electronics internationally?",
];

const ASSISTANT_OPTIONS = [
  {
    title: "Find cheapest option",
    subtitle: "Compare carriers by lowest total cost",
  },
  {
    title: "Compare speed vs price",
    subtitle: "See what you gain or lose with each option",
  },
  {
    title: "Check delivery risk",
    subtitle: "Understand if your deadline is realistic",
  },
  {
    title: "Help fill package details",
    subtitle: "Get help with weight, size, and package type",
  },
  {
    title: "Ask about restricted items",
    subtitle: "Check batteries, electronics, liquids, and fragile items",
  },
];

export default function MiniAssistantPill() {
  const [open, setOpen] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) return;

    const interval = window.setInterval(() => {
      setPromptIndex((current) => (current + 1) % ROTATING_PROMPTS.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;

      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const pillText =
    selectedPrompt || ROTATING_PROMPTS[promptIndex] || "Ask ShipSmart AI";

  return (
    <div
      ref={rootRef}
      className={`ss-ai-launcher ${open ? "is-open" : ""}`}
    >
      <div className="ss-ai-menu" aria-hidden={!open}>
        <div className="ss-ai-menu-header">
          <div>
            <div className="ss-ai-menu-kicker">ShipSmart AI</div>
            <h3>What do you want help with?</h3>
          </div>

          <button
            type="button"
            className="ss-ai-menu-close"
            onClick={() => setOpen(false)}
            aria-label="Close assistant suggestions"
          >
            ×
          </button>
        </div>

        <div className="ss-ai-option-list">
          {ASSISTANT_OPTIONS.map((option) => (
            <button
              key={option.title}
              type="button"
              className="ss-ai-option"
              onClick={() => {
                setSelectedPrompt(option.title);
                setOpen(false);
              }}
            >
              <span className="ss-ai-option-icon">✦</span>

              <span className="ss-ai-option-copy">
                <strong>{option.title}</strong>
                <span>{option.subtitle}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="ss-ai-menu-footer">
          <span>Pick a suggestion now. We can wire it to the full assistant later.</span>
        </div>
      </div>

      <button
        type="button"
        className="ss-ai-pill"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open ShipSmart assistant"
      >
        <span className="ss-ai-spark">✦</span>

        <span className="ss-ai-pill-text">{pillText}</span>

        <span className={`ss-ai-pill-chevron ${open ? "open" : ""}`}>
          ↑
        </span>
      </button>
    </div>
  );
}