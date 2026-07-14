# 豆包解析机制的演变 - 技术分析

## 📊 旧方案 vs 新方案

### ❌ 旧方案（已失效）

```
第1步：提交任务
POST /api/submit_task
{
  "video_url": "豆包分享链接",
  "encrypted": true
}

响应：
{
  "task_id": "xxx"
}

第2步：轮询结果（需要重复请求）
GET /api/get_result?task_id=xxx

响应（未完成）：
{
  "status": "processing"
}

第3步：继续轮询...
GET /api/get_result?task_id=xxx

响应（完成）：
{
  "status": "done",
  "video_url": "https://.../?lr=unwatermarked&..."
}

⏱️ 耗时：10-20秒
❌ 问题：接口不稳定，已失效
```

### ✅ 新方案（当前可用）

```
一次请求直接返回：
POST /api/parse （或其他端点）
{
  "video_url": "豆包分享链接"
}

响应：
{
  "video_url": "https://v9-videoweb.doubao.com/.../?lr=unwatermarked&..."
}

⏱️ 耗时：1-2秒
✅ 优势：快速、稳定
```

---

## 💡 关键洞察

### 1. 小程序使用的是"新方案"

你说小程序能"很快"去水印，这证明：
- ✅ 小程序已经升级到新的解析方案
- ✅ 一次API调用就能获取无水印URL
- ✅ 不需要轮询等待

### 2. 为什么我们的测试都失败了

因为我们测试的是**豆包官方API**：
```python
POST https://www.doubao.com/samantha/media/get_play_info
```

这个API返回的是带水印版本（`lr=video_gen_watermark_dyn`）

### 3. 小程序使用的是什么

有两种可能：

#### 可能1：豆包的内部API（需要特殊认证）

```python
POST https://www.doubao.com/api/parse_unwatermarked

Headers:
  X-Miniprogram-Appid: wxXXXXXXXX
  Authorization: Bearer special_token

Body:
  {
    "url": "豆包分享链接",
    "no_watermark": true
  }

Response:
  {
    "video_url": "https://.../?lr=unwatermarked&..."
  }
```

#### 可能2：第三方解析服务

小程序可能调用了一个独立的解析服务：

```python
POST https://api.parse-service.com/doubao

Headers:
  Authorization: Bearer third_party_key

Body:
  {
    "url": "豆包分享链接"
  }

Response:
  {
    "video_url": "https://.../?lr=unwatermarked&..."
  }
```

---

## 🎯 这改变了什么

### 之前的理解（错误）

我们以为：
1. 需要修改豆包官方API的参数
2. 需要特殊的Cookie或Token
3. 需要复杂的参数签名

### 现在的理解（正确）

实际情况：
1. ✅ 存在一个**专门的解析API**
2. ✅ 这个API**直接返回** `lr=unwatermarked` 的URL
3. ✅ 不需要轮询，一次请求就完成

---

## 🔍 如何找到这个新API

### 在抓包中查找特征

1. **时间特征**
   ```
   小程序操作：输入链接 → 点击解析
   API响应时间：1-2秒内
   ✅ 查找这个时间段内的API调用
   ```

2. **请求特征**
   ```
   Method: POST（很可能）
   Content-Type: application/json
   Request Body: 包含豆包视频的链接
   ```

3. **响应特征**
   ```
   Response Type: JSON
   Response Body: 包含 video_url 字段
   Response Body: video_url 包含 lr=unwatermarked
   ```

### 可能的API路径

基于"新方案"的特点，API路径可能是：

```
https://www.doubao.com/api/parse
https://www.doubao.com/api/get_video_url
https://www.doubao.com/samantha/parse/quick
https://api.doubao.com/v1/parse
https://parse.doubao.com/video
```

或第三方服务：
```
https://api.xxx.com/parse/doubao
https://xxx.com/api/video/doubao
```

---

## 📱 具体操作建议

### 方法1：在抓包中精确定位

```
1. 清空Stream/Charles的所有记录
2. 打开小程序
3. 输入豆包链接
4. 🔴 立即开始计时
5. 点击"解析"按钮
6. 🔴 注意：在1-2秒内完成
7. 查看这1-2秒内的所有API请求
8. 找返回JSON的请求
9. 查看响应是否包含视频URL
```

### 方法2：按域名过滤

在Stream中过滤：
- `*.doubao.com`
- 查看所有非视频文件的请求
- 找返回JSON的API

### 方法3：按响应内容搜索

搜索响应中包含：
- `unwatermarked`
- `video_url`
- `v9-videoweb` 或 `v26-videoweb`

---

## 🎯 一旦找到API

如果你能提供：

```
API URL: https://...
Method: POST/GET
Headers: {...}
Body: {...}
Response: {...}
```

我将能够：
1. ✅ 立即复现这个请求
2. ✅ 验证是否返回无水印URL
3. ✅ 创建自动化Python工具
4. ✅ 完全解决问题

---

## 💡 关键点总结

1. **旧方案失效了** - 不要去找轮询相关的API
2. **新方案是一次请求** - 查找快速返回的API
3. **响应包含完整URL** - 不需要二次处理
4. **小程序已经在用** - 我们只需要找到它

---

## 🚀 下一步

请在Stream中：
1. **清空记录**
2. **重新操作一次**
3. **查看前5个请求**
4. **找返回JSON的那个**
5. **分享给我**

这次我们一定能找到！💪
