# 🎯 手机端 API 抓包指南

## 📋 背景

我们通过手机抓包（iOS Stream）捕获了 3 次 v9-videoweb.doubao.com 的视频下载请求，但这些请求之前没有发现对应的 API 调用。本文件记录了尝试定位 API 的方法。

**已有的事实：**
- ✅ 手机端能抓到 `v9-videoweb.doubao.com` 的视频下载请求（URL 带 `lr=unwatermarked`）
- ✅ 这些 URL 的路径签名与 H5 不同
- ❌ 所有 URL 下载后的视频文件都带有水印
- ❌ 搜索 `unwatermarked` 关键词只匹配到视频下载请求本身

---

## 🔍 抓包方法

### 在 Stream 中需要寻找的目标

1. **视频 URL 之前的任何 API 调用**
   - 时间：在 `v9-videoweb.doubao.com` 请求**之前**
   - 域名：`*.doubao.com` 或其他 API 域名
   - 响应大小：< 50KB（JSON 通常 1-10KB）

2. **API 响应特征**
   - Content-Type: `application/json`
   - 可能包含 `video_url`、`main_url`、`video_id` 等字段
   - 也可能为 protobuf 格式（Content-Type: `application/x-protobuf`）

---

## 📱 操作步骤

### 步骤1：清空 Stream 记录
重新抓包以确保只抓取目标会话。

### 步骤2：触发视频下载
1. 在手机端操作（浏览器或微信内打开）
2. 输入豆包视频链接
3. 等待视频加载/播放

### 步骤3：在 Stream 中查找

#### 方法A：按时间顺序查看
1. 找到最早的 video-sharing / doubao.com 相关请求
2. 排除视频文件（判断依据：响应大小 > 100KB 或 Content-Type: video/mp4）
3. 重点关注响应为 JSON 的请求

#### 方法B：按响应内容搜索
在 Stream 搜索框中输入：
- `unwatermarked`
- `watermark`
- `video_url`

#### 方法C：检查非 HTTP 协议
如果 HTTP 请求中找不到，可能的情况：
- **WebSocket** — 检查 Stream 的 WebSocket 分类标签
- **Protobuf** — 注意 Content-Type 为 `application/x-protobuf` 或 `application/octet-stream` 的请求，响应体显示为二进制乱码

---

## 💡 注意事项

- 视频下载请求**之前**的请求数量可能很少（我们的经验：只有微信广告请求）
- API 调用和视频下载可能在 1-2 秒内完成，非常快
- 如果始终找不到，可能的原因：
  1. API 由手机端内置 SDK（非 HTTP）直接发起
  2. 视频 URL 在页面渲染时已内嵌在 HTML/JS 中
  3. 使用了 UDP/QUIC 协议，Stream 未捕获

---

## 🚀 找到 API 后提供的信息格式

```
URL: https://xxx
Method: POST

Headers:
- User-Agent: ...
- Cookie: ...
- 其他所有 headers

Request Body:
{
  完整的 JSON
}

Response:
{
  完整的 JSON
}
```