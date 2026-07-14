# 🎯 小程序去水印流程图解

## 📊 完整的请求流程

```
用户操作              小程序                豆包API               CDN服务器
  │                    │                      │                     │
  │                    │                      │                     │
  ├─ 1. 输入链接 ────→ │                      │                     │
  │                    │                      │                     │
  │                    ├─ 2. 调用解析API ───→ │                     │
  │                    │   (我们需要找这个！)   │                     │
  │                    │                      │                     │
  │                    │                      ├─ 3. 生成无水印URL   │
  │                    │                      │   (lr=unwatermarked) │
  │                    │                      │                     │
  │                    │ ←─ 4. 返回URL ────── │                     │
  │                    │   { video_url: ... }  │                     │
  │                    │                      │                     │
  │                    ├─ 5. 下载视频 ──────────────────────────→ │
  │                    │   (你抓到的就是这个)                        │
  │                    │                      │                     │
  │                    │ ←─ 6. 返回视频文件 ──────────────────────── │
  │                    │   (598KB, 无水印)                          │
  │                    │                      │                     │
  │ ←─ 7. 显示视频 ─── │                      │                     │
```

## ⚠️ 你现在提供的是什么

你提供的是**步骤5**的请求（直接下载视频文件）：

```bash
GET https://v9-videoweb.doubao.com/.../oItZeSQQIeWpNXSBFJyxVAjxkGR6JOUgIDHqEL/?lr=unwatermarked&...
```

这是**结果**，不是**原因**！

## 🎯 我需要的是什么

我需要**步骤2**的API调用，它会返回包含这个URL的响应：

### 可能的样子（示例）

```bash
# 请求
POST https://api.xxx.com/parse_video
或
POST https://www.doubao.com/xxx/get_unwatermarked_url

Headers:
  Authorization: Bearer xxx
  Content-Type: application/json

Body:
  {
    "url": "https://www.doubao.com/video-sharing?share_id=xxx&video_id=xxx",
    "platform": "doubao"
  }

# 响应
{
  "code": 0,
  "data": {
    "video_url": "https://v9-videoweb.doubao.com/.../oItZeSQQIeWpNXSBFJyxVAjxkGR6JOUgIDHqEL/?lr=unwatermarked&...",
    "title": "视频标题",
    "duration": 10
  }
}
```

## 🔍 如何在抓包中找到它

### 在Charles/Stream中

1. **按时间排序**
   ```
   时间 | 域名 | 路径 | 类型
   ────────────────────────────────────
   18:06:10 | www.doubao.com | /api/parse | JSON  ← 找这个！
   18:06:15 | v9-videoweb.doubao.com | /video | MP4   ← 你发的这个
   ```

2. **查找特征**
   - ✅ 时间：在视频下载**之前**
   - ✅ 域名：可能是 `doubao.com` 或其他API域名
   - ✅ 类型：JSON响应（不是视频文件）
   - ✅ 响应：包含 `video_url` 或 `.mp4` 的JSON

### 实际操作

1. **清空抓包记录**
   ```
   Stream: 点击清空按钮
   Charles: Proxy → Clear Session
   ```

2. **重新操作小程序**
   - 打开小程序
   - 输入链接
   - 点击解析
   - 等待完成

3. **查看所有请求**
   - 找到时间最早的几个请求
   - 点击每个请求查看响应
   - 找包含视频URL的JSON响应

## 📝 示例对比

### ❌ 错误：视频文件请求（你提供的）

```
URL: https://v9-videoweb.doubao.com/.../?lr=unwatermarked&...
Response: [二进制视频数据]
```

这是**下载视频**的请求，不是**获取URL**的请求

### ✅ 正确：API请求（需要找到的）

```
URL: https://api.xxx.com/parse
或
URL: https://www.doubao.com/samantha/xxx

Response: 
{
  "video_url": "https://v9-videoweb.doubao.com/.../?lr=unwatermarked&..."
}
```

这个API**返回**了包含 `lr=unwatermarked` 的URL

## 🎯 关键问题

**Q: 小程序从哪里获得这个 `lr=unwatermarked` 的URL？**

A: 肯定是从某个API的响应中！这就是我们要找的！

## 📱 快速检查方法

在Stream/Charles中搜索：

1. 搜索响应内容包含：`unwatermarked`
2. 搜索响应内容包含：`oItZeSQQIeWpNXSBFJyxVAjxkGR6JOUgIDHqEL`
3. 搜索URL包含：`/parse`、`/api`、`/get_url`

## 💡 小提示

如果小程序很快就显示视频，API调用可能在**0-5秒内**就完成了。

在抓包记录中找：
- 视频下载时间：18:06:15
- API调用时间：应该在 18:06:10 - 18:06:14 之间

找到那个时间段内**返回JSON**的请求！

---

## 🆘 还是找不到？

如果实在找不到，可能的情况：

1. **API调用太快**
   - 在开始抓包前就完成了
   - 解决：清空记录后重新测试

2. **小程序使用了WebSocket**
   - 通过WS推送URL
   - 解决：查看Charles的WS标签

3. **小程序使用了第三方服务**
   - API域名不是 doubao.com
   - 解决：查看所有域名的请求

---

**记住：我们要找的是返回这个URL的API，而不是这个URL本身！**
