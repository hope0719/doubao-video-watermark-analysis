#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, copyFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_CLI,
  DEFAULT_MODE,
  ERASE_BACKENDS,
  INPAINT_METHODS,
  MARKS,
  MODES,
  buildRemoveAiWatermarksArgs,
  getRemoveAiWatermarksCli,
  isOutputMode,
  normalizeMode,
  sanitizeCliOutput,
} from "../src/transform.js";

const execFileAsync = promisify(execFile);

const USAGE = `declank - wrapper for the remove-ai-watermarks CLI

Usage:
  declank <input> [options] [-- <extra remove-ai-watermarks args>]

Options:
  -o, --output <path>       Output path (default: <input>.clean.<ext>)
  -m, --mode <mode>         ${MODES.join(" | ")} (default: ${DEFAULT_MODE})
      --cli <path>          CLI executable (default: ${DEFAULT_CLI}; env REMOVE_AI_WATERMARKS_CLI)
      --mark <mark>         Visible mark: ${MARKS.join(" | ")}
      --region <x,y,w,h>    Region for erase mode; repeatable
      --backend <backend>   Erase backend: ${ERASE_BACKENDS.join(" | ")}
      --inpaint-method <m>  ${INPAINT_METHODS.join(" | ")}
      --no-inpaint          Disable visible inpaint cleanup where supported
      --no-detect           Force visible removal even when detection is uncertain
      --keep-metadata       Keep metadata where supported
      --strength <n>        Invisible denoising strength
      --steps <n>           Invisible denoising steps
      --pipeline <name>     default | controlnet
      --device <name>       auto | cpu | mps | cuda | xpu
      --humanize <n>        Analog humanizer intensity
      --max-resolution <n>  Cap long side before diffusion
      --min-resolution <n>  Upscale floor before diffusion
      --json                JSON output for identify mode
      --help                Show this help

Examples:
  declank image.png -o clean.png
  declank image.png --mode metadata -o clean.png
  declank image.png --mode all -o clean.png --max-resolution 2048
  declank image.png --mode erase --region 1640,1930,400,100 -o clean.png
`;

function parseArgs(argv) {
  const opts = { regions: [] };
  let input;
  let passthrough = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value == null) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    if (arg === "--") {
      passthrough = argv.slice(i + 1);
      break;
    }

    switch (arg) {
      case "--help":
        opts.help = true;
        break;
      case "-o":
      case "--output":
        opts.output = next();
        break;
      case "-m":
      case "--mode":
        opts.mode = next();
        break;
      case "--cli":
        opts.cli = next();
        break;
      case "--mark":
        opts.mark = next();
        break;
      case "--region":
        opts.regions.push(next());
        break;
      case "--backend":
        opts.backend = next();
        break;
      case "--inpaint-method":
        opts.inpaintMethod = next();
        break;
      case "--inpaint-strength":
        opts.inpaintStrength = Number(next());
        break;
      case "--no-inpaint":
        opts.inpaint = false;
        break;
      case "--inpaint":
        opts.inpaint = true;
        break;
      case "--no-detect":
        opts.detect = false;
        break;
      case "--detect":
        opts.detect = true;
        break;
      case "--keep-metadata":
        opts.stripMetadata = false;
        break;
      case "--strip-metadata":
        opts.stripMetadata = true;
        break;
      case "--check":
        opts.check = true;
        break;
      case "--remove-all":
        opts.keepStandard = false;
        break;
      case "--keep-standard":
        opts.keepStandard = true;
        break;
      case "--strength":
        opts.strength = Number(next());
        break;
      case "--steps":
        opts.steps = Number(next());
        break;
      case "--pipeline":
        opts.pipeline = next();
        break;
      case "--device":
        opts.device = next();
        break;
      case "--seed":
        opts.seed = Number(next());
        break;
      case "--hf-token":
        opts.hfToken = next();
        break;
      case "--humanize":
        opts.humanize = Number(next());
        break;
      case "--max-resolution":
        opts.maxResolution = Number(next());
        break;
      case "--min-resolution":
        opts.minResolution = Number(next());
        break;
      case "--unsharp":
        opts.unsharp = Number(next());
        break;
      case "--controlnet-scale":
        opts.controlnetScale = Number(next());
        break;
      case "--auto":
        opts.auto = true;
        break;
      case "--restore-faces":
        opts.restoreFaces = true;
        break;
      case "--no-restore-faces":
        opts.restoreFaces = false;
        break;
      case "--restore-faces-weight":
        opts.restoreFacesWeight = Number(next());
        break;
      case "--upscaler":
        opts.upscaler = next();
        break;
      case "--adaptive-polish":
        opts.adaptivePolish = true;
        break;
      case "--no-adaptive-polish":
        opts.adaptivePolish = false;
        break;
      case "--no-visible":
        opts.noVisible = true;
        break;
      case "--json":
        opts.json = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (input) throw new Error(`Unexpected extra argument: ${arg}`);
        input = arg;
    }
  }

  opts.passthrough = passthrough;
  return { input, opts };
}

function defaultOutput(input, mode) {
  if (!isOutputMode(mode)) return undefined;
  const ext = extname(input);
  const stem = basename(input, ext);
  return join(dirname(input), `${stem}.clean${ext || ".png"}`);
}

async function exists(path) {
  if (!path) return false;
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    process.stdout.write(USAGE);
    process.exit(2);
  }

  const { input, opts } = parsed;
  const mode = normalizeMode(opts.mode);
  if (opts.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (!input) {
    process.stdout.write(USAGE);
    process.exit(1);
  }

  const output = opts.output || defaultOutput(input, mode);
  const cli = getRemoveAiWatermarksCli(opts.cli);

  try {
    const args = buildRemoveAiWatermarksArgs(input, output, { ...opts, mode });
    const { stdout, stderr } = await execFileAsync(cli, args, {
      maxBuffer: 20 * 1024 * 1024,
    });

    const message = sanitizeCliOutput(`${stdout}\n${stderr}`);
    if (message) process.stderr.write(`${message}\n`);

    if (output && !(await exists(output))) {
      if (mode === "visible") {
        await copyFile(input, output);
        process.stderr.write(
          `remove-ai-watermarks did not write an output; copied original input to ${output}.\n`,
        );
      } else {
        throw new Error(
          `remove-ai-watermarks completed but did not write ${output}.${
            message ? `\n${message}` : ""
          }`,
        );
      }
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `Error: ${cli} was not found. Install remove-ai-watermarks, or set REMOVE_AI_WATERMARKS_CLI to its executable path.`,
      );
    } else {
      const detail = sanitizeCliOutput(err.stderr || err.stdout || err.message);
      console.error(`Error: ${detail || err.message}`);
    }
    process.exit(err.code === "ENOENT" ? 127 : 1);
  }
}

main();
