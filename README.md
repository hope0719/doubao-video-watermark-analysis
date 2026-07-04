# 豆包视频去水印探索记录

> **探索时间**：2026年7月上旬（约4天密集测试）
> **测试模型**：GLM 5.2 · Claude 4.5 · Codex / GPT 5.5（均未成功）
> **状态**：❌ 仍在失败中，持续探索

> **🎯 搜索关键词：豆包去水印 · doubao watermark remover · 字节跳动视频水印 · 豆包无水印 · get_play_info · 抖音视频水印 · AI视频去水印 · CDN水印**

[English Version](README_EN.md)

---

## 一句话总结

> **我们尝试了几十条技术方向，迭代了几十个版本（Edge 插件 + 微信小程序 + Python 分析工具），调用过 GLM 5.2、Claude 4.5、Codex/GPT 5.5 等模型辅助分析，但截至目前，**所有公开途径获取的豆包视频文件都带有水印**。研究仍在进行中。**

---

## 目录

- [背景](#背景)
- [我们做了什么](#我们做了什么)
- [测试矩阵](#测试矩阵)
- [探索方向](#探索方向)
- [为什么说"仍在失败"](#为什么说仍在失败)
- [图片去水印仍然可工作](#图片去水印仍然可工作)
- [仓库结构](#仓库结构)
- [许可证](#许可证)

---

## 背景

**豆包去水印**是AI内容创作者的常见需求。豆包（doubao.com）是字节跳动的AI内容生成平台，生成的视频默认带有"豆包 AI"水印。

我们尝试通过调用豆包的公开 API 获取无水印视频，但**经过大量测试，所有获取到的视频文件都包含水印**。

这不是一个"完成的项目"，而是一份**探索过程的记录**。

---

## 我们做了什么

### 前端插件（迭代了 20+ 版本）

| 版本 | 尝试 | 结果 |
|:----:|------|:----:|
| v1.0 | Edge 插件：inject.js 拦截 API + 覆盖按钮下载 | 拦截成功，但视频带水印 |
| v1.1-v1.6 | chat 页面多策略 + 多视频支持 + DOM 关联 | 前端功能修复，但视频仍有水印 |
| v1.8-v1.9 | vid→video 元素关联修复 + 周期重试 | 下载成功，**视频仍带水印** |
| v20 | 最终版本，整合所有修复 | **仍带水印** |

### API 分析

- **核心 API**：`POST /samantha/media/get_play_info`（返回 `original_media_info.main_url`）
- 历史上 `original_media_info` 曾返回无水印 URL，现在与 `media_info[0].main_url` **完全相同**
- 测试了不同域名（v9-videoweb / v26-videoweb / v26-show.douyinvod）
- 测试了不同 `lr` 参数（14 种变体：no_watermark, origin, raw, clean 等）
- 测试了登录态与未登录态对比
- **所有结果文件 MD5 一致，均带水印**

### AI 模型辅助分析

我们使用了多个 AI 模型辅助分析方向：

| 模型 | 用途 | 结论 |
|:----|:----|:----|
| **GLM 5.2** | 分析抓包数据、建议 API 参数变体 | 未找到有效途径 |
| **Claude 4.5** | 代码审查、逆向分析方向建议 | 未找到有效途径 |
| **Codex / GPT 5.5** | 架构分析、设计方案 | 未找到有效途径 |

所有模型均未能提供可用的去水印方案。

### 开源项目调研

调研并运行测试了多个相关开源项目：

| 项目 | 方法 | 对视频有效？ |
|:----|:----|:----------:|
| ihmily/doubao-nomark | `get_play_info` + 微信 UA | ❌（和我们结果一致） |
| catscarlet 视频去水印 | `get_play_info` + credentials | ❌ |
| xiaoka6688 AI去水印 | 改 `lr` 参数 | ❌ |
| wan-kong 在线工具 | `get_video_share_info` + 微信 UA | ❌ |
| gosick233-cloud 豆包自由版 | 改 `lr` 参数 | ❌ |
| huige-opc 水印消失术 | `get_play_info` | ❌ |
| Qalxry 豆包无水印油猴 | **仅图片，无视频** | ✅ 图片 |

**所有视频去水印开源项目均已失效。**

### 抓包数据分析

通过 iOS 抓包工具（Stream）对手机端的视频请求进行了 3 次抓包分析：
- 只抓到 `v9-videoweb.doubao.com` 的视频下载请求，**未找到 API 来源**

---

## 测试矩阵

| 测试来源 | 域名 | lr 参数 | 文件大小 | 水印 |
|---------|------|---------|---------|:----:|
| 手机端抓包 | v9-videoweb | unwatermarked | ~598KB | ❌ 有 |
| H5 浏览器调 API | v9-videoweb | video_gen_watermark_dyn | ~819KB | ❌ 有 |
| H5 播放器 video source | v26-videoweb | video_gen_watermark_dyn | ~653KB | ❌ 有 |
| 微信 UA + 完整参数调 API | v26-videoweb | video_gen_watermark_dyn | ~819KB | ❌ 有 |
| doubao-nomark 开源项目 | v9/v26 | video_gen_watermark_dyn | ~819KB | ❌ 有 |
| GLM/Claude/Codex 建议的方案 | - | - | - | ❌ 均有水印 |

**结论：所有文件大小、域名、编码不同，但都有可见水印。**

---

## 探索方向

| 方向 | 现状 | 说明 |
|:----|:----|:----|
| 更换 lr 参数 | ❌ 无效 | CDN 缓存 key 不含查询参数，内容不变 |
| 更换 CDN 域名 | ❌ 无效 | v9/v26/show 等域名均带水印 |
| 登录态下载 | ❌ 无效 | 登录后调用同一 API，返回同一文件 |
| 创作者身份验证 | ❌ 未找到 | 未找到创作者专属的 API 端点 |
| 画面裁剪后处理 | ⏳ 可行但非真正去水印 | 裁剪边缘水印区域，但有画质损失 |
| AI 后处理去水印 | ⏳ 理论可行 | 需要模型推理，画质有损，计算量大 |

---

## 为什么说"仍在失败"

1. **底层原因**：豆包视频水印是在服务端编码时**像素级叠加**的，不是 CSS 叠加、不是 CDN 参数控制、不是播放器后处理
3. **所有已知路径走不通**：API 参数、CDN 参数、开源项目、AI 模型分析，均未找到有效方法

---

## 图片去水印仍然可工作

**本仓库的结论仅限视频。图片去水印可正常工作！**

- 图集页面返回 `rc_gen_image/{32位md5}` 路径是**无水印原图**
- [Qalxry/doubao-no-watermark](https://github.com/Qalxry/doubao-no-watermark)（⭐149）是纯图片方案，仍在工作
- Canvas 合并去水印也是可行的图片方案

---

## 仓库结构

```
├── README.md                    # 本文件（中文）
├── README_EN.md                 # 本文件（英文）
├── analysis/                    # 分析文档
│   ├── technical-report.md      # 完整技术分析报告
│   ├── troubleshooting-log.md   # 排查全记录
│   ├── FIND_MINIPROGRAM_API.md  # 手机端 API 抓包指南
│   └── 方向分析报告.md            # 最新方向分析
├── tools/                       # Python 分析工具集（19 个脚本）
├── chrome-extension/            # Chrome 扩展拦截器
└── proof/                       # 核心验证脚本
```

详情请看各目录下的 README 文件。

---

## 许可证

MIT License — 本项目为技术研究记录，不提供可用的视频去水印方案。