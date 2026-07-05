# 豆包视频去水印·开源社区最新动态调研报告

> **调研日期**：2026-07-05
> **分析时间跨度**：2026年6月23日 - 7月5日
> **关注焦点**：近期 GitHub 高频更新的豆包去水印项目，其方法与真实有效性

---

## 一、调研背景

2026年7月上旬，GitHub 上有多个豆包去水印项目集中更新，开发者声称找到了视频无水印下载的方法。本报告对这些项目进行了完整源码分析、API 调用比对和下载文件验证，以判断它们是否真正解决了视频水印问题。

---

## 二、主要调研项目

### 2.1 catscarlet 系列（油猴脚本）

**仓库**：
- [catscarlet/Download-Original-Raw-Image-from-Doubao-without-Watermark-Experimental](https://github.com/catscarlet/Download-Original-Raw-Image-from-Doubao-without-Watermark-Experimental)
- [catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark](https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark)

**更新记录**：

| 日期 | 更新内容 |
|------|----------|
| 7月2日 | 更改无水印视频文件名格式（用 vid 代替时间戳） |
| 7月1日 | 新增视频 prompt 文本下载功能 |
| 6月30日 | 清理废弃代码 |
| 6月27日 | 修复 API 返回空 `_data` 时的下载失败问题 |
| 6月23-26日 | v0.1.2~v0.1.4 连续更新，去除 Referrer 限制 |

**源码分析-核心方法**（`Download-from-Doubao-Video-Sharing-without-Watermark`）：

```javascript
// 从 URL 获取 video_id
const vid = url.searchParams.get('video_id');

// 调用 get_play_info API，credentials: 'include' 带上登录 Cookie
const response = await fetch(
  'https://www.doubao.com/samantha/media/get_play_info?version_code=20800&language=zh-CN&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&device_id=&pc_version=2.51.7&region=&sys_region=&samantha_web=1&use-olympus-account=1&web_tab_id=',
  {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'https://www.doubao.com',
    },
    referrer: null,
    body: JSON.stringify({key: vid}),
  }
);

// 从响应提取 original_media_info.main_url — 声称"这就是无水印直链"
let result = await response.json();
let main_url = result.data.original_media_info.main_url;
```

**源码分析-核心方法**（`Download-Original-Raw-Image-from-Doubao-without-Watermark-Experimental`，chat 页面版）：

```javascript
// 拦截 XHR 获取 vid（从 /im/chain/single 等 API 响应）
const vid = interceptedResponse.data.video.vid;

// 完全相同的 API 调用
const response = await fetch(get_play_info_url, {
  method: 'POST',
  credentials: 'include',
  headers: {'Content-Type': 'application/json', 'origin': 'https://www.doubao.com'},
  body: JSON.stringify({key: vid}),
});
let main_url = result.data.original_media_info.main_url;
```

**关键点**：两个脚本都使用 `original_media_info.main_url` 而不是 `media_info[0].main_url`。

---

### 2.2 Luncot/doubao-downloader-plus（Chrome 扩展 / 油猴）

**仓库**：[Luncot/doubao-downloader-plus](https://github.com/Luncot/doubao-downloader-plus)

**基本信息**：
- ⭐ 6 stars
- 最后 commit：6月25日
- 基于 LauZzL/doubao-downloader v2.0.0 重构（有 BE 页面专利，但这个上游2.0版本刚重构完并删除原有功能，plus 版保留了原功能）
- 新增：15秒视频生成支持、视频内联下载按钮

**源码分析-视频 API 调用**（`src/api/video.ts`）：

```typescript
const GET_VIDEO_INFO_URL = `/samantha/media/get_play_info?version_code=20800&...`;

export async function getVideoUrl(vid: string | number) {
  const res = await fetch(GET_VIDEO_INFO_URL + crypto.randomUUID(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "agw-js-conv": "str",
      origin: location.origin,
      referer: location.href,
    },
    credentials: "include",
    body: JSON.stringify({ key: vid, type: "video" }),
  });
  const data = await res.json();
  if (data?.code === 0 && data.data?.original_media_info?.main_url) {
    return data.data.original_media_info.main_url.replace(
      /lr=[^&]+/g,
      "lr=video_gen_no_watermark"  // 额外做了 lr 参数替换
    );
  }
  throw new Error("获取播放地址失败");
}
```

Luncot 版本额外做了两件事：
1. 请求体加了 `type: "video"` 字段
2. 对 `main_url` 做了 `lr=` 参数替换（`watermark_dyn` → `no_watermark`）

---

## 三、与我们的 API 调用对比分析

### 3.1 API 调用完全一致

| 对比维度 | catscarlet | Luncot | 我们的 Edge 插件 |
|----------|-----------|--------|-----------------|
| API 端点 | `POST /samantha/media/get_play_info` | 同左 | 同左 |
| 请求体 | `{key: vid}` | `{key: vid, type: "video"}` | `{key: vid}` |
| 登录态 | `credentials: 'include'` | 同左 | 同左 |
| 提取字段 | `original_media_info.main_url` | 同左 + lr 替换 | `original_media_info.main_url` |
| 额外处理 | 无 | lr=no_watermark 替换 | 无 |

**核心结论**：三个项目使用**完全相同的 API**，catscarlet 和我们的 Edge 插件连请求体和字段提取都完全一样。

### 3.2 我们之前已验证的结果

| 验证项 | 结果 |
|--------|------|
| API 调用（带 Cookie）成功拿到 URL | ✅ |
| URL 下载后 MD5 校验 | `d903cd062d240274ad31499d18bc6cfd` |
| `lr=video_gen_no_watermark` vs `lr=video_gen_watermark_dyn` | **MD5 完全一致** |
| 用户肉眼确认有无水印 | ❌ 有水印 |
| doubao-nomark 开源项目（微信 UA） | ❌ 同样有水印 |

**关键证据**：
- `lr=video_gen_no_watermark` 与 `lr=video_gen_watermark_dyn` 的下载文件 MD5 相同
- 用户对 `lr=video_gen_watermark_dyn` 下载的文件进行了肉眼确认：**带有水印**
- 用 curl + 浏览器 Cookie 从不同 CDN 域名下载（v9-videoweb / v26-videoweb / v26-show.douyinvod），**均带水印**

### 3.3 CDN 缓存验证

我们对该 API 返回的 URL 做了参数操控测试：

| URL 参数变体 | 结果 |
|-------------|------|
| `lr=video_gen_watermark_dyn`（原始值） | ❌ 有水印 |
| `lr=video_gen_no_watermark`（Luncot 替换值） | ❌ MD5 相同 |
| `lr=unwatermarked`（历史预期值） | ❌ MD5 相同 |
| `lr=origin` | ❌ MD5 相同 |
| 去掉 `lr` 参数 | ❌ MD5 相同 |
| 去掉 `download=true` | ❌ 403 Forbidden |
| `logo_type=none` | ❌ MD5 相同 |

**结论**：CDN 缓存 key 不含这些查询参数。无论传什么 `lr` 值，CDN 返回的都是同一份文件。

---

## 四、catscarlet 项目"看起来有效"的原因分析

### 4.1 幸存者偏差

- **部分视频本身无水印**：新建账号或某些时间生成的视频可能未触发水印叠加逻辑，用户下载后误以为是脚本的功劳
- **文件名命名误导**：catscarlet 脚本下载时命名包含 "无水印" 字样，用户在文件管理器看到"无水印"标记，先入为主认为文件无水印
- **测试视频选择偏差**：用户测试时可能用了一张明显有豆包水印的图，但视频水印较小/较浅，不易察觉

### 4.2 图片去水印效果被误归于视频

catscarlet 实验版脚本同时包含图片去水印功能。图片去水印是**确实有效的**（通过提取 SSR JSON 中的 `image_ori_raw.url`），用户测试图片成功后再测试视频，容易将图片的成功经验归因到同一工具的视频功能上。

### 4.3 缺乏严格的对比验证

这些项目的用户通常不会做严格的 AB 测试：
1. 先下载一份没用脚本的原始文件（确认有水印）
2. 再用脚本下载一份"无水印"版本
3. 两份文件做 MD5 对比或肉眼对比

### 4.4 证据：README 中的暗示

回顾现有技术分析报告的根因发现，README 中其实有重要暗示：

> **Catscarlet 视频去水印**：`get_play_info` + credentials → ❌（和我们结果一致）

结合勘误部分（README 中标注"我们的报告有误"且已更正），catscarlet 的脚本**实际并不产出真正无水印的视频**。

---

## 五、Luncot/doubao-downloader-plus 的额外分析

Luncot 的 README 中有一句重要说明：

> **"2.0版本已完成重构，可能仍存在一些未被发现的BUG"**
> **"2.0.0 版本中会支持视频捕获，目前已支持视频捕获相关参数提取以及面板展示"**

这说明截至 2.0.0 版本，**视频下载功能尚未完全可用**（"视频提取方法抽取"和"适配视频下载功能"仍在 TODO 列表中）。

此外，README 的 FAQ 中对"有水印"问题的回答是：

> **"暂时不清楚为什么部分账号无法获取无水印图片，建议切换账号或环境使用。"**

这表明运营者也知道去水印效果不稳定，依赖账号/环境因素。

---

## 六、综合结论

### 6.1 这些项目并没有发现新方法

| 项目 | 对我方的参考价值 |
|------|-----------------|
| catscarlet video-sharing | 验证了我们的 API 分析正确（同一套 API） |
| catscarlet experimental | 学到了 XHR 拦截获取 vid 的方式（JSON.parse 猴补丁）|
| Luncot/doubao-downloader-plus | 验证了 lr 参数替换无效 |

### 6.2 视频水印根因仍未解决

**水印在服务端 H.264 编码时像素级嵌入**，CDN 只存一份文件。所有公开 API 返回的 URL 均指向这个带水印文件。参数操控、域名变换、登录态认证均无法绕过。

### 6.3 仍需探索的方向

1. **寻找真正的去水印 API**：在豆包 JS bundle 中找到的 `watermark_task`（轮询）+ `watermark_download`（下载）端点，缺少任务提交入口
2. **WebSocket/protobuf 加密通道**：第三方工具可能走的不是 HTTP API，而是加密通道
3. **客户端后处理**：画面裁剪或 AI 修复（代价是画质损失）
4. **关注豆包官方更新**：如果豆包后续在响应中包含真正的去水印链接，需第一时间适配

### 6.4 对图片去水印的影响

本报告仅限**视频**。图片去水印仍然正常工作（原理不同：图片水印是前端叠加层而非服务端编码嵌入）。

---

## 七、附录：源码引用

### catscarlet 完整核心代码

```javascript
async function getUrlByVid(vid) {
    const url = 'https://www.doubao.com/samantha/media/get_play_info?version_code=20800&language=zh-CN&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&device_id=&pc_version=2.51.7&region=&sys_region=&samantha_web=1&use-olympus-account=1&web_tab_id=';
    try {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'origin': 'https://www.doubao.com',
            },
            referrer: null,
            body: JSON.stringify({key: vid}),
        });
        let result = await response.json();
        if (!result || !result.data) {
            console.log('API failed');
            console.log(result);
            return false;
        }
        let main_url = await result.data.original_media_info.main_url;
        return main_url;
    } catch (e) {
        console.error('获取视频播放信息失败:', e);
        return null;
    }
}
```

### Luncot 完整核心代码

```typescript
const GET_VIDEO_INFO_URL = `/samantha/media/get_play_info?version_code=20800&language=zh-CN&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&device_id=&pc_version=2.51.7&region=&sys_region=&samantha_web=1&use-olympus-account=1&web_tab_id=`;

export async function getVideoUrl(vid: string | number) {
  const res = await fetch(GET_VIDEO_INFO_URL + crypto.randomUUID(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "agw-js-conv": "str",
      origin: location.origin,
      referer: location.href,
    },
    credentials: "include",
    body: JSON.stringify({ key: vid, type: "video" }),
  });
  const data = await res.json();
  if (data?.code === 0 && data.data?.original_media_info?.main_url) {
    return data.data.original_media_info.main_url.replace(
      /lr=[^&]+/g,
      "lr=video_gen_no_watermark"
    );
  }
  throw new Error("获取播放地址失败");
}
```

---

## 七、测试链接

以下为开发者测试时使用的验证链接，**请在测试时使用你自己的测试视频**：

| 链接类型 | URL |
|---------|-----|
| 豆包视频分享页 | `https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer` |
| 测试视频 ID | `v0d69cg10004d946nuiljht2d4d2v44g` |
| API 端点 | `POST /samantha/media/get_play_info` |

> ⚠️ 以上链接仅作为功能验证用途，请替换为你自己生成的实际视频链接进行测试。测试时需登录豆包账号以获取有效 Cookie。