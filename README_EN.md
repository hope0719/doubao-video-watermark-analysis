# Doubao Video Watermark Removal — Investigation Log

> **Investigation period**: Early July 2026 (~4 days of intensive testing)  
> **Models used**: GLM 5.2 · Claude 4.5 · Codex / GPT 5.5 (all unsuccessful)  
> **Status**: ❌ Still failing, investigation ongoing

> **🎯 Search keywords**: doubao watermark remover · ByteDance video watermark · doubao no watermark · get_play_info · video watermark bypass · CDN watermark analysis

[中文版](README.md)

---

## TL;DR

> **We tried dozens of technical approaches, iterated through 20+ versions (Edge extension + WeChat mini-program + Python tools), consulted GLM 5.2, Claude 4.5, and Codex/GPT 5.5 — but as of now, all publicly accessible Doubao video files still contain watermarks. The investigation is ongoing.**

---

## Table of Contents

- [Background](#background)
- [What We Did](#what-we-did)
- [Test Matrix](#test-matrix)
- [Directions Explored](#directions-explored)
- [Why "Still Failing"](#why-still-failing)
- [Image Watermark Removal Still Works](#image-watermark-removal-still-works)
- [Repository Structure](#repository-structure)
- [License](#license)

---

## Background

**Doubao watermark removal** is a common need among AI content creators. Doubao (doubao.com) is ByteDance's AI content generation platform. Generated videos come with a "Doubao AI" watermark by default.

We attempted to obtain watermark-free videos through Doubao's public APIs, but **after extensive testing, all downloaded files contain visible watermarks**.

This is not a "completed project" — it's a **record of our investigation process**.

---

## What We Did

### Frontend Plugin (20+ versions)

| Version | Attempt | Result |
|:-------:|---------|:------:|
| v1.0 | Edge plugin: inject.js API interception + overlay button | Interception works, video still watermarked |
| v1.1-v1.6 | chat page multi-strategy + multi-video support + DOM matching | Frontend works, video still watermarked |
| v1.8-v1.9 | vid→video element association fix + periodic retry | Downloads work, **video still watermarked** |
| v20 | Final integration of all fixes | **Still watermarked** |

### API Analysis

- **Core API**: `POST /samantha/media/get_play_info` (returns `original_media_info.main_url`)
- Historically `original_media_info` returned watermark-free URLs; now it's **identical** to `media_info[0].main_url`
- Tested different domains (v9-videoweb / v26-videoweb / v26-show.douyinvod)
- Tested 14 `lr` parameter variants (no_watermark, origin, raw, clean, etc.)
- Tested logged-in vs. anonymous sessions
- **All files had identical MD5 hashes — all watermarked**

### AI Model Assisted Analysis

| Model | Use | Result |
|:------|:----|:-------|
| **GLM 5.2** | Packet analysis, API parameter suggestions | No effective solution found |
| **Claude 4.5** | Code review, reverse engineering direction | No effective solution found |
| **Codex / GPT 5.5** | Architecture analysis, solution design | No effective solution found |

All models failed to provide a working watermark removal approach.

### Open Source Project Research

| Project | Method | Works for video? |
|:--------|:-------|:---------------:|
| ihmily/doubao-nomark | `get_play_info` + WeChat UA | ❌ (same result as ours) |
| catscarlet video remover | `get_play_info` + credentials | ❌ |
| xiaoka6688 AI remover | Changed `lr` parameter | ❌ |
| wan-kong online tool | `get_video_share_info` + WeChat UA | ❌ |
| gosick233-cloud free version | Changed `lr` parameter | ❌ |
| huige-opc watermark vanish | `get_play_info` | ❌ |
| Qalxry doubao no-watermark | **Images only, no video** | ✅ Images |

**All video watermark removal open-source projects have failed.**

### Packet Capture Analysis

Captured 3 video download requests from mobile (iOS Stream):
- Only found `v9-videoweb.doubao.com` video download requests, **no corresponding API call found**

---

## Test Matrix

| Source | Domain | lr parameter | File size | Watermark |
|:-------|:-------|:-------------|:----------|:---------:|
| Mobile packet capture | v9-videoweb | unwatermarked | ~598KB | ❌ Yes |
| H5 browser API call | v9-videoweb | video_gen_watermark_dyn | ~819KB | ❌ Yes |
| H5 player video source | v26-videoweb | video_gen_watermark_dyn | ~653KB | ❌ Yes |
| WeChat UA + full params API | v26-videoweb | video_gen_watermark_dyn | ~819KB | ❌ Yes |
| doubao-nomark open source | v9/v26 | video_gen_watermark_dyn | ~819KB | ❌ Yes |
| GLM/Claude/Codex suggestions | - | - | - | ❌ All |

**Conclusion**: Different file sizes, domains, and encodings — but all have visible watermarks.

---

## Directions Explored

| Direction | Status | Notes |
|:----------|:------:|:------|
| Change `lr` parameter | ❌ Failed | CDN cache key doesn't include query params |
| Change CDN domain | ❌ Failed | v9/v26/show — all watermarked |
| Logged-in download | ❌ Failed | Same API returns same file |
| Creator identity auth | ❌ Not found | No creator-specific API endpoint found |
| Frame cropping post-processing | ⏳ Feasible | Crop watermark area, but image quality loss |
| AI post-processing de-watermark | ⏳ Theoretical | Requires model inference, quality loss, high cost |

---

## Why "Still Failing"

1. **Root cause**: Doubao video watermarks are **pixel-level embedded during server-side encoding** — not CSS overlay, not CDN parameter controlled, not player post-processing
2. **All known paths exhausted**: API parameters, CDN parameters, open-source projects, AI model analysis — no effective method found

---

## Image Watermark Removal Still Works

**This repository's conclusion applies to video only. Image watermark removal is fully functional!**

- Gallery pages return `rc_gen_image/{32-char-md5}` paths — **watermark-free original images**
- [Qalxry/doubao-no-watermark](https://github.com/Qalxry/doubao-no-watermark) (⭐149) is a pure image solution that still works
- Canvas merge-based image watermark removal is also viable

---

## Repository Structure

```
├── README.md                    # This file (Chinese)
├── README_EN.md                 # This file (English)
├── analysis/                    # Analysis documents
│   ├── technical-report.md      # Full technical analysis
│   ├── troubleshooting-log.md   # Complete investigation log
│   ├── FIND_MINIPROGRAM_API.md  # Mobile API capture guide
│   └── 方向分析报告.md            # Latest direction analysis
├── tools/                       # Python analysis tools (19 scripts)
├── chrome-extension/            # Chrome extension interceptor
└── proof/                       # Core verification scripts
```

---

## License

MIT License — This project documents technical research. It does not provide a working video watermark removal solution.