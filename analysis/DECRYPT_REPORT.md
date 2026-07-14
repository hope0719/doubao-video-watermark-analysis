# Doubao Video Watermark Removal - Decryption Analysis Report

> 完整技术报告，记录了 `original_media_info` 字段的多层解密过程

## 📋 目录

- [概述](#概述)
- [攻击流程](#攻击流程)
- [脚本说明](#脚本说明)
- [关键发现](#关键发现)
- [已尝试方法](#已尝试方法)

## 概述

该项目旨在通过 API 响应分析豆包视频水印 (Doubao video watermark)。核心目标是获取 `original_media_info` 字段（天然无水印资源地址），而非 AI 修复或 FFmpeg 处理。

通过对响应数据的多层处理（XOR 解码、Gzip/Zlib 解压、Base64/Base32 解码、AES 暴力等），由浅到深地分析了数据的加密过程。

## 攻击流程

### 第0层：原始捕获

- **数据**：响应体大小 165KB (`get_play_info_raw_response_*.json`)
- **字段**：重点关注 `original_media_info`

### 第1层：XOR 解码 (Key 0x81)

- **方法**：对字节流进行 XOR 暴力，识别出密钥 `0x81`。
- **工具**：`ULTIMATE_DECRYPTOR.py`
- **结果**：生成长度 165KB 的 XOR 解码数据 (`XOR_DECRYPT_KEY_81.txt`)

### 第2层：压缩处理和编码转换

- **方法**：尝试对中间数据进行 Gzip、Zlib、Base64、URL 解码。
- **工具**：`LAYER2_DECRYPT.py`
- **结果**：生成长度约 142KB 的文本和 URL 解码数据。

### 第3层：Unicode 损坏修复

- **问题**：出现 `ï¿½` (U+FFFD) 这类 UTF-8 解码失败。
- **方法**：通过字符重映射、替换修复二进制。
- **工具**：`LAYER3_DESTROYER.py` + `RECONSTRUCT_RAW.py`
- **结果**：还原出可能的有效字节序列。

### 第4层：长重复序列 (