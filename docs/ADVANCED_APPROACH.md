# 豆包视频去水印 - 高级突破方向

## 🎯 正确的技术方向

基于你提供的关键洞察，我们需要放弃传统的REST API路线，转向更深层的协议分析。

---

## 📊 技术架构推测

### 豆包可能使用的架构

```
前端（小程序/Web）
    │
    ├─ REST API (我们已测试) ❌ 返回带水印
    │
    └─ WebSocket/Protobuf 协议 ✅ 可能返回无水印
        │
        ├─ 任务提交端点
        ├─ 二进制消息
        └─ Protobuf 序列化
```

### 为什么小程序能获取无水印

小程序可能：
1. 使用WebSocket持久连接
2. 发送Protobuf编码的请求
3. 调用了隐藏的任务提交端点
4. 使用了特殊的二进制协议

---

## 🔍 三个突破方向

### 方向1：分析豆包的 JS Bundle

#### 目标
找到小程序或Web页面的JavaScript代码中：
- API调用逻辑
- WebSocket连接代码
- Protobuf定义
- 加密/签名算法

#### 操作步骤

```bash
# 1. 访问豆包页面
https://www.doubao.com/video-sharing?share_id=xxx

# 2. 打开浏览器DevTools
按 F12

# 3. 进入 Sources 标签
查找所有 .js 文件

# 4. 搜索关键词
- "websocket"
- "protobuf"
- "unwatermarked"
- "task_submit"
- "binary"
- "encode"
```

#### 关键文件位置

```
可能的文件名：
- app.js
- main.js
- chunk-vendors.js
- doubao.bundle.js

搜索内容：
1. WebSocket 连接
   new WebSocket("wss://...")
   
2. Protobuf 使用
   protobuf.encode(...)
   protobuf.decode(...)
   
3. 任务提交
   submitTask(...)
   createTask(...)
   
4. 视频解析
   parseVideo(...)
   getVideoUrl(...)
```

---

### 方向2：抓取 WebSocket 连接

#### 在Charles中查看WebSocket

```
1. Charles -> Proxy -> Recording Settings
2. 勾选 "WebSockets"
3. 清空记录
4. 使用小程序解析视频
5. 查看 "WebSockets" 标签
```

#### 在浏览器DevTools中查看

```
1. F12 -> Network 标签
2. 过滤: WS (WebSocket)
3. 刷新页面或操作小程序
4. 点击 WebSocket 连接
5. 查看 "Messages" 标签
6. 查看发送/接收的消息
```

#### WebSocket消息特征

```
发送消息（可能）:
{
  "type": "parse_video",
  "data": {
    "url": "豆包分享链接",
    "no_watermark": true
  }
}

或二进制（Protobuf）:
[二进制数据]

接收消息（可能）:
{
  "type": "video_url",
  "data": {
    "url": "https://.../?lr=unwatermarked&...",
    "status": "success"
  }
}
```

---

### 方向3：Protobuf 协议逆向

#### 什么是 Protobuf

Protocol Buffers (Protobuf) 是一种二进制序列化格式：
- 比JSON更小
- 需要预定义的 schema
- 常用于高性能场景

#### 如何识别 Protobuf

在Network中查看：
```
Content-Type: application/x-protobuf
或
Content-Type: application/octet-stream

响应是二进制数据而不是JSON
```

#### Protobuf逆向工具

```bash
# 1. protobuf-inspector
pip install protobuf-inspector
protobuf_inspector < binary_data.bin

# 2. protoc
# 如果能找到 .proto 文件定义
protoc --decode=MessageType schema.proto < data.bin

# 3. 在线工具
https://protogen.marcgravell.com/decode
```

---

## 🛠️ 实战操作指南

### 步骤1：检查浏览器Network

```
1. 访问豆包视频页面
2. F12 -> Network
3. 查找以下类型的请求：
   - Type: websocket
   - Type: other (可能是二进制)
   - Protocol: h2 或 h3 (HTTP/2, HTTP/3)
```

### 步骤2：分析JavaScript代码

