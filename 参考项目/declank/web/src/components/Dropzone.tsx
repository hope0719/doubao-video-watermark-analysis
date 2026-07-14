import { useRef } from "react";

interface Props {
  onSelect: (file: File) => void;
}

export default function Dropzone({ onSelect }: Props) {
  const input = useRef<HTMLInputElement>(null);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (f) onSelect(f);
  }

  return (
    <>
      <div className="uploader">
        <button type="button" className="upload-btn" onClick={() => input.current?.click()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4" />
            <path d="m6 10 6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
          Upload image
        </button>
        <p className="upload-help">
          Drop an image here or paste with <kbd>Ctrl</kbd> + <kbd>V</kbd>
        </p>
      </div>

      <div className="card-foot">
        <span>Up to 25 MB</span>
        <span className="chips" aria-label="Supported formats">
          <span className="chip">png</span>
          <span className="chip">jpg</span>
          <span className="chip">webp</span>
        </span>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => pick(e.target.files)}
      />
    </>
  );
}
