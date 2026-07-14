import express from "express";
import multer from "multer";
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  DEVICES,
  MARKS,
  PIPELINES,
  WEB_MODES,
  extensionFromUpload,
  isSupportedImageExtension,
  isWebMode,
  mimeForExtension,
  parseNumber,
  parsePositiveInt,
  sanitizeCliOutput,
} from "./src/transform.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const WRAPPER_CLI = join(__dirname, "bin", "imgx.js");
const DIST_DIR = join(__dirname, "dist");
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Serve the built Vite app. In development, run `npm run dev` (Vite on :5173)
// which proxies /api here; in production, `npm run build` writes ./dist.
app.use(express.static(DIST_DIR));

app.post("/api/transform", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });

  let dir;
  try {
    const mode = req.body.mode || "visible";
    if (!isWebMode(mode)) {
      return res.status(400).json({ error: `Unsupported mode: ${mode}. Use one of: ${WEB_MODES.join(", ")}` });
    }

    const ext = extensionFromUpload(req.file);
    if (!isSupportedImageExtension(ext)) {
      return res.status(400).json({ error: "Supported uploads are PNG, JPEG, and WebP images." });
    }

    dir = await mkdtemp(join(tmpdir(), "declank-"));
    const inputPath = join(dir, `input.${ext}`);
    const outputPath = join(dir, `output.${ext}`);
    await writeFile(inputPath, req.file.buffer);

    const args = [WRAPPER_CLI, inputPath, "-o", outputPath, "--mode", mode];
    appendChoice(args, "--mark", req.body.mark, MARKS);
    appendChoice(args, "--pipeline", req.body.pipeline, PIPELINES);
    appendChoice(args, "--device", req.body.device, DEVICES);
    appendNumber(args, "--strength", parseNumber(req.body.strength, "strength"));
    appendNumber(args, "--steps", parsePositiveInt(req.body.steps, "steps"));
    appendNumber(args, "--humanize", parseNumber(req.body.humanize, "humanize"));
    appendNumber(args, "--max-resolution", parsePositiveInt(req.body.maxResolution, "maxResolution"));
    appendNumber(args, "--min-resolution", parsePositiveInt(req.body.minResolution, "minResolution"));

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      timeout: Number(process.env.DECLANK_TIMEOUT_MS || process.env.CLEARFRAME_TIMEOUT_MS || process.env.IMGX_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      maxBuffer: 20 * 1024 * 1024,
    });

    const out = await readFile(outputPath);
    const info = sanitizeCliOutput(`${stdout}\n${stderr}`).replace(/\n+/g, " | ");
    if (info) res.set("X-Transform-Info", info.slice(0, 2048));
    res.set("Content-Type", mimeForExtension(ext));
    res.send(out);
  } catch (err) {
    const detail = sanitizeCliOutput(err.stderr || err.stdout || err.message);
    const message =
      err.code === "ENOENT"
        ? "remove-ai-watermarks was not found. Install it with pipx or uv, or set REMOVE_AI_WATERMARKS_CLI."
        : detail || "Image transform failed.";
    res.status(500).json({ error: message });
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

function appendChoice(args, flag, value, allowed) {
  if (value == null || value === "") return;
  if (!allowed.includes(value)) {
    throw new Error(`${flag} must be one of: ${allowed.join(", ")}`);
  }
  args.push(flag, value);
}

function appendNumber(args, flag, value) {
  if (value != null) args.push(flag, String(value));
}

// SPA fallback: serve the built index.html for any non-API route.
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(join(DIST_DIR, "index.html"), (err) => {
    if (err) res.status(404).send("Build missing. Run `npm run build` first.");
  });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Declank running -> http://localhost:${PORT}`);
});
