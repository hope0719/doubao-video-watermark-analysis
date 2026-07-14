# Doubao Watermark Remover

豆包图片视频水印消失工具 - 一款 Chrome 浏览器扩展，拦截豆包 API 请求，提取无水印原图原视频。

> ⚠️ **免责声明：本工具仅供学习研究使用，请勿用于侵权、商业用途或其他违法场景。**

## 功能

- 自动拦截豆包 API 中的图片和视频请求
- 提取无水印的原始文件
- 一键下载原图原视频
- 支持豆包网页版（doubao.com）

## 安装

1. 下载本仓库代码
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择本文件夹

## 使用

安装后，打开豆包网页版（doubao.com），当页面中有图片或视频内容时，扩展会自动拦截并显示下载按钮。

## 文件说明

```
background.js       # 后台服务（Service Worker）
content.js          # 注入页面的脚本
bridge.js           # 通信桥接
manifest.json       # 扩展配置文件
icon-*.png          # 扩展图标
qr-code.png         # 二维码素材
```

## License

Apache License 2.0
