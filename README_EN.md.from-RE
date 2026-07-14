# Doubao Video Watermark Removal — Deep Technical Analysis

> **🎯 Search keywords: doubao watermark remover · ByteDance video watermark · doubao no watermark · get_play_info · video watermark bypass · CDN watermark analysis · H.264 watermark embedding · douyin watermark removal**

> **⚠️ Key Finding: Doubao video watermarks CANNOT be removed via client-side techniques.**
>
> This project documents our complete technical investigation into removing watermarks from ByteDance's **Doubao (Doubao.com)** AI-generated videos.
> After systematic testing (17 API endpoints, 15 open-source projects analyzed, exhaustive CDN parameter manipulation, logged-in vs. anonymous comparison),
> **we conclusively found that Doubao video watermarks are embedded at the pixel level during server-side H.264 encoding — not added dynamically by CDN, nor controlled by URL parameters.**

---

## Table of Contents

- [Background](#background)
- [Core Conclusion](#core-conclusion)
- [Exploration Overview](#exploration-overview)
- [Exploration Details](#exploration-details)
- [Key Evidence](#key-evidence)
- [Why All Open-Source Projects Failed](#why-all-open-source-projects-failed)
- [Image Watermark Removal Still Works](#image-watermark-removal-still-works)
- [Running the Test Script](#running-the-test-script)
- [Search Tags](#search-tags)
- [License](#license)

---

## Background

**Doubao watermark removal** is a common need among AI content creators. Doubao (doubao.com) is ByteDance's AI-powered platform for conversation and content generation, supporting AI-generated videos and images. Generated videos come with a "Doubao AI" watermark by default, and many users seek methods to remove it.

In WeChat mini-programs and browser extensions, we attempted to obtain watermark-free versions through Doubao's public APIs. However, starting from a certain point, **all API responses returned watermarked videos**.

## Core Conclusion

```
AI Generation (original watermark-free frames)
    → H.264 Encoding (watermark embedded into every pixel frame)
    → TOS Object Storage (only one watermarked copy stored)
    → CDN Distribution (all URL parameters are cache signatures, content unaffected)
    → Client Download (file inherently contains watermark)
```

**The watermark is embedded at the encoding stage. CDN stores only one file. There is no URL parameter or API switch that can bypass it.**

## Exploration Overview

Our investigation went through three phases before reaching the final conclusion:

### Phase 1: Code Fixes (thinking it was a frontend bug)

| Version | Attempt | Result |
|:-------:|---------|:------:|
| v1.0 | Edge browser extension: inject.js API interception | Interception failed |
| v1.1-v1.2 | chat page multi-strategy + CDN domain transform | chat unsupported + 403 |
| v1.3 | Align with mini-program: vid → `get_play_info` API | **Still watermarked** |
| v1.4-v1.6 | Multi-video support + DOM association matching | Timing issues |
| v1.8-v1.9 | Regression + poster matching + periodic retry | **Still watermarked** |

> We spent months iterating 20+ versions fixing frontend matching issues, but the root cause was never in the frontend.

### Phase 2: API Exploration (thinking there were hidden parameters)

- Tested 17 API endpoints (`get_play_info`, `get_video_share_info`, `watermark_download`, etc.)
- Tested URL parameter manipulation (lr, ft, cs, cr, dr, download, btag, feature_id... 15+ parameters)
- Tested logged-in vs. anonymous comparison
- **All returned the same watermarked file**

### Phase 3: Open-Source Project Research

Downloaded and analyzed **15 related open-source projects** from GitHub, testing each one:

| Project | ⭐ | Method | Working? |
|:--------|:-:|:-------|:--------:|
| catscarlet video-sharing remover | — | `get_play_info` + credentials | ❌ |
| xiaoka6688 AI watermark remover | — | Changed `lr=no_watermark` | ❌ |
| Luncot Doubao downloader plus | 5 | Same as above | ❌ |
| wan-kong Doubao online tool | — | `get_video_share_info` + WeChat UA | ❌ |
| gosick233-cloud Doubao free | — | Changed `lr=no_watermark` | ❌ |
| huige-opc watermark vanish | — | `get_play_info` + credentials | ❌ |
| ihmily mark-free Doubao | — | `get_play_info` + credentials | ❌ |
| Qalxry Doubao watermark-free | **⭐149** | **Images only, no video** | ✅ Images |
| doubao-no-watermark | — | Same as above | ❌ |
| 6 other projects | — | Various methods | ❌ |

**All video watermark removal projects have failed.** Currently working projects are image-only.

## Exploration Details

Full analysis documents:

### Analysis Reports

- **[analysis/technical-report.md](analysis/technical-report.md)** — Complete technical analysis (17 API endpoints, CDN signature mechanism, 15 open-source project comparison)
- **[analysis/doubao-video-watermark-analysis.md](analysis/doubao-video-watermark-analysis.md)** — Initial analysis report (3 implementation approaches: UserScript, Python crawler, WeChat mini-program)
- **[analysis/final-report.md](analysis/final-report.md)** — Final comprehensive report (3 rounds of deep validation, 100% confirmed no client-side access to watermark-free video)
- **[analysis/troubleshooting-log.md](analysis/troubleshooting-log.md)** — Full investigation log (all test data, URL parameter manipulation matrix, version history)
- **[analysis/find-miniprogram-api.md](analysis/find-miniprogram-api.md)** — Mini-program API capture guide (how to find the real API that returns `lr=unwatermarked` URLs using Charles/Stream)

## Key Evidence

### Evidence 1: `original_media_info` No Longer Works

Historically, `POST /samantha/media/get_play_info` response field `original_media_info.main_url` returned a **watermark-free** `videoweb.doubao.com` URL. Now it is **identical** to `media_info[0].main_url`:

```json
{
  "media_info": [{
    "main_url": "https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn"
  }],
  "original_media_info": {
    "main_url": "https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn"  // identical
  }
}
```

### Evidence 2: No URL Parameter Affects File Content

CDN URL parameter manipulation results for test video `v0269cg10004d946i5iljhtf2dunr5e0`:

| Test | Modification | etag | content-length | Watermark |
|:----|:----------:|:---:|:-------------:|:--------:|
| Original URL | None | `5bd9650c...` | 843,802 | ✅ |
| Removed `lr` | Deleted | `5bd9650c...` | 843,802 | ✅ |
| `lr=none` | Replaced | `5bd9650c...` | 843,802 | ✅ |
| Removed `ft` | Deleted | `5bd9650c...` | 843,802 | ✅ |
| `ft=AAAA` | Random value | `5bd9650c...` | 843,802 | ✅ |
| Removed `download` | Deleted | `5bd9650c...` | 843,802 | ✅ |
| Changed `cr=7&dr=3&cs=4` | Replaced | `5bd9650c...` | 843,802 | ✅ |

**Proof: CDN stores only one file. All parameters are cache signatures, not content controls.**

### Evidence 3: Login State Does Not Help

Using Playwright in an authenticated browser context:
- `credentials: 'include'` API call → Same URL as anonymous
- Creator download button click → Same URL
- JS bundle search for `watermark` → No client-side control logic

### Evidence 4: ByteDance MUST Have the Original Files

Logical inference:

1. **AI models generate raw frames**, watermark is post-processed
2. **Creators need watermark-free versions** for Douyin/Xiaohongshu/Bilibili
3. **Business logic requires** the platform to provide watermark-free export

The original files are likely on internal creator service chains (requiring OAuth + creator permissions), **not on public APIs**.

## Why All Open-Source Projects Failed

Core reason: **ByteDance's (Doubao + Douyin) video watermarking is industrial-grade.**

1. Not frontend overlay → DOM manipulation can't bypass
2. Not edge-added → CDN parameter manipulation is useless
3. Not URL-branched → Different domains return the same file
4. **Encoding-embedded → pixel-level, bound to the file**

Previous success (v7-v8 era) was likely due to:
- CDN old nodes or old encoders not properly adding watermarks
- ByteDance later fixed the issue
- **Earlier "success" was a bug, not a feature**

## Image Watermark Removal Still Works

**This project's analysis applies to video only. Image watermark removal is fully functional!**

- Gallery pages return `rc_gen_image/{32-char-md5}` paths that are **watermark-free original images**
- The ⭐149 [Qalxry/doubao-no-watermark](https://github.com/Qalxry/doubao-no-watermark) project on GitHub is a pure image solution that still works
- Canvas merge-based image watermark removal is also viable

## Running the Test Script

### Core Validation

```bash
# Install dependencies
pip install httpx

# Run test (verify API returns watermarked video)
cd proof/
python3 test_api.py <video_id>
```

Example output:
```
API:  /samantha/media/get_play_info
URL:  https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn
Size: 843,802 bytes
Etag: 5bd9650c...
⚠️  Watermark: DETECTED (lr=video_gen_watermark_dyn)
```

### Analysis Tools (`tools/`)

We provide **19 Python analysis scripts** covering the full workflow from API analysis, parameter testing to watermark verification:

| Script | Purpose | Key Features |
|:-------|:--------|:-------------|
| `doubao_video_downloader.py` | Full CLI downloader | Cookie auth, progress display |
| `test_watermark_detection.py` | Watermark detection | ETag/MD5 comparison, OpenCV frame analysis |
| `advanced_watermark_bypass.py` | Advanced parameter testing | 4 test groups (14 lr variants + 11 body combos) |
| `reverse_miniprogram_method.py` | Mini-program reverse engineering | 5 test groups (UA, share link parsing, special tokens) |
| `check_mobile_api.py` | Mobile API simulation | iOS/Android/iPad/WeChat 4 platform tests |
| `analyze_api.py` | API response analysis | Recursive JSON URL field search |
| `deep_analysis_browser.py` | Browser-level deep analysis | Selenium-based network capture |
| ... More | See [tools/README.md](tools/README.md) |

Usage:
```bash
cd tools/
pip install -r requirements.txt
python3 doubao_video_downloader.py "https://www.doubao.com/video-sharing?video_id=xxx"
```

### Chrome Extension Interceptor

The `chrome-extension/` directory contains a complete Chrome extension for deep network request interception on Doubao pages, including fetch/XHR, WebSocket, Service Worker cache, etc. See [chrome-extension/README.md](chrome-extension/README.md).

## License

MIT License — This project is for technical research purposes only. It does not provide a working video watermark removal solution.

---

## Search Tags

<!-- GitHub search optimization tags (HTML comments for indexing) -->

**English Tags:** `doubao-watermark-remover` `byte-dance-watermark` `video-watermark-analysis` `cdn-security-research` `h264-watermark-embedding` `api-security` `doubao-api` `douyin-watermark` `ai-video-watermark` `watermark-bypass` `get-play-info` `samantha-api` `bytedance` `tiktok-watermark` `volcengine`

**Chinese Tags:** `豆包去水印` `豆包无水印` `字节跳动` `抖音视频水印` `get_play_info` `AI视频去水印` `CDN安全` `H.264水印` `视频水印分析` `豆包API` `去水印失败`

**Related Projects Reference:**
- [Qalxry/doubao-no-watermark](https://github.com/Qalxry/doubao-no-watermark) — ⭐149 Doubao watermark-free userscript (images only)
- [catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark](https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark) — Doubao video sharing page remover
- [xiaoka6688/AI-Video-Copilot](https://github.com/xiaoka6688/AI-Video-Copilot) — AI video watermark remover extension
- [ihmily/doubao-nomark](https://github.com/ihmily/doubao-nomark) — Doubao mark-free
- More projects in [analysis/technical-report.md](analysis/technical-report.md#open-source-project-comparison)