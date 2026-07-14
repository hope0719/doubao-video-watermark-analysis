# 豆包AI视频去水印 — 完整技术分析报告

> **报告日期**：2026-07-04  
> **分析视频**：`v0269cg10004d946i5iljhtf2dunr5e0`  
> **分享链接**：`https://www.doubao.com/video-sharing?source_type=mobile&share_id=49152711347982082&video_id=v0269cg10004d946i5iljhtf2dunr5e0`  
> **分析环境**：未登录态（curl）+ 登录态（Playwright 浏览器自动化）+ 15个开源项目源码分析

---

## 目录

1. [分析方法论](#一分析方法论)
2. [API端点全集与测试结果](#二api端点全集与测试结果)
3. [CDN签名机制与参数分析](#三cdn签名机制与参数分析)
4. [登录态与创作者后台探测](#四登录态与创作者后台探测)
5. [开源项目调研汇总](#五开源项目调研汇总)
6. [历史版本回溯与根因分析](#六历史版本回溯与根因分析)
7. [核心结论与建议](#七核心结论与建议)

---

## 一、分析方法论

### 1.1 全链路分析路径

```
JS bundle 逆向 → API 端点提取 → 逐个调用测试 → 
CDN 参数操控 → 登录态探测 → 浏览器播放器抓取 → 
15 个开源项目源码比对 → 历史版本回溯
```

### 1.2 工具链

| 工具 | 用途 |
|------|------|
| curl | 无状态 HTTP 请求，测试 API 返回和 CDN 参数 |
| Playwright (headless Chromium) | 浏览器自动化，拦截网络请求，检查 DOM 和 video 元素 |
| JS bundle 分析 | 从 webpack 打包的 JS 中逆向 API 路径 |
| MD5 校验 | 对比不同 URL 参数下下载文件的完整性 |
| `diff` 版本对比 | 回溯 Edge 插件版本间关键逻辑变化 |

### 1.3 关键 JS 源码文件

| 文件 | 大小 | 用途 |
|------|------|------|
| `video-sharing.aa4b10d2.js` | 10.7KB | 分享页入口逻辑，调用 GetVideoShareInfo |
| `42472.b1ed7bae.js` | ~500KB | API 服务定义层，包含所有 `genBaseURL()` 端点 |
| `chat.b41637e4.js` | 1.1MB | 聊天页主 bundle，含下载按钮插件 |

---

## 二、API端点全集与测试结果

### 2.1 端点发现方法

从 JS 源码中用正则提取所有 `genBaseURL(...)` 调用，共约 200+ 端点。筛选出视频/媒体/创作相关的端点逐一测试。

### 2.2 核心 API 详细测试

#### API-1: `GetVideoShareInfo`（视频分享页主 API）

```
POST /creativity/share/get_video_share_info
```

**请求参数：**
```json
{
  "share_id": "49152711347982082",
  "vid": "v0269cg10004d946i5iljhtf2dunr5e0",
  "creation_id": ""
}
```

**响应结构：**
```json
{
  "code": 0,
  "data": {
    "play_info": {
      "main": "https://v5-se-gddgtc-default.365yg.com/.../oUlI4Dca...?cs=4&lr=video_gen_watermark_dyn",
      "backup": "https://v11-default.365yg.com/.../oUlI4Dca...?cs=4&lr=video_gen_watermark_dyn",
      "height": 720, "width": 1280, "definition": "720p"
    },
    "user_info": {"user_id": "3960900312632624", "nickname": "刘同学"},
    "prompt": "生成一个男生在电脑前打字的视频"
  }
}
```

**测试结果：**
- CDN 域名不固定（每次请求可能返回不同域名：`365yg.com`、`videoweb.doubao.com` 等）
- 低码率版本：~590KB, cs=4, 912kbps
- **带水印** ✅

**`download_params` 参数专项测试：**

通过 JS 源码发现 API 定义中包含 `download_params` 透传参数，测试了各种变体：

| 参数值 | API 响应 | URL 水印 |
|--------|---------|---------|
| 不传 | 正常 | `video_gen_watermark_dyn` |
| `{}` | 正常 | `video_gen_watermark_dyn` |
| `{"with_watermark":false}` | 正常 | `video_gen_watermark_dyn` |
| `{"no_watermark":true}` | 正常 | `video_gen_watermark_dyn` |

**结论：`download_params` 不影响水印。**

---

#### API-2: `GetPlayInfo`（聊天页视频播放 API）

```
POST /samantha/video/get_play_info
```

**请求参数：**
```json
{"vid": "v0269cg10004d946i5iljhtf2dunr5e0"}
```

**响应结构：**
```json
{
  "code": 0,
  "data": {
    "view_count": 11,
    "play_infos": [{
      "definition": "720p",
      "main": "https://v6-show.douyinvod.com/.../oAL2sE3JQ...?cs=0&lr=video_gen_watermark_dyn&download=true",
      "height": 720, "width": 1280
    }]
  }
}
```

**测试结果：**
- 高码率版本：~844KB, cs=0, 1303kbps
- CDN 域名：`v26-show.douyinvod.com`（抖音 CDN）
- 聊天页 video 元素的实际播放源就是这个 URL
- **带水印** ✅

---

#### API-3: `GetPlayInfo`（原无水印 API — 核心路径）

```
POST /samantha/media/get_play_info
```

**请求参数：**
```json
{"key": "v0269cg10004d946i5iljhtf2dunr5e0"}
```

**注意：** 路径是 `/media/get_play_info`（与 API-2 的 `/video/get_play_info` 不同），参数名是 `key` 不是 `vid`。

**响应结构：**
```json
{
  "data": {
    "media_type": "video",
    "media_info": [{
      "meta": {"definition": "720p", "codec_type": "h264"},
      "main_url": "https://v26-videoweb.doubao.com/.../oAL2sE3JQ.../?...&lr=video_gen_watermark_dyn&download=true"
    }],
    "original_media_info": {
      "meta": {"definition": "720p"},
      "main_url": "https://v26-videoweb.doubao.com/.../oAL2sE3JQ.../?...&lr=video_gen_watermark_dyn&download=true"
    },
    "poster_url": "...",
    "playable_status": 1
  }
}
```

**关键发现：**
- `original_media_info` 字段**仍然存在**
- 但 `original_media_info.main_url` 与 `media_info[0].main_url` **完全相同**——同一文件标识、同一 lr 参数
- 历史上（v7-v8 时期），`original_media_info` 返回的是不带 `lr` 参数的 `v26-videoweb.doubao.com` URL，即无水印原片
- **字节已关闭这条路径**

---

#### API-4: `DownloadWatermark`（水印下载 API）

```
POST /alice/resource/watermark_download?uri=<fileId>&url=<完整URL>&scene=video&sub_scene=download&content_type=video&file_type=mp4
```

JS 源码定义：
```javascript
// 从 webpack bundle 逆向得到的 API 调用
DownloadWatermark(e, t) {
  let r = e || {};
  let i = this.genBaseURL("/alice/resource/watermark_download");
  let n = { uri: r.uri, url: r.url, scene: r.scene,
            sub_scene: r.sub_scene, content_type: r.content_type, file_type: r.file_type };
  return this.request({ url: i, method: "POST", params: n }, t);
}
```

**测试结果：**
```json
{"code": 0, "msg": "success", "data": {"status": "ready", "download_url": "https://v26-show.douyinvod.com/", "task_id": ""}}
```

**关键发现：**
- `download_url` 指向同一带水印文件（与 video.src 相同）
- `task_id` 为空——**没有创建水印处理任务**
- 不同 `scene`/`sub_scene` 参数值返回相同结果

---

#### API-5: `ResourceSignUrlV2`（签名 URL 生成）

```
POST /alice/resource/v2/sign_url
Body: {"params": [{"uri": "oAL2sE3...", "resource_type": "video"}], "encrypted": false}
```

**结果：**
```json
{"code": 2004, "msg": "资源不存在或无权限"}
```

**结论：** 只适用于 ImageX 图片资源（`byteimg.com` 域名），不支持视频。

---

#### API-6 ~ API-17（其他已排除端点）

| API | 端点 | 结果 |
|-----|------|------|
| TaskPoll | `GET /alice/resource/watermark_task` | task_id 为空，无法轮询 |
| QueryVideoGenInfo | `POST /samantha/video/query_video_gen_info` | 只返配额，无视频URL |
| GetResourceConfig | `POST /alice/resource/get_config` | 只返短链配置 |
| LoadVideoTT | `POST /alice/media/source/2` | 系统错误 710010202 |
| LoadVideoDY | `POST /alice/media/source/3` | 系统错误 |
| LoadMusicQS | `POST /alice/media/source/4` | 系统错误 |
| AGWGetArtifactMetaByResource | `POST /samantha/creation/artifact/get_meta_by_resource` | 空元数据 |
| GetArtifact | `POST /samantha/creation/artifact/get` | 需整数 ID |
| SearchVideo | `POST /samantha/search/video` | 参数无效 |
| DouyinPlayback | `POST /alice/message/douyin_playback` | 需加密消息 ID |
| SessionPlayback | `POST /alice/message/session_playback` | 需加密消息 ID |
| GetMessageReply | `POST /alice/message/get_reply` | 需正确的 message_id |

ม

### 2.3 三个核心 API 返回的视频对比

| 对比项 | API-1: get_video_share_info | API-2: video/get_play_info | API-3: media/get_play_info |
|--------|---------------------------|---------------------------|---------------------------|
| 文件标识 | `oUlI4Dca1...` | `oAL2sE3JQ...` | `oAL2sE3JQ...` |
| 码率 | 912kbps | 1303kbps | 1303kbps |
| 大小 | ~590KB | ~844KB | ~844KB |
| cs 参数 | cs=4 | cs=0 | cs=0 |
| **水印** | **有** | **有** | **有** |

---

## 三、CDN签名机制与参数分析

### 3.1 URL 结构拆解

```
https://v26-show.douyinvod.com/cecbe12c76980dee62f318ff5cd47a46/6a51a93c/video/tos/cn/tos-cn-v-9ecd54/oAL2sE3JQSv4II1R14Ep34eH09AIhDKaAlMc4B/
?a=1938&ch=0&cr=0&dr=0&er=0&lr=video_gen_watermark_dyn
&cd=0%7C0%7C0%7C0&cv=1&br=1303&bt=1303&cs=0&ds=3
&ft=9eUQ9bBOBBkq8ZmolKRvk_vjVQWw
&mime_type=video_mp4&qs=0
&rc=ZzQ7NzQ2NGlkZjw6MzllM0BpMzhxZ2lrbzg5PDczNGY5M0AwYy8vLWA1NWMxLmItLjBiYSNib3IvcWdmZjFhLS1kNi9zcw%3D%3D
&btag=80000e00008000&dy_q=1783131831&feature_id=e38567d78da7ae34faf3833d9e13c66f
&l=202607041023511C118336EA67FC4F6975&download=true
```

| 组成部分 | 值 | 含义 |
|---------|------|------|
| 域名 | `v26-show.douyinvod.com` | 抖音 CDN，非豆包 CDN |
| 签名 hash（路径） | `cecbe12c...` (32 hex) | 32位 MD5，URL 权限签名 |
| 过期时间 | `6a51a93c` | Unix 时间戳 hex |
| 文件标识 | `oAL2sE3J...` | TOS 对象存储 key |
| `lr` | `video_gen_watermark_dyn` | 水印渲染模式标签 |
| `cs` | `0` 或 `4` | 编码配置版本 |
| `ft` | `9eUQ9bBO...` | 缓存 nonce 签名 |
| `rc` | base64 编码 | 缓存签名 |
| `download` | `true` | 下载许可标识 |

### 3.2 参数操控穷举测试

逐个去掉或修改所有 URL 参数，下载文件并对比 MD5：

```bash
# 参数操控测试核心逻辑（伪代码）
for each 参数 in [lr, ft, cs, cr, dr, download, btag, feature_id, l, rc, qs]:
    去掉该参数 → curl -sI URL → 比对 etag 和 content-length
```

**完整测试矩阵：**

| 测试项 | 修改方式 | etag 变化？ | 文件大小变化？ | 结论 |
|-------|---------|:----------:|:------------:|------|
| 原始 URL | 不变 | 基准 | 844KB（cs=0） | 基准 |
| 去掉 `lr` | 删除参数 | ❌ 不变 | ❌ 不变 | 标签，不影响文件 |
| `lr=none` | 替换值 | ❌ 不变 | ❌ 不变 | 同上 |
| `lr=video_gen_no_watermark` | 替换值 | ❌ 不变 | ❌ 不变 | 无效 |
| 去掉 `download` | 删除参数 | ❌ 不变 | ❌ 不变 | 不影响文件 |
| 去掉 `ft` | 删除参数 | ❌ 不变 | ❌ 不变 | nonce，非权限控制 |
| `ft=AAAA` | 随机值 | ❌ 不变 | ❌ 不变 | 同上 |
| 去掉 `btag` | 删除参数 | ❌ 不变 | ❌ 不变 | 无效 |
| 去掉 `feature_id` | 删除参数 | ❌ 不变 | ❌ 不变 | 无效 |
| 去掉 `l` | 删除参数 | ❌ 不变 | ❌ 不变 | 时间戳 |
| 去掉 `rc` | 删除参数 | ❌ 不变 | ❌ 不变 | 无效 |
| 去掉 `dy_q` | 删除参数 | ❌ 不变 | ❌ 不变 | 无效 |
| 改 `cr=7&dr=3` | 替换 | ❌ 不变 | ❌ 不变 | 无效 |
| 改 `cs=4` | 替换值 | ❌ 不变 | ❌ 不变 | 编码配置 |

**关键发现：** `ft=` 参数虽然看起来像权限签名 token，但改为空值或随机值后 etag 完全不变——说明它只是缓存 nonce，不是水印权限控制。

### 3.3 CDN 域名与路径变体测试

| 测试项 | HTTP 状态 | 结论 |
|-------|:--------:|------|
| 原始 `v26-videoweb.doubao.com` | 200 | 有效 |
| `v9-videoweb.doubao.com` | 200 | 可访问，但需要正确路径签名 |
| 随机 hash（路径第1段） | 403 | 路径签名绑定文件 |
| `tos-cn-v-9ecd54`（原始） | 200 | 唯一有效路径 |
| `tos-cn-o-9ecd54` | 403 | 不存在 |
| `tos-cn-r-9ecd54` | 403 | 不存在 |
| `fileId~noop` | 403 | 图片专属模板不适用于视频 |

---

## 四、登录态与创作者后台探测

### 4.1 登录态下的额外发现

通过 Playwright 在已登录的浏览器上下文中：

1. **`credentials: 'include'` 调 API**——返回的 URL 与未登录态**完全相同**

```javascript
// 登录态下调用 get_play_info（关键代码骨架）
const response = await fetch(url, {
  method: 'POST',
  credentials: 'include',  // 带浏览器 Cookie
  headers: {
    'Content-Type': 'application/json',
    'origin': 'https://www.doubao.com',
  },
  body: JSON.stringify({ key: vid }),
});
const result = await response.json();
let main_url = result.data.original_media_info.main_url;
// 结果：带 Cookie 和不带 Cookie 返回相同文件标识、相同 lr 参数
```

2. **聊天页下载按钮测试**——点击视频下方的下载图标，仅触发一个 GET 请求，URL 就是 video 元素的 src（带水印的抖音 CDN URL），**没有调用任何额外 API**

3. **React Fiber 遍历**——在登录态聊天页遍历 React 组件树寻找 `creation-download` 相关插件，但 xgplayer 播放器在 React 外部创建 video 元素

4. **JS bundle 搜索 `watermark` 关键词**——在全部 4 个 JS bundle 中搜索，结果：

| 搜索词 | chat.js (1.1MB) | 92466.js (814KB) | 42472.js (500KB) | video-sharing.js (10.7KB) |
|-------|:--------------:|:---------------:|:---------------:|:------------------------:|
| `watermark` | 无 | 无 | 有（API 定义） | 无 |
| `no_watermark` | 无 | 无 | 无 | 无 |
| `raw_video` | 无 | 无 | 无 | 无 |

**结论：客户端 JS 中无水印控制逻辑——水印完全由服务端控制。**

---

## 五、开源项目调研汇总

从 GitHub 调研了 15 个相关开源项目，逐一分析其核心去水印逻辑。

### 5.1 项目列表与状态

| # | 项目 | ⭐ | 类型 | 视频去水印方法 | 当前有效？ |
|:-:|------|:-:|:----:|:--------------:|:--------:|
| 1 | catscarlet 视频分享去水印 | 0 | 油猴 | `get_play_info` + `credentials:include` | ❌ |
| 2 | catscarlet 实验版(图片+视频) | 2 | 油猴 | `/samantha/video/get_play_info` 另一路径 | ❌ |
| 3 | xiaoka6688 AI去水印扩展 | — | Chrome 扩展 | `get_play_info` + 改 `lr=no_watermark` | ❌ |
| 4 | Luncot 豆包下载器加强版 | 5 | 浏览器扩展 | 同上 | ❌ |
| 5 | catscarlet 预览图去水印(早期) | 14 | 油猴 | **仅图片，无视频** | ✅ 图片 |
| 6 | wan-kong 豆包在线工具 | — | Next.js | `get_video_share_info` + 微信 UA | ❌ |
| 7 | Qalxry 豆包无水印油猴 (⭐最多) | **149** | 油猴 | **仅图片，无视频** | ✅ 图片 |
| 8 | gosick233-cloud 豆包自由版 | 0 | Chrome 扩展 | `get_play_info` + 改 `lr=no_watermark` | ❌ |
| 9 | huige-opc 水印消失术 | 0 | Chrome 扩展 | `get_play_info` + `credentials:include` | ❌ |
| 10 | scoutchloe 豆包去水印 | — | Chrome 扩展 | **仅图片** | ✅ 图片 |
| 11 | ihmily 无印豆包 | — | API+Edge+油猴 | `get_play_info` + `credentials:include` | ❌ |
| 12 | skeptrunedev declank | 5 | CLI+Web UI | **AI 后处理去水印**（图片） | ❌ 视频不可行 |
| 13 | johndelapena168 无头 API | 1 | Node API | **仅图片生成** | ❌ |
| 14 | qq6865373 短视频去水印 API | 1 | Chrome 扩展 | **仅图片** | ✅ 图片 |
| 15 | wiltodelta ComfyUI节点 | — | ComfyUI 节点 | **AI inpainting 修复** | ❌ 视频不可行 |

### 5.2 核心代码模式

所有项目的视频去水印代码都遵循同一模式（以项目 11 的 Python 代码为例）：

```python
import httpx

async def doubao_video_parse(url: str) -> dict:
    # 1. 提取 video_id
    if "video_id=" in url:
        vid = extract_query_param(url, "video_id")
    
    # 2. 调用 get_play_info
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.doubao.com/samantha/media/get_play_info",
            params={
                "version_code": "20800",
                "language": "zh-CN",
                "device_platform": "web",
                "aid": "497858",
            },
            headers={
                "User-Agent": "Mozilla/5.0 ...",
                "origin": "https://www.doubao.com",
            },
            json={"key": vid},
        )
        result = response.json()
        
        # 3. 取 original_media_info.main_url
        main_url = result["data"]["original_media_info"]["main_url"]
        
        # 现在 main_url 带水印（cs=0, lr=watermark_dyn）
        return {"url": main_url, "width": meta["width"], ...}
```

**测试验证：** 逐个测试这 11 个项目的核心 API 调用，结果全部一致——`original_media_info.main_url` 返回带水印的 URL。

### 5.3 图片去水印仍有有效的方案

从上述项目中总结出三个有效的图片去水印方案：

```javascript
// 方案 1: 直接读取 API 响应中的 image_ori_raw 字段
const rawUrl = creation.image.image_ori_raw.url;
// rc_gen_image/{32位md5hash} → 无水印原图 ✅

// 方案 2: Canvas 合并去水印（Qalxry 3.0.0）
// previewImage + downloadImage 两张图拼合
// 用 downloadImage 的左上角覆盖 previewImage 的左上角

// 方案 3: 去掉 CDN 模板参数
const cleanUrl = imgUrl.replace(/~tplv-[^&?]*(?=[&?]|$)/g, '');
```

---

## 六、历史版本回溯与根因分析

### 6.1 Edge 插件版本演进

| 版本 | 主要改动 | 核心问题 |
|:----:|---------|---------|
| v4.0-v4.1 | 小程序原始版：`get_play_info` → `original_media_info.main_url` | **曾有效** |
| v1.0 | Edge 插件初版：inject.js fetch monkey-patch | 拦截 API 失败 |
| v1.3 | 对齐小程序：vid → `get_play_info` API | API 开始返回带水印 URL |
| v1.4-v1.6 | 多视频支持 + DOM 关联 | 时序问题 |
| v1.8.6 | 回归 V8 + poster 匹配 | 仍有水印 |
| v1.9.0 | 周期重试 + MutationObserver | API 正确执行但文件带水印 |
| v20 | 修复 vid 关联顺序 | 仍有水印 |

### 6.2 关键发现

Edge 插件 v9+ 的所有修复都在解决"vid → video 元素关联"的时序问题，导致我们**一直以为问题出在前端匹配逻辑**。但实际上：

```
问题不在客户端代码，在服务端 API 行为变更
```

### 6.3 根因分析矩阵

| 假设 | 验证方法 | 结果 |
|:----:|:--------:|:----:|
| 需要登录态 | 登录态下调 API | ❌ 与未登录态返回相同文件 |
| `lr` 参数控制水印 | 去掉 lr / 改 lr=none / 改 lr=no_watermark | ❌ etag 不变 |
| `ft` 是权限签名 | `ft=` 空值 / 随机值 | ❌ 不影响 |
| `cs` 区分有/无水印 | cs=0 vs cs=4 两个版本 | ❌ 两者都带水印 |
| `download_params` 控制 | `with_watermark: false` 等变体 | ❌ 无效 |
| CDN 边缘叠加水印 | Playwright 浏览器播放抓取 | ❌ 播放时已带水印 |
| 有无水印两个版本 | 对比三个 API 返回的所有 URL | ❌ 都指向同一个带水印文件 |

### 6.4 最终结论

**字节跳动的保护机制是：**

```
AI 生成（无水印原片）→ H.264 编码（叠加水印至像素层）→ TOS 对象存储（存一份带水印文件）→ CDN 分发（所有 URL 参数均为缓存签名）→ 客户端下载（文件本身就带水印）
```

**水印在编码阶段已经嵌入每一帧像素，不是一个可配置的叠加层。** 这就解释了为什么：
- 所有 URL 参数（lr/ft/cs/cr/dr/download）都不影响文件内容
- 图片可以做到"去水印"，但视频不行
- 所有开源项目都已失效
- 登录态下的创作者下载按钮返回的也是同一份文件

### 6.5 关于"字节一定有无水印原片"的推理论证

虽然有现存的 15 个开源项目已全部失效，但从逻辑上可以推断字节跳动内部**一定存储着无水印的原片**：

1. **AI 生成流程**：Seedance 等模型生成的是原始视频帧 → 编码时叠加水印 → 存储分发。原始帧在叠加前一定存在。
2. **创作者需求**：用户需要将豆包生成的视频用于抖音/小红书/朋友圈，带豆包水印的视频无法在这些平台正常使用。
3. **商业闭环**：如果创作者无法获得无水印版本，AI 视频生成业务就无法形成完整的"创作→导出→分发"闭环。

**无水印原片可能的位置：**

| 位置 | 访问条件 | 可行性 |
|:----:|:--------:|:------:|
| AI 生成流水线临时存储 | 秒级清理，不可达 | ❌ |
| TOS 对象存储（内部归档） | 需要创作者 OAuth Token | ❌ |
| 创作者专属 CDN | 需要登录态 + 签名 + 权限 | ❌ |
| 抖音创作者服务平台 API | 需要商业授权 | ❌ |

---

## 七、核心结论与建议

### 7.1 最终结论

1. **豆包视频水印在编码层叠加**——不是 CDN 动态添加，也不是播放器后处理
2. **所有公开 API 都返回带水印文件**——17 个 API 端点全部测试完毕
3. **登录态不影响水印有无**——创作者自己下载也是同一份带水印文件
4. **15 个开源项目全部失效**——没有找到任何有效的绕过方法
5. **图片去水印仍可工作**——图片水印是前端叠加的，与原图存储在不同路径

### 7.2 代码级别的已验证方案（伪代码）

```python
# === 已验证：调用 API 下载带水印视频 ===
import httpx

def download_doubao_video(video_id: str) -> bytes:
    """此方法可下载视频，但带水印"""
    response = httpx.post(
        "https://www.doubao.com/samantha/media/get_play_info",
        params={"aid": "497858", "device_platform": "web", "language": "zh-CN"},
        headers={
            "Content-Type": "application/json",
            "origin": "https://www.doubao.com",
            "referer": "https://www.doubao.com/",
        },
        json={"key": video_id},
        timeout=15,
    )
    data = response.json()["data"]
    
    # 两个字段目前返回相同的带水印 URL
    main_url = data["original_media_info"]["main_url"]
    # 或: data["media_info"][0]["main_url"]
    
    # 下载文件
    video_bytes = httpx.get(main_url).content
    return video_bytes  # 有 ! 水 ! 印 !
```

```javascript
// === 已验证：浏览器中拦截 API 视频信息 ===
// 在 chat 页面，通过 monkey-patch XHR 拦截 vid
const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(...args) {
  this.addEventListener('load', function() {
    const url = this._url;
    // 拦截 /im/chain/single → 提取 video.vid
    if (url && url.includes('/im/chain/single')) {
      const data = JSON.parse(this.responseText);
      const messages = data?.downlink_body
        ?.pull_singe_chain_downlink_body?.messages;
      for (const msg of messages || []) {
        for (const creation of msg?.content?.creations || []) {
          if (creation?.video?.vid) {
            const vid = creation.video.vid;
            // 用 vid 调 get_play_info 获取下载 URL
            // 结果带水印
          }
        }
      }
    }
  });
  return originalSend.apply(this, args);
};
```

### 7.3 可行的替代方案

| 方案 | 效果 | 成本 | 推荐 |
|:----:|:----:|:----:|:---:|
| 放弃视频去水印，保留图片 | 视频保留原始体验 | 无 | ⭐ 推荐 |
| 监控 API 变化 | 若字节恢复旧行为可重新启用 | 低 | ⭐ 推荐 |
| 屏幕录制 | 产出"录制版"而非原片 | 高（服务器资源） | ⚠️ |
| AI inpainting 逐帧修复 | 理论可行，但需要 GPU | 极高（不可行） | ❌ |

### 7.4 API 监控建议

定期（如每周）运行以下检查，监控字节是否恢复无水印：

```bash
# 监控脚本核心逻辑
curl -s -X POST 'https://www.doubao.com/samantha/media/get_play_info' \
  -H 'Content-Type: application/json' \
  -d '{"key":"<video_id>"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
orig = d['data']['original_media_info']['main_url']
media = d['data']['media_info'][0]['main_url']
if orig != media:
    print('恢复！两个 URL 不同！')
elif 'lr=video_gen_watermark_dyn' not in orig:
    print('恢复！lr 参数改变！')
else:
    print('未恢复，仍带水印')
"
```

---

> **文档结束**  
> 基于 2026-07-04 的实际测试数据编写  
> 涵盖 17 个 API 端点测试、15 个开源项目分析、完整 CDN 参数操控验证