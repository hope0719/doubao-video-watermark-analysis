# 🎯 如何找到小程序的真实API

## 📋 现状分析

我们已经确认：
- ✅ 小程序确实能获取 `lr=unwatermarked` 的URL
- ✅ 这些URL的ETag和文件大小都不同
- ❌ 直接修改lr参数无效（CDN会验证签名）

**结论：小程序调用了一个特殊的API来获取无水印URL**

---

## 🔍 在抓包中需要找什么

### 关键线索

你需要在Charles/Stream抓包中找到：

1. **视频URL之前的API调用**
   - 时间：在你看到 `v9-videoweb.doubao.com` 或 `v26-videoweb.doubao.com` 请求**之前**
   - 域名：`*.doubao.com` 或其他API域名
   - 路径：可能包含 `parse`、`get_url`、`download`、`media`、`video` 等关键词

2. **API响应中包含视频URL**
   - 响应体是JSON格式
   - 包含 `lr=unwatermarked` 的完整URL
   - 可能有多个URL（不同清晰度）

---

## 📱 具体操作步骤

### 步骤1：清空Charles/Stream的记录

在测试前先清空，这样更容易找到：
```
Charles: Proxy -> Clear Session
Stream: 清空按钮
```

### 步骤2：重新使用小程序

1. 在微信中打开去水印小程序
2. 粘贴豆包视频链接
3. 点击"解析"或"去水印"
4. 等待视频显示

### 步骤3：在抓包工具中查找

#### 方法A：按时间顺序查看

1. 找到最早的 `doubao.com` 请求
2. 查看是否是API调用（而不是视频文件）
3. 查看响应是否包含视频URL

#### 方法B：按URL过滤

在Charles/Stream中搜索：
- `doubao.com` 
- `parse`
- `get_play_info`
- `media`
- `video`

#### 方法C：按响应内容搜索

搜索响应中包含：
- `unwatermarked`
- `.mp4`
- `video_url`

---

## 📝 需要记录的信息

找到API后，记录以下完整信息：

### 1. 请求信息

```
URL: https://xxx.doubao.com/xxx/xxx
Method: POST 或 GET

Headers:
  User-Agent: ...
  Authorization: ... (如果有)
  Cookie: ... (如果有)
  X-Miniprogram-Appid: ... (如果有)
  其他所有headers

Query Parameters (URL参数):
  aid: ...
  appid: ...
  其他所有参数

Request Body (请求体):
  {
    "url": "...",
    "video_id": "...",
    其他所有字段
  }
```

### 2. 响应信息

```
Status Code: 200

Response Body:
  {
    完整的JSON响应
    (特别注意包含video_url的部分)
  }
```

---

## 🎯 示例：可能的API调用

### 示例1：解析API

```bash
POST https://api.xxx.com/parse

Headers:
  Authorization: Bearer xxx
  Content-Type: application/json

Body:
  {
    "url": "https://www.doubao.com/video-sharing?...",
    "platform": "doubao",
    "no_watermark": true
  }

Response:
  {
    "code": 0,
    "data": {
      "video_url": "https://v9-videoweb.doubao.com/...?lr=unwatermarked&...",
      "title": "...",
      "duration": 10
    }
  }
```

### 示例2：豆包自己的API（带特殊参数）

```bash
POST https://www.doubao.com/samantha/media/get_play_info

Headers:
  X-Miniprogram-Appid: wxXXXXXXXX
  Cookie: sessionid=xxx; ttwid=xxx
  Content-Type: application/json

Params:
  aid=1128
  from=miniprogram

Body:
  {
    "key": "v0d69cg10004d946nuiljht2d4d2v44g",
    "watermark": false
  }

Response:
  {
    "data": {
      "original_media_info": {
        "main_url": "https://v9-videoweb.doubao.com/...?lr=unwatermarked&..."
      }
    }
  }
```

---

## 💡 常见问题

### Q: 如果找不到API怎么办？

A: 可能的情况：
1. API调用很快，在开始抓包前就完成了
   - 解决：清空记录后重新测试
2. API使用了HTTPS加密
   - 解决：确认Charles证书已正确安装
3. 小程序使用WebSocket
   - 解决：在Charles中查看WS标签

### Q: 如果API需要登录怎么办？

A: 从抓包中复制完整的Cookie和所有headers

### Q: 如果URL参数很复杂怎么办？

A: 全部复制，不要遗漏任何参数

---

## 🚀 找到API后的下一步

一旦你找到并分享了API信息，我将：

1. ✅ 分析API的认证方式
2. ✅ 创建Python脚本复现请求
3. ✅ 验证是否能获取无水印URL
4. ✅ 创建自动化下载工具

---

## 📞 提供信息的格式

你可以这样分享：

```
我找到了API：

URL: https://...
Method: POST

Request Headers:
- User-Agent: ...
- Cookie: ...
- (其他所有headers)

Request Body:
{
  完整的JSON
}

Response:
{
  完整的JSON
}
```

或者直接把Charles/Stream的抓包记录截图/复制给我！

---

**记住：API调用通常在视频URL请求之前，查找时间最早的doubao.com相关请求！**
