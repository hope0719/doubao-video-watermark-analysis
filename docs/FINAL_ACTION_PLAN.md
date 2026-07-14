# 🎯 豆包视频去水印 - 最终行动计划

## 📊 当前状态总结

### ✅ 已确认的事实

1. **小程序确实能获取无水印视频**
   - 你提供的抓包显示 `lr=unwatermarked`
   - ETag不同：`f60fda9b4a5b32bf9462a971b1901851`
   - 文件大小不同：598,251 bytes

2. **公开REST API只返回带水印版本**
   - 测试了17个API端点
   - 测试了31种参数组合
   - 所有结果：MD5 = `40b21e0f35b657a0e08a8f4f8d21cfdb`

3. **直接修改URL参数无效**
   - 手动修改 `lr=unwatermarked` 会被CDN拒绝
   - 参数签名验证机制

4. **新的解析方案**
   - 不需要轮询，一次请求返回结果
   - 可能使用WebSocket或Protobuf协议

### ❓ 待确认的问题

1. 小程序使用的具体API端点
2. 是否使用WebSocket连接
3. 是否使用Protobuf二进制协议
4. 认证机制（Token/Cookie）

---

## 🎯 三种可行的突破方案

### 方案A：抓包小程序的API调用（推荐度：⭐⭐⭐⭐⭐）

**为什么推荐：** 最直接，最可靠

**需要做的：**

1. **清空抓包记录**
   ```
   Stream/Charles: 清空所有记录
   ```

2. **重新操作小程序**
   ```
   - 打开小程序
   - 输入豆包链接
   - 点击"解析"
   - 等待1-2秒
   ```

3. **查找API调用**
   ```
   关键特征：
   - 时间：在视频URL出现之前
   - 类型：JSON响应或二进制
   - 响应：包含 unwatermarked 的URL
   ```

4. **记录完整信息**
   ```
   - URL
   - Method (POST/GET)
   - Headers（所有）
   - Body（完整）
   - Response（完整）
   ```

**如果成功：** 立即可以复现，创建自动化工具

---

### 方案B：分析浏览器JavaScript（推荐度：⭐⭐⭐⭐）

**为什么推荐：** 可以找到API逻辑和WebSocket连接

**需要做的：**

1. **访问豆包视频页面**
   ```
   https://www.doubao.com/video-sharing?share_id=xxx
   ```

2. **打开DevTools**
   ```
   按 F12
   ```

3. **运行监听脚本**
   ```javascript
   // 复制 inject_monitor.js 的内容
   // 粘贴到 Console 中
   // 按 Enter 运行
   ```

4. **操作页面**
   ```
   - 刷新页面
   - 播放视频
   - 观察Console输出
   ```

5. **查找线索**
   ```
   - WebSocket连接
   - 包含 unwatermarked 的消息
   - Protobuf二进制数据
   ```

**如果成功：** 找到WebSocket或API端点

---

### 方案C：联系小程序开发者（推荐度：⭐⭐⭐）

**为什么推荐：** 如果开发者愿意分享，最快捷

**小程序名称（根据搜索结果）：**
- 小青去水印
- 坤坤去水印
- 小哲去水印
- 野马去水印

**可以尝试：**
1. 在小程序中查找"关于"或"联系方式"
2. 在GitHub搜索相关项目
3. 在技术论坛发帖询问

---

## 🛠️ 具体操作指南

### 🎬 操作A：使用监听脚本（最简单）

**步骤1：准备**
```bash
# 1. 打开文件
open -e /Users/hope/Desktop/个人作品集/inject_monitor.js

# 2. 全选复制（Cmd+A, Cmd+C）
```

**步骤2：运行**
```
1. 打开 Chrome 浏览器
2. 访问 https://www.doubao.com
3. 按 F12 打开DevTools
4. 切换到 Console 标签
5. 粘贴脚本（Cmd+V）
6. 按 Enter 运行
```

**步骤3：观察**
```
1. 在页面中操作（播放视频等）
2. 观察Console的输出
3. 查找包含 unwatermarked 的消息
4. 截图或复制发给我
```

---

### 🎬 操作B：Stream抓包（最准确）

**步骤1：准备**
```
1. 打开Stream应用
2. 点击"清空"按钮
3. 确保抓包已开启
```

**步骤2：操作**
```
1. 打开微信
2. 打开去水印小程序
3. 输入豆包链接
4. 点击"解析"
5. 等待完成
```

**步骤3：查找**
```
在Stream中查找：
1. 时间最早的几个请求
2. 域名包含 doubao.com 的
3. 响应类型是JSON的
4. 响应包含 video_url 的
```

**步骤4：分享**
```
找到后，点击请求，复制：
1. 请求URL
2. 所有Headers
3. Request Body
4. Response Body
```

---

## 📋 需要提供的信息格式

### 格式1：API调用信息

```
找到了API！

URL: https://...
Method: POST

Headers:
  User-Agent: ...
  Cookie: ...
  Authorization: ... (如果有)
  X-xxx: ... (所有特殊headers)

Body:
{
  "url": "...",
  ...完整的JSON...
}

Response:
{
  "video_url": "https://.../?lr=unwatermarked&...",
  ...完整的JSON...
}
```

### 格式2：WebSocket信息

```
发现WebSocket连接！

URL: wss://...

连接时的Headers:
  ...

发送的消息:
  ...

收到的消息:
  ...
```

### 格式3：JavaScript代码

```
在源代码中找到了：

文件: main.js
行号: 1234

代码:
function parseVideo(url) {
  ...
}
```

---

## 🎯 成功标准

找到以下任何一项即为成功：

✅ **API端点** - 能返回 `lr=unwatermarked` 的URL
✅ **WebSocket URL** - 能接收视频URL的WebSocket连接
✅ **Protobuf Schema** - 消息格式定义
✅ **完整的请求示例** - Headers + Body + Response

---

## 💡 常见问题

### Q1: 我不会使用这些工具怎么办？

A: 选择最简单的方案A（运行监听脚本）：
1. 复制 inject_monitor.js 的内容
2. 粘贴到浏览器Console
3. 操作页面
4. 截图输出

### Q2: 如果找不到API怎么办？

A: 可能的情况：
1. API调用太快 → 多试几次
2. 使用了加密 → 需要分析JS源码
3. 第三方服务 → 查看所有域名的请求

### Q3: 找到后你会做什么？

A: 我会：
1. ✅ 分析并复现请求
2. ✅ 创建Python自动化工具
3. ✅ 验证无水印
4. ✅ 提供完整解决方案

---

## 🚀 预期时间

| 方案 | 所需时间 | 技术要求 |
|:-----|:--------|:---------|
| 方案A (JS监听) | 10分钟 | 无 |
| 方案B (抓包) | 20分钟 | 基础 |
| 方案C (联系开发者) | 不确定 | 无 |

---

## 📞 随时联系

如果你：
- ✅ 找到了API
- ✅ 发现了WebSocket
- ✅ 看到了可疑的代码
- ❓ 遇到了任何问题

**立即分享给我，我会帮你分析！**

---

## 🎯 最后的话

我们已经非常接近答案了：

1. ✅ 确认了无水印版本存在
2. ✅ 确认了小程序能获取
3. ✅ 确认了新的解析方案
4. ❓ 只差找到具体的API

**下一步：运行监听脚本或重新抓包，找到那个API！**

让我们一起完成最后的突破！💪
