# 豆包视频请求拦截器 Chrome 扩展

## 功能说明

这是一个用于深度分析豆包视频网络请求的 Chrome 扩展，可以：

1. **拦截所有网络请求**：捕获与视频相关的所有 API 请求
2. **分析响应头**：查看 ETag、Content-Type 等关键信息
3. **注入页面脚本**：拦截 fetch 和 XHR 请求，实时显示视频 URL
4. **对比分析**：验证不同请求是否返回相同文件

## 安装步骤

### 1. 打包扩展

确保以下文件在 `chrome_extension_intercept` 文件夹中：
- manifest.json
- background.js
- content.js
- popup.html
- popup.js

### 2. 加载到 Chrome

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 打开右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `chrome_extension_intercept` 文件夹

### 3. 创建图标（可选）

由于 manifest.json 中引用了图标，需要创建简单的图标文件，或者从 manifest.json 中删除 icon 相关配置。

## 使用方法

1. **安装扩展后**，打开豆包视频分享页面
2. **扩展会自动**在后台拦截所有网络请求
3. **点击扩展图标**打开弹窗查看捕获的请求
4. **页面右上角**会实时显示捕获到的视频 URL
5. **对比 ETag**：查看不同请求的 ETag 是否相同

## 验证方向

使用此扩展可以验证：

### ✅ 已验证的结论
- 所有 API 返回的视频 URL 的 ETag 都相同
- 说明 CDN 上只有一个带水印的版本

### 🔍 可以探索的方向
- WebSocket 连接中是否有其他视频源
- Service Worker 中是否有缓存的不同版本
- 页面加载过程中的所有中间请求
