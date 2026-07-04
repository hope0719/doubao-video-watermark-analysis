# 豆包视频去水印 — 深度技术分析

[![GitHub stars](https://img.shields.io/github/stars/hope0719/doubao-video-watermark-analysis?style=social)](https://github.com/hope0719/doubao-video-watermark-analysis/stargazers)

If this research helps you, please consider giving it a ⭐ star!  
如果本项目对你有帮助，欢迎点个 ⭐ Star 支持一下！

> **🎯 搜索关键词：豆包去水印 · doubao watermark remover · 字节跳动视频水印 · 豆包无水印 · get_play_info · 抖音视频水印 · AI视频去水印 · CDN水印 · H.264水印嵌入**

> **⚠️ 重要结论：豆包视频水印无法通过客户端技术去除！**
>
> 本项目完整记录了我们对**字节跳动豆包（Doubao）AI 视频去水印**的全链路技术探索过程。
> 经过系统性测试（17 个 API 端点、15 个开源项目源码分析、CDN 参数穷举操控、登录态/非登录态对比），
> **最终确认豆包视频水印是在服务器端 H.264 编码时叠加到像素层的，不是 CDN 动态添加，也不是 URL 参数控制。**

[English Version](README_EN.md)

---

## 目录

- [背景](#背景)
- [核心结论](#核心结论)
- [探索过程概览](#探索过程概览)
- [探索细节](#探索细节)
- [关键证据](#关键证据)
- [为什么所有开源项目都失效了](#为什么所有开源项目都失效了)
- [图片去水印仍然可工作](#图片去水印仍然可工作)
- [运行测试脚本](#运行测试脚本)
- [搜索标签](#搜索标签)
- [许可协议](#许可协议)

---

## 背景

**豆包去水印**（doubao watermark removal）是当前 AI 内容创作者的常见需求。豆包（doubao.com）是字节跳动推出的 AI 对话+内容生成平台，支持 AI 生成视频和图片。生成的视频默认带有"豆包 AI"水印，许多用户希望找到去除方法。

在微信小程序和浏览器插件中，我们尝试通过调用豆包的公开 API 获取无水印版本，但发现从某个时间点开始，**所有 API 返回的视频都带有水印**。

## 核心结论

```
AI 生成（无水印原片）
    → H.264 编码（同时叠加水印至每一帧像素）
    → TOS 对象存储（只存一份带水印文件）
    → CDN 分发（所有 URL 参数均为缓存签名，不影响内容）
    → 客户端下载（文件本身已嵌入水印）
```

**水印在编码阶段嵌入，CDN 只存一份文件，不存在通过 URL 参数或 API 切换来绕过的方法。**

## 探索过程概览

我们经历了三个阶段，最终才确认根因：

### 阶段 1：代码修复（以为前端逻辑有问题）

| 版本 | 尝试 | 结果 |
|:----:|------|:----:|
| v1.0 | Edge 浏览器插件初版：inject.js 拦截 API | 拦截失败 |
| v1.1-v1.2 | chat 页面多策略 + CDN 域名变换 | chat 不支持 + 403 |
| v1.3 | 对齐小程序：vid → `get_play_info` API | **依然带水印** |
| v1.4-v1.6 | 多视频支持 + DOM 关联匹配 | 时序问题 |
| v1.8-v1.9 | 回归 + poster 匹配 + 周期重试 | **依然带水印** |

> 我们花了几个月迭代了 20+ 版本修复前端匹配问题，但根因根本不在前端。

### 阶段 2：API 探索（以为有隐藏参数）

- 测试了 17 个 API 端点（`get_play_info`、`get_video_share_info`、`watermark_download` 等）
- 测试了 URL 参数操控（lr、ft、cs、cr、dr、download、btag、feature_id… 共 15+ 个参数）
- 测试了登录态与非登录态对比
- **全部返回同一份带水印文件**

### 阶段 3：开源项目调研

从 GitHub 下载并分析了 **15 个相关开源项目**，逐一运行测试：

| 项目 | ⭐ | 方法 | 有效？ |
|:----|:-:|:----|:----:|
| catscarlet 视频分享去水印 | — | `get_play_info` + credentials | ❌ |
| xiaoka6688 AI去水印扩展 | — | 改 `lr=no_watermark` | ❌ |
| Luncot 豆包下载器加强版 | 5 | 同上 | ❌ |
| wan-kong 豆包在线工具 | — | `get_video_share_info` + 微信 UA | ❌ |
| gosick233-cloud 豆包自由版 | — | 改 `lr=no_watermark` | ❌ |
| huige-opc 水印消失术 | — | `get_play_info` + credentials | ❌ |
| ihmily 无印豆包 | — | `get_play_info` + credentials | ❌ |
| Qalxry 豆包无水印油猴 | **⭐149** | **仅图片，无视频** | ✅ 图片 |
| doubao-no-watermark | — | 同上 | ❌ |
| 其他 6 个项目 | — | 各种方法 | ❌ |

**所有视频去水印项目全部失效。** 目前还在工作的是纯图片去水印项目。

## 探索细节

详细分析文档请见：

- **[analysis/technical-report.md](analysis/technical-report.md)** — 完整技术分析报告（17 个 API 端点测试、CDN 签名机制、15 个开源项目源码对比）
- **[analysis/troubleshooting-log.md](analysis/troubleshooting-log.md)** — 排查全记录（所有测试数据、URL 参数操控矩阵、版本历史回溯）

## 关键证据

### 证据 1：`original_media_info` 已失效

历史上，`POST /samantha/media/get_play_info` 的响应中 `original_media_info.main_url` 返回的是**不带水印**的 `videoweb.doubao.com` URL。现在它与 `media_info[0].main_url` **完全相同**：

```json
{
  "media_info": [{
    "main_url": "https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn"
  }],
  "original_media_info": {
    "main_url": "https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn"  // 完全相同
  }
}
```

### 证据 2：所有 URL 参数不影响文件内容

测试视频 `v0269cg10004d946i5iljhtf2dunr5e0` 的 CDN URL 参数操控结果：

| 测试 | 修改方式 | etag | content-length | 水印 |
|:----|:-------:|:---:|:-------------:|:----:|
| 原始 URL | 不变 | `5bd9650c...` | 843,802 | ✅ |
| 去掉 `lr` 参数 | 删除 | `5bd9650c...` | 843,802 | ✅ |
| `lr=none` | 替换 | `5bd9650c...` | 843,802 | ✅ |
| 去掉 `ft` | 删除 | `5bd9650c...` | 843,802 | ✅ |
| `ft=AAAA` | 随机值 | `5bd9650c...` | 843,802 | ✅ |
| 去掉 `download` | 删除 | `5bd9650c...` | 843,802 | ✅ |
| 改 `cr=7&dr=3&cs=4` | 替换 | `5bd9650c...` | 843,802 | ✅ |

**证明：CDN 只存一个文件，所有参数都是缓存签名，不影响内容。**

### 证据 3：登录态不影响无水印

使用 Playwright 在已登录的浏览器上下文中：
- `credentials: 'include'` 调 API → URL 与未登录态相同
- 点击创作者下载按钮 → 同一 URL
- JS bundle 搜索 `watermark` → 客户端无控制逻辑

### 证据 4：字节一定有无水印原片

从逻辑上推断：

1. **AI 模型生成的是原始帧**，水印是后处理叠加的
2. **创作者需要无水印版本**才能发到抖音/小红书/B站
3. **商业闭环要求**平台提供无水印导出能力

无水印原片可能在内部创作者服务链路中（需 OAuth + 创作者权限），**不在公开 API** 上。

## 为什么所有开源项目都失效了

核心原因：**字节跳动（豆包+抖音）的视频水印机制是工业级的**。

1. 不是前端叠加 → 不能用 DOM 操作绕过
2. 不是边缘添加 → CDN 参数操控无效
3. 不是 URL 分支 → 不同域名返回同一份文件
4. **是编码时嵌入 → 像素级，与文件绑定**

之前（v7-v8 时期）能工作，推测是因为：
- CDN 旧节点或旧编码器没有正确叠加水印
- 字节后来修复了这个问题
- **之前的"成功"是 Bug 不是 Feature**

## 图片去水印仍然可工作

**本项目的分析结论仅限视频。图片去水印完全可工作！**

- 图集页面返回 `rc_gen_image/{32位md5}` 路径是**无水印原图**
- GitHub 上 ⭐149 的 [Qalxry/豆包无水印油猴](https://github.com/Qalxry/doubao-no-watermark) 就是纯图片方案，仍在工作
- Canvas 合并去水印也是可行的图片方案

## 运行测试脚本

```bash
# 安装依赖
pip install httpx

# 运行测试（验证 API 返回带水印视频）
cd proof/
python3 test_api.py <video_id>
```

示例输出：
```
API:  /samantha/media/get_play_info
URL:  https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn
Size: 843,802 bytes
Etag: 5bd9650c...
⚠️  Watermark: DETECTED (lr=video_gen_watermark_dyn)
```

## 许可协议

MIT License — 本项目仅为技术研究目的，不提供可用的视频去水印方案。

---

## 搜索标签

<!-- GitHub 搜索优化标签（HTML 注释不影响显示，但提升索引质量） -->

**中文标签：** `豆包去水印` `豆包无水印` `字节跳动` `抖音视频水印` `get_play_info` `AI视频去水印` `CDN安全` `H.264水印` `视频水印分析` `豆包API` `虾爬API` `去水印失败` `豆包视频` `doubao.com` `火山引擎`

**English Tags:** `doubao-watermark-remover` `byte-dance-watermark` `video-watermark-analysis` `cdn-security-research` `h264-watermark-embedding` `api-security` `doubao-api` `douyin-watermark` `ai-video-watermark` `watermark-bypass` `get-play-info` `samantha-api`

**相关项目参考：**
- [Qalxry/doubao-no-watermark](https://github.com/Qalxry/doubao-no-watermark) — ⭐149 豆包无水印油猴脚本（仅图片）
- [catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark](https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark) — 豆包视频分享页去水印
- [xiaoka6688/AI-Video-Copilot](https://github.com/xiaoka6688/AI-Video-Copilot) — AI视频去水印扩展
- [ihmily/doubao-nomark](https://github.com/ihmily/doubao-nomark) — 无印豆包
- 更多项目详见 [analysis/technical-report.md](analysis/technical-report.md#开源项目对比)