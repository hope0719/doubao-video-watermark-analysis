import { useRef } from "react";
import { MODES, type Mode } from "../types";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export default function ModePicker({ mode, onChange }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = MODES.find((m) => m.id === mode)!;

  function onKeyDown(e: React.KeyboardEvent) {
    const i = MODES.findIndex((m) => m.id === mode);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (i - 1 + MODES.length) % MODES.length;
    if (next < 0) return;
    e.preventDefault();
    onChange(MODES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <>
      <div
        className="tabs"
        role="radiogroup"
        aria-label="Cleanup mode"
        onKeyDown={onKeyDown}
      >
        {MODES.map((m, i) => (
          <button
            key={m.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="tab"
            role="radio"
            aria-checked={m.id === mode}
            tabIndex={m.id === mode ? 0 : -1}
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </>
  );
}