```javascript
// 在 DevTools Console 中执行
// 查找全局对象中的线索

console.log(window);

// 搜索特定对象
Object.keys(window).filter(key => 
  key.toLowerCase().includes('socket') ||
  key.toLowerCase().includes('proto') ||
  key.toLowerCase().includes('parse')
);

// 查看是否有 protobuf 库
if (window.protobuf || window.dcodeIO) {
  console.log('发现 Protobuf 库！');
}
```

### 步骤3：监听WebSocket

```javascript
// 在 Console 中注入监听代码
const originalWebSocket = window.WebSocket;
window.WebSocket = function(...args) {
  console.log('WebSocket 连接:', args[0]);
  const ws = new originalWebSocket(...args);
  
  ws.addEventListener('message', function(event) {
    console.log('收到消息:', event.data);
  });
  
  const originalSend = ws.send;
  ws.send = function(data) {
    console.log('发送消息:', data);
    return originalSend.call(this, data);
  };
  
  return ws;
};
console.log('WebSocket 监听已注入');
```

---

## 📱 小程序端分析

### 微信小程序的特殊性

小程序使用微信提供的API：
```javascript
// 小程序中可能使用
wx.request()      // HTTP请求
wx.connectSocket() // WebSocket连接
wx.sendSocketMessage() // 发送WebSocket消息
```

### 反编译小程序

如果能获取小程序包（.wxapkg），可以：

```bash
# 1. 解包
node wuWxapkg.js package.wxapkg

# 2. 查看源代码
# 解包后的文件在当前目录

# 3. 搜索关键代码
grep -r "unwatermarked" .
grep -r "websocket" .
grep -r "protobuf" .
grep -r "parseVideo" .
```

---

## 🎯 关键突破点

### 需要找到的信息

1. **WebSocket URL**
   ```
   wss://ws.doubao.com/...
   或
   wss://api.doubao.com/ws
   ```

2. **消息格式**
   ```javascript
   // JSON格式
   {
     "action": "parse",
     "data": {...}
   }
   
   // 或 Protobuf格式
   [二进制数据]
   ```

3. **认证方式**
   ```javascript
   // 连接时的认证
   ws = new WebSocket(url, {
     headers: {
       'Authorization': 'Bearer xxx',
       'X-Token': 'xxx'
     }
   });
   ```

4. **Protobuf Schema**
   ```protobuf
   message ParseRequest {
     string video_url = 1;
     bool no_watermark = 2;
   }
   
   message ParseResponse {
     string video_url = 1;
     string status = 2;
   }
   ```

---

## 💡 你可以做什么

### 选项1：浏览器分析（最简单）

```
1. 访问豆包视频页面
2. F12 -> Network
3. 过滤 WS
4. 刷新页面
5. 查看是否有WebSocket连接
6. 截图分享给我
```

### 选项2：JavaScript源码搜索

```
1. F12 -> Sources
2. Ctrl+Shift+F 全局搜索
3. 搜索: "websocket" 或 "unwatermarked"
4. 找到相关代码
5. 复制分享给我
```

### 选项3：小程序抓包（最准确）

```
1. 使用Stream继续抓包
2. 特别注意：
   - WebSocket连接
   - 二进制请求（非JSON）
   - 非标准端口的连接
3. 分享所有发现
```

---

## 🚀 一旦找到

如果找到WebSocket端点或Protobuf协议：

1. ✅ 我可以复现连接
2. ✅ 分析消息格式
3. ✅ 创建Python客户端
4. ✅ 自动化获取无水印URL

---

## 📊 技术难度评估

| 方法 | 难度 | 成功率 | 所需工具 |
|:-----|:-----|:-------|:---------|
| 分析JS源码 | ⭐⭐⭐ | 80% | 浏览器 |
| 抓WebSocket | ⭐⭐ | 90% | Charles/Stream |
| Protobuf逆向 | ⭐⭐⭐⭐⭐ | 60% | 专业工具 |
| 反编译小程序 | ⭐⭐⭐⭐ | 70% | 技术能力 |

---

**推荐：先尝试在浏览器中查找WebSocket连接，这是最直接的方法！**
