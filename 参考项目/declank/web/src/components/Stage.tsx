import { useRef } from "react";
import type { Mode, RunState } from "../types";

export interface ResultData {
  url: string;
  ext: string;
  info: string;
  size: number;
  /** precomputed download filename: `{originalName}_clean.{originalExt}` */
  downloadName: string;
}

interface Props {
  state: RunState;
  beforeUrl: string | null;
  result: ResultData | null;
  mode: Mode;
  elapsed: number;
  onCancel: () => void;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function Stage({
  state,
  beforeUrl,
  result,
  mode,
  elapsed,
  onCancel,
}: Props) {
  const shownUrl = result ? result.url : beforeUrl;
  const dlRef = useRef<HTMLAnchorElement>(null);

  return (
    <section className="block">
      {!beforeUrl && (
        <div className="empty">
          <strong>No image loaded</strong>
          Select a PNG, JPEG, or WebP file. Cleaning starts as soon as you
          upload. Hover the result to download it.
        </div>
      )}

      {beforeUrl && (
        <div
          className={`compare${result ? " clickable" : ""}`}
          onClick={result ? () => dlRef.current?.click() : undefined}
        >
          <img
            src={shownUrl ?? undefined}
            alt={result ? "Cleaned result" : "Original image"}
            draggable={false}
          />

          {result && (
            <a
              ref={dlRef}
              className="dl"
              href={result.url}
              download={result.downloadName}
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 4v12" />
                <path d="m6 12 6 6 6-6" />
                <path d="M5 21h14" />
              </svg>
              Download
            </a>
          )}

          {state === "processing" && (
            <div className="overlay">
              <span className="spinner" aria-hidden />
              <div>Cleaning with {mode} mode</div>
              <div className="elapsed" aria-hidden>
                {clock(elapsed)}
              </div>
              <button type="button" className="ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
