# Declank (`declank`)

A small Node wrapper around the
[`remove-ai-watermarks`](https://github.com/wiltodelta/remove-ai-watermarks)
CLI, plus a web UI that shells out through the local `declank` command.

The Node project does not remove watermarks itself. It stages uploads in a temp
directory, invokes the external CLI with whitelisted arguments, and streams the
result back for preview and download.

## Prerequisites

Install the Python CLI first:

```bash
pipx install git+https://github.com/wiltodelta/remove-ai-watermarks.git
# or
uv tool install git+https://github.com/wiltodelta/remove-ai-watermarks.git
```

The wrapper expects the executable to be named `remove-ai-watermarks`. If it is
installed somewhere else, set:

```bash
export REMOVE_AI_WATERMARKS_CLI=/path/to/remove-ai-watermarks
```

Visible watermark removal and metadata stripping run on CPU. Invisible watermark
removal depends on the upstream CLI's optional GPU dependencies.

## Install

```bash
npm install
```

## CLI

```bash
node bin/imgx.js <input> [options]
# or, after `npm link`: declank <input> [options]
```

`clearframe` and `imgx` are still published as legacy aliases.

Options:

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output path (default: `<input>.clean.<ext>`) |
| `-m, --mode <mode>` | `visible` \| `metadata` \| `invisible` \| `all` \| `erase` \| `identify` |
| `--mark <mark>` | `auto` \| `gemini` \| `doubao` \| `jimeng` \| `samsung` |
| `--region <x,y,w,h>` | Region for `erase` mode; repeatable |
| `--backend <backend>` | `cv2` \| `lama` for `erase` mode |
| `--strength <n>` | Invisible watermark denoising strength |
| `--steps <n>` | Invisible watermark denoising steps |
| `--pipeline <name>` | `default` \| `controlnet` |
| `--device <name>` | `auto` \| `cpu` \| `mps` \| `cuda` \| `xpu` |
| `--max-resolution <px>` | Cap long side before diffusion |
| `--json` | JSON output for `identify` mode |

Examples:

```bash
declank image.png -o clean.png
declank image.png --mode metadata -o clean.png
declank image.png --mode all -o clean.png --max-resolution 2048
declank image.png --mode erase --region 1640,1930,400,100 -o clean.png
declank image.png --mode identify --json
```

Pass extra upstream CLI flags after `--`:

```bash
declank image.png --mode invisible -o clean.png -- --auto --restore-faces
```

## Web UI

```bash
npm start             # http://localhost:3333
PORT=8080 npm start   # custom port
```

The web UI supports PNG, JPEG, and WebP uploads up to 25 MB. It exposes these
modes:

| Mode | Upstream command |
|------|------------------|
| Visible marks | `remove-ai-watermarks visible` |
| Metadata only | `remove-ai-watermarks metadata --remove` |
| All signals | `remove-ai-watermarks all` |
| Invisible marks | `remove-ai-watermarks invisible` |

Set `DECLANK_TIMEOUT_MS` if invisible or all-signal processing needs more
than the default 10 minute server timeout. `CLEARFRAME_TIMEOUT_MS` and
`IMGX_TIMEOUT_MS` are still supported.

## Local development

```bash
npm run dev:all   # Vite (web) + the API server, with hot reload
npm run build     # build the static UI into dist/
npm start         # serve the built dist/ + API at http://localhost:3333
```

## Deploy (Cloudflare Pages + Tunnel)

The watermark model is heavy Python/ML and cannot run on Cloudflare's edge, so
the static UI goes on **Cloudflare Pages** and the backend runs on a machine you
control, exposed through a **Cloudflare Tunnel**. A Pages Function
(`functions/api/transform.js`) proxies `/api/transform` to that backend, so the
browser only ever talks to your own origin.

**1. Frontend on Cloudflare Pages** (connect this GitHub repo, or `wrangler pages deploy`):

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `BACKEND_URL = https://api.YOUR-DOMAIN.com`

**2. Backend on your machine** (must have `remove-ai-watermarks` installed):

```bash
node server.js            # API on :3333
```

**3. Expose it with a tunnel** (see `deploy/cloudflared.config.example.yml`):

```bash
cloudflared tunnel login
cloudflared tunnel create declank-api
cloudflared tunnel route dns declank-api api.YOUR-DOMAIN.com
cloudflared tunnel run declank-api
```

Note: Cloudflare's edge times out a request after ~100s, and that limit can't be
raised. If CPU cleaning is slower than that, the request will fail with a 524, so
prefer a GPU device for the web path.

## Architecture

```text
web/                Vite + React UI (builds to dist/)
functions/api/      Cloudflare Pages Function: proxies /api/transform -> BACKEND_URL
server.js           Express; POST /api/transform -> execFile(node bin/imgx.js)
bin/imgx.js         local wrapper around remove-ai-watermarks
src/transform.js    shared mode validation and CLI argument builder
```

Use this only on files you have the rights and permissions to process, and make
sure downstream use complies with applicable laws and platform terms.
