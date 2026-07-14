import { useEffect, useRef, useState } from "react";
import Hero from "./components/Hero";
import Dropzone from "./components/Dropzone";
import ModePicker from "./components/ModePicker";
import ModeOptions from "./components/ModeOptions";
import Stage, { type ResultData } from "./components/Stage";
import { formatSize, transform } from "./lib/api";
import {
  EMPTY_ADVANCED,
  type AdvancedValues,
  type Mode,
  type RunState,
} from "./types";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

// `{originalName}_clean.{originalExt}`, keeping the source extension.
function cleanedName(originalName: string, fallbackExt: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext = dot > 0 ? originalName.slice(dot + 1) : fallbackExt;
  return `${base}_clean.${ext}`;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [advanced, setAdvanced] = useState<AdvancedValues>(EMPTY_ADVANCED);
  const [state, setState] = useState<RunState>("empty");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [over, setOver] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);
  const manualCancel = useRef(false);
  const replaceInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (sourceUrl && URL.revokeObjectURL(sourceUrl)), [sourceUrl]);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  // paste an image anywhere on the page to load it
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) chooseFile(f);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function stopTimer() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }

  // Cleaning is automatic: it runs when a file is loaded, and re-runs whenever
  // the mode or any advanced option changes. A short debounce coalesces rapid
  // changes (e.g. typing in a number field) into a single run.
  useEffect(() => {
    if (!file) return;
    const ctrl = new AbortController();
    abort.current = ctrl;

    const t = window.setTimeout(async () => {
      setError("");
      setResult(null);
      setElapsed(0);
      setState("processing");
      stopTimer();
      timer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);

      try {
        const { blob, info, ext } = await transform(file, mode, advanced, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResult({
          url: URL.createObjectURL(blob),
          info,
          ext,
          size: blob.size,
          downloadName: cleanedName(file.name, ext),
        });
        setState("complete");
      } catch (err) {
        const e = err as Error;
        if (e.name === "AbortError" || ctrl.signal.aborted) {
          if (manualCancel.current) {
            manualCancel.current = false;
            setState("ready");
          }
          return;
        }
        setError(e.message);
        setState("error");
      } finally {
        stopTimer();
      }
    }, 300);

    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [file, mode, advanced]);

  function chooseFile(next: File) {
    if (!ACCEPTED.includes(next.type)) {
      setError("Unsupported file. Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(`That file is ${formatSize(next.size)}. The limit is 25 MB. Try a smaller image.`);
      return;
    }
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    setResult(null);
    setError("");
    setState("ready");
  }

  function cancel() {
    manualCancel.current = true;
    abort.current?.abort();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) chooseFile(f);
  }

  return (
    <div className="page">
      <Hero />

      <section
        className={`card${over ? " over" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setOver(false);
        }}
        onDrop={onDrop}
      >
        <ModePicker mode={mode} onChange={setMode} />

        <div className="card-body">
          {error && (
            <p className="block error" role="alert">
              {error}
            </p>
          )}

          {!file ? (
            <Dropzone onSelect={chooseFile} />
          ) : (
            <>
              <Stage
                state={state}
                beforeUrl={sourceUrl}
                result={result}
                mode={mode}
                elapsed={elapsed}
                onCancel={cancel}
              />

              <ModeOptions mode={mode} values={advanced} onChange={(patch) => setAdvanced((v) => ({ ...v, ...patch }))} />

              <p className="swap">
                <button type="button" onClick={() => replaceInput.current?.click()}>
                  Replace image
                </button>{" "}
                or drop / paste to load another.
              </p>
            </>
          )}
        </div>
      </section>

      <input
        ref={replaceInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) chooseFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
