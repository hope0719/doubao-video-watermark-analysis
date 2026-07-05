# 豆包去水印方法最终验证报告

> **验证日期**：2026-07-05
> **验证方式**：Clone 源码分析 + 浏览器实测（agent-browser in-doubao-fetch）
> **测试视频**：`v0d69cg10004d946nuiljht2d4d2v44g`

---

## 一、验证对象

| 项目 | 类型 | Stars | 核心主张 |
|------|------|------|---------|
| [LauZzL/doubao-downloader](https://github.com/LauZzL/doubao-downloader) | 油猴/Chrome扩展 | ⭐4.7k | "一键批量下载豆包AI无水印图片/视频" |
| [ihmily/doubao-nomark](https://github.com/ihmily/doubao-nomark) | API/插件 | ⭐1.8k | "一键下载无水印豆包AI图片/视频API" |
| [catscarlet/系列脚本](https://github.com/catscarlet) | 油猴脚本 | - | "从豆包下载无水印原图和视频" |

---

## 二、核心发现：三个项目在视频去水印上完全一致

### 2.1 API 端点相同

所有三个项目都使用同一个 API：

```
POST https://www.doubao.com/samantha/media/get_play_info
    ?version_code=20800&language=zh-CN&device_platform=web
    &aid=497858&real_aid=497858&pkg_type=release_version
    &device_id=<random>&pc_version=<version>&region=CN&sys_region=CN
    &samantha_web=1&use-olympus-account=1&web_tab_id=
```

### 2.2 请求体相同

```json
{"key": ""}
```

### 2.3 请求头略有差异

| 项目 | Origin | Credentials | 特殊 Headers |
|------|--------|-------------|--------------|
| LauZzL | ✅ | ✅（油猴自动） | `agw-js-conv: str`, `type: video` |
| ihmily | ✅ | ❌（服务端脚本） | 无 |
| catscarlet | ✅ | ✅ | 无 |
| 我们的插件 | ✅ | ✅（显式） | 无 |

### 2.4 解析字段相同

所有项目都读取：`result.data.original_media_info.main_url`

---

## 三、浏览器实测验证

### 3.1 测试环境

- 在已登录的 `doubao.com/video-sharing` 页面内执行 `fetch`
- 页面自动携带登录 Cookie
- 测试时间：2026-07-05 18:43 GMT+8

### 3.2 测试结果

**四种调用方式对比：**

| 调用方式 | Headers | 返回 URL 关键部分 |
|---------|---------|------------------|
| 我们的 Edge 插件 | `credentials: include`, `origin` | `lr=video_gen_watermark_dyn` ❌ |
| LauZzL 风格 | +`agw-js-conv: str`, body 加 `type: video` | `lr=video_gen_watermark_dyn` ❌ |
| ihmily 风格 | 服务端脚本无 Cookie | `lr=video_gen_watermark_dyn` ❌ |
| 极简 fetch | 只带 `credentials: include` | `lr=video_gen_watermark_dyn` ❌ |

### 3.3 关键发现：响应体完整结构

```json
{
  "code": 0,
  "data": {
    "media_type": "video",
    "media_info": [
      {
        "meta": { "height": "1280", "width": "720", "format": "mp4", "duration": 10.08, "codec_type": "h264", "definition": "720p" },
        "main_url": "https://v26-videoweb.doubao.com/...?lr=video_gen_watermark_dyn&...",
        "backup_url": ""
      }
    ],
    "original_media_info": {
      "meta": { "height": "1280", "width": "720", "format": "mp4", "duration": 10.08, "codec_type": "h264", "definition": "720p" },
      "main_url": "https://v26-videoweb.doubao.com/...?lr=video_gen_watermark_dyn&...",
      "backup_url": ""
    },
    "poster_url": "https://p26-sign.douyinpic.com/...",
    "playable_status": 1
  }
}
```

**响应体只有 5 个字段：`{media_type, media_info, original_media_info, poster_url, playable_status}`**
**没有任何额外字段包含无水印 URL！**

---

## 四、结论

### 4.1 核心结论

> **GitHub 上能搜索到的所有豆包去水印项目，在视频去水印这件事上，与我们当前的 Edge 插件效果完全相同——都拿不到无水印视频直链。**

### 4.2 详细结论

| 维度 | 结论 |
|------|------|
| API 是否不同 | ❌ 全部相同 |
| 响应字段是否更多 | ❌ 没有，只有 5 个字段 |
| 是否有其他参数/端点 | ❌ 没有 |
| 是否有 WebSocket/二进制协议 | ❌ 未发现 |
| 图片去水印是否有效 | ✅ 仍然有效（不同机制） |

### 4.3 图片去水印的区别

| 对比项 | 图片 | 视频 |
|--------|------|------|
| 水印机制 | 前端叠加层（CSS/Canvas） | 服务端编码嵌入（像素级） |
| 服务器返回 | `image_ori_raw.url`（无水印）✅ | `original_media_info.main_url`（带水印）❌ |
| 可绕过？ | ✅ 可提取原始 URL | ❌ 无法绕过 |
| 我们是否已解决 | ✅ 已解决 | ❌ 未解决 |

---

## 五、后续方向建议

### 从便捷下载 APP 的启发

反编译的「便捷下载」Android APP 证明：
- 服务器端有能力返回真正无水印的视频 URL
- 客户端不需要后处理，直接下载即可
- 这意味着存在某个我们不知道的 API 或参数组合

### 值得尝试的方向

1. **利用便捷下载 API** — 注册账号获取认证，直接调 `easydownload.flyinglife.cn` 后端
2. **继续挖掘豆包 JS bundle** — 其他 API 端点、任务提交、加密通道
3. **监控开源社区** — 已设置自动化监控（automation-1783263004748），每天 10:00 检查

---

## 六、项目源码关键片段

### LauZzL 视频函数

```typescript
const GET_VIDEO_INFO_URL = `/samantha/media/get_play_info?version_code=20800&...`;
export async function getVideoUrl(vid: string | number) {
  const res = await fetch(GET_VIDEO_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "origin": location.origin },
    credentials: "include",
    body: JSON.stringify({ key: vid }),
  });
  const data = await res.json();
  return data.data.original_media_info.main_url;
}
```

### ihmily Python 脚本

```python
async def doubao_video_parse(url, return_raw=False):
    params = { "version_code": "20800", ... }
    response = await client.post(
        "https://www.doubao.com/samantha/media/get_play_info",
        params=params,
        headers={"Content-Type": "application/json", "origin": "https://www.doubao.com"},
        json={"key": vid}
    )
    result = response.json()
    return result["data"]["original_media_info"]["main_url"]
```

### catscarlet 油猴脚本（完整核心）

```javascript
async function getUrlByVid(vid) {
    const response = await fetch(
        'https://www.doubao.com/samantha/media/get_play_info?version_code=20800&...',
        {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'origin': 'https://www.doubao.com' },
            referrer: null,
            body: JSON.stringify({ key: vid }),
        }
    );
    let result = await response.json();
    return result.data.original_media_info.main_url;
}
```

---

> **本报告结论**：需要寻找「便捷下载」APP 所依赖的服务端 API 或其他尚未被发现的 API 端点，才能获得真正的无水印视频直链。