# 豆包无水印视频 · 全链路探测方案

> 注意：此方案**不使用任何抓包/代理/油猴脚本**，只通过 Python 主动调用 API 探测。

## 探测思路

之前所有尝试都围绕"调用 `get_play_info` 看返回的 URL"打转，但 CDN 缓存层面让参数操控完全失效。

这个方案换一个思路：**先把所有候选端点都列出来，然后用登录态 Cookie 逐个调，看谁有未知的视频链路**。

## 探测分三层

### 第一层：JS bundle 全量扫描
从豆包 video-sharing 页面提取了 17 个 JS bundle，从中找到 407 个 `genBaseURL` 端点。这是豆包前端实际在调用的全部后端接口。

### 第二层：端点分类
按用途分成 5 组：

| 类别 | 数量 | 例子 |
|------|------|------|
| 视频核心 | 7 | `samantha/media/get_play_info`, `mget_play_status` |
| 创作/分享 | 50+ | `creativity/share/get_video_share_info`, `thread/share/info` |
| 水印/下载 | 2 | `watermark_task`, `watermark_download` |
| 文件/导出 | 30+ | `upload/refresh_file_url`, `otter/doc/export/` |
| 抖音/剪映 | 5+ | `creator.douyin.com/aweme/v1/creator/video/list/` |

### 第三层：登录态批量探测
- 把所有候选端点 + 一些猜的（`video/clean`, `video/hd`, `video/export`）整合
- 用你登录后的 Cookie 逐个 POST/GET
- 看哪个端点返回的视频 URL `lr` 参数不是 `video_gen_watermark_dyn`
- 自动下载第一个看起来像无水印的 URL

## 文件清单

| 文件 | 作用 |
|------|------|
| `doubao_full_probe.py` | 豆包所有端点的登录态探测（**主要**） |
| `douyin_jianying_probe.py` | 抖音/剪映同步链路探测 |
| `doubao_enhance_probe.py` | 变清晰/增强类端点 + JS bundle 扫描 |
| `doubao_login_probe.py` | 简化版登录态探测（如果全量版太慢） |
| `run_all_probes.sh` | 一键运行所有探测 |

## 使用步骤

### 步骤 1：浏览器登录

打开 `https://www.doubao.com/`，确认登录。

### 步骤 2：获取 Cookie

F12 → Console → 粘贴：
```javascript
document.cookie
```
把输出复制。

### 步骤 3：跑探测

```bash
cd /Users/hope/Desktop/幻影空间
./run_all_probes.sh
```

第一次会要求输入 Cookie，之后会保存到 `doubao_cookies.json` 复用。

或单独跑：
```bash
python3 doubao_full_probe.py
```

### 步骤 4：等脚本跑完

理想情况下，某个端点会返回：
- 200 状态码
- 响应里有 `.mp4` 或 `.m3u8` URL
- URL 的 `lr` 参数不是 `video_gen_watermark_dyn`

如果找到了，脚本会自动下载并保存到 `doubao_probe_*.mp4`。

## 重点关注的新端点

探测中专门加了一些**之前报告没测过**的端点：

| 端点 | 为什么值得试 |
|------|-------------|
| `samantha/media/mget_play_status` | 批量获取播放状态，可能返回更多 URL |
| `alice/message/get_file_url` | 通用文件 URL 服务，可能绕过水印逻辑 |
| `alice/upload/refresh_file_url` | 刷新文件 URL，可能生成新 URL |
| `samantha/video/clean` | 猜的：清洁版视频 |
| `samantha/video/hd` | 猜的：高清版可能无水印 |
| `samantha/video/export` | 猜的：导出端点 |
| `samantha/video/original` | 猜的：原始版 |
| `alice/resource/watermark_task` POST | 之前只测了 GET，POST 可能创建任务 |
| `easydownload.flyinglife.cn` | 第三方 APP 的后端，可能有更直接的接口 |

## 抖音/剪映 同步探测

如果豆包没有无水印接口，**创作者中心的下载**就是下一条线。

```bash
python3 douyin_jianying_probe.py
```

需要你**额外登录抖音创作者中心**（`creator.douyin.com`），再获取 Cookie。

## 输出文件

| 文件 | 含义 |
|------|------|
| `doubao_probe_v3_*.json` | 全部端点探测结果 |
| `doubao_enhance_scan_*.json` | JS bundle 端点扫描结果 |
| `doubao_probe_*.mp4` | 自动下载的候选视频 |
| `doubao_cookies.json` | 你的 Cookie 缓存（**不传**） |

## 如果跑完没找到

如果所有端点都返回 `710012001`（登录过期）或没有视频 URL，说明：

1. **Cookie 失效了** —— 重新登录后再跑
2. **账号权限不够** —— 创作者/会员/企业账号可能有专属接口
3. **端点需要更多参数** —— 现在的调用参数可能不全

## 进一步探索

如果以上都不行，可以再试：
- 直接抓豆包 APP（Android/iOS）生成视频的流量，可能走不同后端
- 抖音创作者服务平台的 API 文档
- 巨量百应 / 巨量算数 的素材 API

但说实话，根据之前 1 个月的密集测试，**通过公开技术手段拿到无水印视频的可能性已经非常小了**。

如果以上都失败，建议：
- 走 FFmpeg 裁剪（最简单）
- 走 AI 后处理（效果最好）
- 走官方创作者/会员渠道（最稳定）
