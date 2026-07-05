# 便捷下载 APP（com.lcw.easydownload）逆向分析报告

> **分析日期**：2026-07-05
> **工具**：脱壳 + JADX 反编译
> **包名**：com.lcw.easydownload
> **应用名**：便捷下载
> **规模**：75 个混淆包，OkHttp + FileDownloader + FFmpeg

---

## 一、关键发现

### 去水印完全在服务器端完成

```
客户端（App）                 服务器
用户复制豆包链接               ↓
       → POST /api/parse/ →  服务器抓取豆包页面
      common/parse            解析出无水印视频URL
       ← 返回 video URL  ←    
       → 直接下载视频      →   返回干净文件
```

**客户端只是一个"空壳"——没有任何本地的视频解析或去水印逻辑。**

---

## 二、HTTP API 结构

### 基础信息

| 项目 | 值 |
|------|---|
| 服务器 | `https://easydownload.flyinglife.cn` |
| 图片存储 | `http://qiniuyun.flyinglife.cn/`（七牛云） |
| 备用URL | `http://westsideapp.com/ed/note.php` |
| HTTP框架 | OkHttp + OkGo，HTTP/1.1 only |

### 核心 API 端点

| 端点 | 方法 | 用途 | 权限 |
|------|------|------|------|
| `/api/parse/common/parse` | POST | 通用平台解析 | 需登录 |
| `/api/parse/pro/parse` | POST | VIP 专业解析 | 付费 VIP |
| `/api/parse/short2long` | POST | 短链接还原 | 免费 |
| `/api/login/login` | POST | 登录获取 token | 注册用户 |

---

## 三、请求认证机制

### 登录流程

```
POST /api/login/login
Body: { "username": "xxx", "password": "md5(md5(rawPassword))", "timestamp": 1234567890 }
```

返回：`LoginEntity { loginId, token, timestamp, extra }` → 本地缓存

### API 请求签名

```java
// C0961b.java 核心签名算法
String signSource = loginId + timestamp + TOKEN;
String sign = md5(md5(signSource));  // 双重MD5
timestamp = 当前Unix时间(秒) + 登录时缓存的服务器时间偏移量

// URL 格式
/api/parse/common/parse?loginId=<id>&sign=<双重MD5>&timestamp=<时间戳>
```

### HTTP 请求头（全局）

```
channel: lzy
version: <app版本号>
secret: <md5(包名)>     ← 应用级密钥，用于反盗版检测
User-Agent: <自定义UA>
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
```

### 服务端反盗版检测

如果 `secret` 值不匹配，API 返回：

```json
{"code":403,"message":"高级功能已失效,盗版可耻，请支持正版！","data":""}
```

---

## 四、豆包的处理方式

### 路由逻辑（C0958j.java）

```java
if (str.contains("doubao.")) {
    C2559e.onEvent(activity, "doubao");    // 埋点
    return new C0912ad("豆包AI_");           // 交给通用解析器
}
```

**豆包与抖音/即梦/小红书等走完全相同的通用解析路径**，没有任何特殊端点和单独逻辑。

### 请求体格式

```json
{"url": "https://doubao.com/chat/xxxx/video/xxx"}
```

### 响应格式（ProParseEntity）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "title": "视频标题",
    "video": "https://xxx.mp4",      // ← 无水印视频直链
    "videoCover": "https://xxx.jpg",  // 封面图
    "videos": [],                     // 多视频列表
    "images": [],
    "musics": [],
    "text": ""
  }
}
```

---

## 五、内部解密逻辑

### URL 预处理

在调用通用 API 之前，APP 只对 URL 做了最小处理：

```
含 "doubao." → 标记为豆包平台
           → 提取原始 URL
           → POST 到服务器
