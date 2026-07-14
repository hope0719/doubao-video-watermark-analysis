import type { AdvancedValues, Mode } from "../types";

export interface TransformResult {
  blob: Blob;
  info: string;
  ext: string;
}

const OPTION_KEYS: (keyof AdvancedValues)[] = [
  "mark",
  "strength",
  "steps",
  "maxResolution",
  "humanize",
  "pipeline",
  "device",
];

export async function transform(
  file: File,
  mode: Mode,
  options: AdvancedValues,
  signal: AbortSignal,
): Promise<TransformResult> {
  const form = new FormData();
  form.append("image", file);
  form.append("mode", mode);
  for (const key of OPTION_KEYS) {
    const value = options[key];
    if (value) form.append(key, value);
  }

  const res = await fetch("/api/transform", { method: "POST", body: form, signal });
  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(json.error || "Transform failed.");
  }

  const blob = await res.blob();
  const type = res.headers.get("Content-Type") || "image/png";
  const ext = type.includes("jpeg") ? "jpg" : type.split("/")[1] || "png";
  const info = res.headers.get("X-Transform-Info") || "";
  return { blob, info, ext };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
