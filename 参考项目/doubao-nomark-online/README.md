# 去水印 (豆包 / 千问)

从主流平台分享链接中提取无水印的原始图片和视频资源。

> 原始项目: [github.com/ihmily/doubao-nomark](https://github.com/ihmily/doubao-nomark)

## 支持的平台

| 平台           | 类型 | 示例链接格式                   |
| -------------- | ---- | ------------------------------ |
| 豆包 (Doubao)  | 图片 | `doubao.com/thread/...`        |
| 千问 (Qianwen) | 图片 | `qianwen.com/share/chat/...`   |
| 豆包 (Doubao)  | 视频 | `doubao.com/video-sharing?...` |

## 功能

- **URL 自动识别** — 粘贴链接自动识别平台和内容类型
- **图片提取** — 提取无水印原图，支持批量下载
- **视频提取** — 获取无水印视频播放地址及封面

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Docker 部署

```bash
docker compose up -d --build
```

应用运行在 `http://localhost:3000`。

## 项目结构

```text
src/
├── app/
│   ├── actions.ts                 # Server Actions
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── home.tsx                   # 首页 UI
└── lib/
    ├── parsers.ts                 # 各平台解析逻辑
    ├── platforms.ts               # 平台注册与自动识别
    └── retry.ts                   # 请求重试工具
```

## 来源

基于 [ihmily/doubao-nomark](https://github.com/ihmily/doubao-nomark) 实现。
