export const DEFAULT_CLI = "remove-ai-watermarks";
export const DEFAULT_MODE = "visible";

export const OUTPUT_MODES = ["visible", "metadata", "invisible", "all", "erase"];
export const REPORT_MODES = ["identify"];
export const MODES = [...OUTPUT_MODES, ...REPORT_MODES];
export const WEB_MODES = ["visible", "metadata", "all", "invisible"];
export const MARKS = ["auto", "gemini", "doubao", "jimeng", "samsung"];
export const PIPELINES = ["default", "controlnet"];
export const DEVICES = ["auto", "cpu", "mps", "cuda", "xpu"];
export const ERASE_BACKENDS = ["cv2", "lama"];
export const INPAINT_METHODS = ["ns", "telea", "gaussian"];

export const SUPPORTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export const EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function getRemoveAiWatermarksCli(override) {
  return override || process.env.REMOVE_AI_WATERMARKS_CLI || DEFAULT_CLI;
}

export function isOutputMode(mode) {
  return OUTPUT_MODES.includes(mode);
}

export function isWebMode(mode) {
  return WEB_MODES.includes(mode);
}

export function normalizeMode(mode) {
  return mode || DEFAULT_MODE;
}

export function isSupportedImageExtension(ext) {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(String(ext || "").toLowerCase());
}

export function extensionFromUpload(file) {
  const fromName = file?.originalname?.split(".").pop()?.toLowerCase();
  if (isSupportedImageExtension(fromName)) return fromName;
  return EXTENSION_BY_MIME[file?.mimetype] || "png";
}

export function mimeForExtension(ext) {
  return MIME_BY_EXTENSION[String(ext || "").toLowerCase()] || "application/octet-stream";
}

export function parsePositiveInt(value, name) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return n;
}

export function parseNumber(value, name) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`${name} must be a number.`);
  }
  return n;
}

export function sanitizeCliOutput(output) {
  return String(output || "")
    .replace(/[^\x20-\x7E\r\n\t]/g, "")
    .replace(/\r/g, "")
    .trim();
}

export function buildRemoveAiWatermarksArgs(input, output, opts = {}) {
  const mode = normalizeMode(opts.mode);
  if (!MODES.includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}. Use one of: ${MODES.join(", ")}`);
  }

  const args = [mode, input];
  if (isOutputMode(mode) && mode !== "erase" && output) {
    args.push("-o", output);
  }

  switch (mode) {
    case "visible":
      appendChoice(args, "--mark", opts.mark, MARKS);
      appendBooleanPair(args, opts.inpaint, "--inpaint", "--no-inpaint");
      appendChoice(args, "--inpaint-method", opts.inpaintMethod, INPAINT_METHODS);
      appendNumber(args, "--inpaint-strength", opts.inpaintStrength);
      appendBooleanPair(args, opts.detect, "--detect", "--no-detect");
      appendBooleanPair(args, opts.stripMetadata, "--strip-metadata", "--keep-metadata");
      break;
    case "metadata":
      if (opts.check) args.push("--check");
      args.push("--remove");
      appendBooleanPair(args, opts.keepStandard, "--keep-standard", "--remove-all");
      break;
    case "invisible":
      appendInvisibleOptions(args, opts);
      break;
    case "all":
      appendBooleanPair(args, opts.inpaint, "--inpaint", "--no-inpaint");
      appendChoice(args, "--inpaint-method", opts.inpaintMethod, INPAINT_METHODS);
      appendInvisibleOptions(args, opts);
      break;
    case "erase":
      if (output) args.push("-o", output);
      if (!opts.regions?.length) {
        throw new Error("erase mode requires at least one --region x,y,w,h option.");
      }
      for (const region of opts.regions) args.push("--region", region);
      appendChoice(args, "--backend", opts.backend, ERASE_BACKENDS);
      appendChoice(args, "--inpaint-method", opts.inpaintMethod, INPAINT_METHODS);
      appendNumber(args, "--dilate", opts.dilate);
      appendBooleanPair(args, opts.stripMetadata, "--strip-metadata", "--keep-metadata");
      break;
    case "identify":
      if (opts.noVisible) args.push("--no-visible");
      if (opts.json) args.push("--json");
      break;
  }

  if (opts.passthrough?.length) args.push(...opts.passthrough);
  return args;
}

function appendInvisibleOptions(args, opts) {
  appendNumber(args, "--strength", opts.strength);
  appendNumber(args, "--steps", opts.steps);
  appendChoice(args, "--pipeline", opts.pipeline, PIPELINES);
  appendChoice(args, "--device", opts.device, DEVICES);
  appendNumber(args, "--seed", opts.seed);
  appendValue(args, "--hf-token", opts.hfToken);
  appendNumber(args, "--humanize", opts.humanize);
  appendNumber(args, "--max-resolution", opts.maxResolution);
  appendNumber(args, "--min-resolution", opts.minResolution);
  appendNumber(args, "--unsharp", opts.unsharp);
  appendNumber(args, "--controlnet-scale", opts.controlnetScale);
  if (opts.auto) args.push("--auto");
  appendBooleanPair(args, opts.restoreFaces, "--restore-faces", "--no-restore-faces");
  appendNumber(args, "--restore-faces-weight", opts.restoreFacesWeight);
  appendChoice(args, "--upscaler", opts.upscaler, ["lanczos", "esrgan"]);
  appendBooleanPair(args, opts.adaptivePolish, "--adaptive-polish", "--no-adaptive-polish");
}

function appendValue(args, flag, value) {
  if (value != null && value !== "") args.push(flag, String(value));
}

function appendNumber(args, flag, value) {
  if (value != null && value !== "") args.push(flag, String(value));
}

function appendChoice(args, flag, value, allowed) {
  if (value == null || value === "") return;
  if (!allowed.includes(value)) {
    throw new Error(`${flag} must be one of: ${allowed.join(", ")}`);
  }
  args.push(flag, value);
}

function appendBooleanPair(args, value, trueFlag, falseFlag) {
  if (value === true) args.push(trueFlag);
  if (value === false) args.push(falseFlag);
}