```

**没有任何本地对 URL 的解析、提取、修改操作。**

### Cookie/登录态

- APP 用 OkHttp 自动管理 Cookie
- 但签名机制不依赖 Session Cookie，而是依赖 URL 参数 `loginId + sign + timestamp`
- 这意味着：**只要拿到有效的 loginId 和 token，就能通过纯 HTTP 调用 API**，无需模拟浏览器会话

---

## 六、对我们的启发

### 关键结论

> 「便捷下载」的成功说明：豆包服务端确实存在获取无水印视频 URL 的方法。这个方法不在客户端，而在服务器端。

### 推测的服务器端方法

服务器端可能使用以下方法之一：

| 可能性 | 描述 | 难度 |
|--------|------|------|
| 内部 API | 使用了我们不知道的内部 API 端点 | 高—需抓包或逆向服务端 |
| 任务提交 | 加密接口 + 轮询（旧方案） | 中—需分析服务器代码 |
| 不同协议 | WebSocket / protobuf（非 HTTP） | 高—需抓包分析 |
| 付费 API | 第三方付费去水印服务 | 低—需要资金 |
| 特权通道 | 与字节跳动有合作/授权 | 极高—无法复制 |

### 可操作性评估

| 方案 | 可行性 | 备注 |
|------|--------|------|
| 注册账号调 API | ⚠️ 可行 | 需要手机号注册，有使用限制 |
| 抓包已登录 APP | ✅ 最直接 | 用 mitmproxy 或其他代理抓真实请求 |
| 破解服务端逻辑 | ❌ 不可行 | 服务端不可见 |
| 利用开源项目 | ❌ 无效 | 已证实所有开源项目与我们一样 |

### 推荐方向

1. **抓包分析**：运行已登录的「便捷下载」APP，用 mitmproxy 抓包，记录完整的请求 URL 和 Headers
2. **注册账号**：如果 APP 支持免费层，直接注册调用
3. **对比服务端行为**：服务器端可能是直接访问了豆包的内部 API 或使用了不同的参数组合

---

## 七、反编译代码关键片段

### 签名方法（C0961b.java）

```java
public static String m1408cj(String str) {
    if (aiZ == 0 && C0953e.m1342pu() != null && ...) {
        aiZ = C0953e.m1342pu().getData().getLoginId();
    }
    if (TextUtils.isEmpty(TOKEN) && ...) {
        TOKEN = C0953e.m1342pu().getData().getgetToken();
    }
    long jM1344pw = C0953e.m1344pw() + aja;
    String strFl = m.fl(m.fl(String.valueOf(aiZ) + String.valueOf(jM1344pw) + TOKEN));
    return str + "?loginId=" + aiZ + "&sign=" + strFl + "&timestamp=" + jM1344pw;
}
```

### 通用解析器调用（C0948z.java）

```java
StringEntity stringEntity = (StringEntity) ek.h.e(
    C0960a.m1407ci(
        iVar.f(C0961b.m1408cj(C0848a.acN), map)  // acN = pro/parse
    ), 
    StringEntity.class
);
```

### ProParseEntity 字段

```java
public class ProParseEntity {
    private String image;
    private List<String> images;
    private String music;
    private List<String> musics;
    private String text;
    private String title;
    private String video;         // 单个无水印视频URL
    private String videoCover;    // 封面
    private List<String> videos;  // 多视频列表
}
```

---

## 八、附录：完整 API 列表

| API 变量 | URL |
|----------|-----|
| `acM` | `/api/parse/common/parse` |
| `acN` | `/api/parse/pro/parse` |
| `acj` | `/api/parse/short2long` |
| `acm` | `/api/parse/check` |
| `aco` | `/api/parse/ins` |
| `acq` | `/api/parse/wechat/video` |
| `acr` | `/api/parse/bilibili/video` |
| `acu` | `/api/parse/douyin/user` |
| `acz` | `/api/parse/m3u8` |
| `acV` | `/api/login/login` |
| `acU` | `/api/login/reg` |
| `acX` | `/api/login/check` |

---

> **分析师备注**：这份报告证实了服务器端存在真正的无水印视频能力。推荐后续通过抓包分析来获取实际请求参数，从而帮助我们的小程序/Edge 插件也能调用这一能力。