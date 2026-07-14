# 豆包视频去水印技术分析报告

## 📋 概述

本文档分析了豆包（Doubao）视频平台的去水印技术实现原理，基于对现有开源项目的研究。

**分析目标视频**: https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer

**Video ID**: `v0d69cg10004d946nuiljht2d4d2v44g`

---

## 🔍 核心技术原理

### 1. 水印机制分析

豆包视频平台采用两种视频版本：
- **带水印版本**: 用于前端播放器展示，包含平台Logo水印
- **无水印原始版本**: 服务器端保留的原始视频文件

关键发现：**豆包并非在视频流上实时叠加水印，而是提供两个不同的视频URL**

### 2. API端点分析

#### 获取视频播放信息的API

```
POST https://www.doubao.com/samantha/media/get_play_info
```

**请求参数**:
```json
{
  "version_code": "20800",
  "language": "zh-CN",
  "device_platform": "web",
  "aid": "497858",
  "real_aid": "497858",
  "pkg_type": "release_version",
  "samantha_web": "1",
  "use-olympus-account": "1",
  "web_tab_id": ""
}
```

**请求体**:
```json
{
  "key": "v0d69cg10004d946nuiljht2d4d2v44g"  // video_id
}
```

**关键请求头**:
```javascript
{
  'Content-Type': 'application/json',
  'origin': 'https://www.doubao.com'
}
```

#### API响应结构

```json
{
  "data": {
    "original_media_info": {
      "main_url": "https://...",  // 无水印视频URL
      // ... 其他信息
    }
  }
}
```

**核心字段**: `data.original_media_info.main_url` 包含无水印视频的直接下载链接

---

## 💻 实现方案

### 方案一：UserScript（浏览器脚本）

**技术栈**: JavaScript + Tampermonkey/Greasemonkey

**实现流程**:

```javascript
// 1. 从URL中提取video_id
function getVid() {
    let url = new URL(location.href);
    let vid = url.searchParams.get('video_id');
    return vid;
}

// 2. 调用API获取无水印视频URL
async function getUrlByVid(vid) {
    const url = 'https://www.doubao.com/samantha/media/get_play_info?...';
    
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'origin': 'https://www.doubao.com',
        },
        body: JSON.stringify({key: vid}),
    });
    
    let result = await response.json();
    return result.data.original_media_info.main_url;
}

// 3. 下载视频文件
async function downloadVideo(videoUrl, videoName) {
    const response = await fetch(videoUrl, {
        mode: 'cors', 
        referrer: ''
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = videoName;
    a.click();
    
    URL.revokeObjectURL(url);
}
```

**优点**:
- 无需服务器端支持
- 用户安装即用
- 直接在浏览器中运行

**缺点**:
- 需要安装浏览器扩展
- 依赖于页面DOM结构
- 可能受到CORS策略限制

### 方案二：Python爬虫实现

```python
import requests
import json

def get_video_without_watermark(video_id):
    """获取无水印视频URL"""
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    params = {
        'version_code': '20800',
        'language': 'zh-CN',
        'device_platform': 'web',
        'aid': '497858',
        'real_aid': '497858',
        'pkg_type': 'release_version',
        'samantha_web': '1',
        'use-olympus-account': '1'
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 ...'
    }
    
    data = {'key': video_id}
    
    response = requests.post(
        api_url,
        params=params,
        headers=headers,
        json=data,
        cookies=your_cookies  # 需要登录态
    )
    
    result = response.json()
    video_url = result['data']['original_media_info']['main_url']
    
    return video_url

def download_video(video_url, save_path):
    """下载视频文件"""
    response = requests.get(video_url, stream=True)
    
    with open(save_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

# 使用示例
video_id = "v0d69cg10004d946nuiljht2d4d2v44g"
video_url = get_video_without_watermark(video_id)
download_video(video_url, f"{video_id}-无水印.mp4")
```

### 方案三：微信小程序实现

**适用场景**: 移动端快捷去水印工具

```javascript
// pages/download/download.js
Page({
  data: {
    videoUrl: ''
  },
  
  // 解析分享链接
  parseShareLink(shareUrl) {
    const url = new URL(shareUrl);
    const videoId = url.searchParams.get('video_id');
    return videoId;
  },
  
  // 获取无水印视频
  async getNoWatermarkVideo(videoId) {
    const res = await wx.request({
      url: 'https://www.doubao.com/samantha/media/get_play_info',
      method: 'POST',
      data: {
        key: videoId,
        version_code: '20800',
        language: 'zh-CN',
        device_platform: 'web',
        aid: '497858'
      },
      header: {
        'content-type': 'application/json',
        'origin': 'https://www.doubao.com'
      }
    });
    
    return res.data.data.original_media_info.main_url;
  },
  
  // 下载视频
  async downloadVideo() {
    const videoUrl = this.data.videoUrl;
    
    wx.downloadFile({
      url: videoUrl,
      success: (res) => {
        wx.saveVideoToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({title: '保存成功'});
          }
        });
      }
    });
  }
});
```

---

## 🛡️ 技术要点与注意事项

### 1. 认证机制

- **Cookie要求**: API调用需要有效的登录态Cookie
- **关键Cookie字段**: 
  - `sessionid`
  - `uid`
  - `oauth_token`

### 2. CORS处理

浏览器环境中的跨域解决方案：
```javascript
// 方案1: 使用credentials
fetch(url, {
    mode: 'cors',
    credentials: 'include',  // 携带Cookie
    referrer: ''  // 隐藏来源
})

// 方案2: 通过代理服务器
// 部署自己的代理服务器转发请求
```

### 3. 视频ID提取

从分享链接中提取video_id的多种方式：

```javascript
// 方法1: URL参数解析
const url = new URL('https://www.doubao.com/video-sharing?video_id=xxx');
const videoId = url.searchParams.get('video_id');

// 方法2: 正则表达式
const videoId = shareUrl.match(/video_id=([^&]+)/)?.[1];

// 方法3: 页面DOM解析（如果直接访问页面）
const videoElement = document.querySelector('[data-video-id]');
const videoId = videoElement?.dataset.videoId;
```

### 4. 下载优化

```javascript
// 大文件分片下载
async function downloadLargeVideo(url, filename) {
    const response = await fetch(url);
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    
    const blob = new Blob(chunks, {type: 'video/mp4'});
    const downloadUrl = URL.createObjectURL(blob);
    
    // 触发下载
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(downloadUrl);
}
```

---

## 📊 现有开源项目汇总

### 1. UserScript项目

**项目**: Download-from-Doubao-Video-Sharing-without-Watermark
- **作者**: catscarlet
- **平台**: Greasyfork
- **链接**: https://greasyfork.org/scripts/582844
- **GitHub**: https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark
- **特点**: 
  - 自动在分享页面添加下载按钮
  - 支持下载视频Prompt文本
  - 兼容多种浏览器和用户脚本管理器

### 2. Chrome扩展

**项目**: Gemini, Doubao & Jimeng Watermark Remover
- **平台**: Chrome Web Store
- **功能**: 移除豆包、Gemini等AI平台的水印
- **实现**: 基于图像处理或URL替换

### 3. 相关工具

**Download Raw Image and Raw Video from doubao.com**
- **链接**: https://greasyfork.org/scripts/555118
- **用途**: 下载个人账号下生成的内容（无需复制链接）

---

## 🔒 法律与道德考量

### ⚠️ 重要提示

1. **版权保护**: 去除水印可能违反平台服务条款
2. **个人使用**: 仅供学习研究，不得用于商业用途
3. **内容归属**: 尊重原创作者权益
4. **平台规则**: 遵守豆包平台的用户协议

### 合规使用建议

✅ **允许的使用场景**:
- 下载自己创作的视频内容
- 学习技术实现原理
- 个人收藏备份

❌ **禁止的使用场景**:
- 盗用他人作品进行商业传播
- 未经授权的二次创作和分发
- 违反平台服务条款的行为

---

## 🚀 实战演练

### 完整实现示例

创建一个命令行工具下载无水印视频：

```python
#!/usr/bin/env python3
"""
豆包视频去水印下载工具
使用方法: python doubao_downloader.py <分享链接>
"""

import sys
import re
import requests
from urllib.parse import urlparse, parse_qs

class DoubaoDownloader:
    def __init__(self):
        self.api_url = "https://www.doubao.com/samantha/media/get_play_info"
        self.session = requests.Session()
        
    def extract_video_id(self, share_url):
        """从分享链接提取video_id"""
        parsed = urlparse(share_url)
        params = parse_qs(parsed.query)
        return params.get('video_id', [None])[0]
    
    def get_video_url(self, video_id, cookies=None):
        """获取无水印视频URL"""
        params = {
            'version_code': '20800',
            'language': 'zh-CN',
            'device_platform': 'web',
            'aid': '497858',
            'real_aid': '497858',
            'pkg_type': 'release_version',
            'samantha_web': '1',
            'use-olympus-account': '1'
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Origin': 'https://www.doubao.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        data = {'key': video_id}
        
        response = self.session.post(
            self.api_url,
            params=params,
            headers=headers,
            json=data,
            cookies=cookies
        )
        
        result = response.json()
        
        if 'data' not in result or 'original_media_info' not in result['data']:
            raise Exception("获取视频信息失败，可能需要登录")
        
        return result['data']['original_media_info']['main_url']
    
    def download_video(self, video_url, output_path):
        """下载视频到本地"""
        print(f"开始下载: {output_path}")
        
        response = self.session.get(video_url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size:
                        percent = (downloaded / total_size) * 100
                        print(f"\r下载进度: {percent:.1f}%", end='')
        
        print(f"\n下载完成: {output_path}")
    
    def process(self, share_url, output_path=None, cookies=None):
        """处理完整流程"""
        # 1. 提取video_id
        video_id = self.extract_video_id(share_url)
        if not video_id:
            raise ValueError("无法从链接中提取video_id")
        
        print(f"Video ID: {video_id}")
        
        # 2. 获取无水印视频URL
        video_url = self.get_video_url(video_id, cookies)
        print(f"视频URL: {video_url}")
        
        # 3. 下载视频
        if output_path is None:
            output_path = f"{video_id}-无水印.mp4"
        
        self.download_video(video_url, output_path)

def main():
    if len(sys.argv) < 2:
        print("使用方法: python doubao_downloader.py <分享链接>")
        print("示例: python doubao_downloader.py 'https://www.doubao.com/video-sharing?video_id=xxx'")
        sys.exit(1)
    
    share_url = sys.argv[1]
    
    # 如果需要Cookie，可以从这里传入
    cookies = {
        # 'sessionid': 'your_session_id',
        # 'uid': 'your_uid',
    }
    
    downloader = DoubaoDownloader()
    
    try:
        downloader.process(share_url, cookies=cookies if any(cookies.values()) else None)
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

**使用示例**:
```bash
# 基本使用
python doubao_downloader.py "https://www.doubao.com/video-sharing?share_id=49141126666482178&video_id=v0d69cg10004d946nuiljht2d4d2v44g"

# 指定输出文件名
python doubao_downloader.py "分享链接" -o my_video.mp4
```

---

## 🔧 故障排查

### 常见问题

**问题1: API返回空数据或错误**
```
原因: 缺少有效的登录态Cookie
解决: 
1. 使用浏览器登录豆包
2. 复制Cookie信息
3. 在脚本中设置Cookie
```

**问题2: CORS跨域错误**
```
原因: 浏览器安全策略限制
解决:
1. 使用UserScript（自动绕过CORS）
2. 使用服务器端脚本
3. 配置浏览器允许跨域（仅开发环境）
```

**问题3: 视频下载失败**
```
原因: 网络问题或URL已过期
解决:
1. 检查网络连接
2. 重新获取视频URL
3. 使用断点续传
```

**问题4: 脚本失效**
```
原因: 豆包更新了API或页面结构
解决:
1. 检查API端点是否变化
2. 更新请求参数
3. 关注开源项目更新
```

---

## 📈 技术演进趋势

### 当前状态 (2026年)

- API端点相对稳定
- 需要Cookie认证
- 支持批量下载
- 多平台工具可用

### 可能的变化

1. **加强认证**: 可能增加更复杂的认证机制（Token、签名等）
2. **加密视频流**: 使用DRM保护视频内容
3. **动态水印**: 根据用户信息生成个性化水印
4. **频率限制**: 限制API调用频率防止滥用

### 应对策略

- 及时更新脚本适配新API
- 遵守平台规则避免账号风险
- 考虑使用官方导出功能（如果提供）

---

## 🎯 总结

### 核心发现

1. **水印机制**: 豆包采用双URL策略（带水印/无水印）
2. **关键API**: `/samantha/media/get_play_info` 端点
3. **认证需求**: 需要有效的Cookie进行身份验证
4. **实现难度**: 技术上较简单，主要是API调用

### 技术价值

- ✅ 学习API逆向工程
- ✅ 理解视频处理流程
- ✅ 掌握Web请求技巧
- ✅ 实践自动化下载

### 使用建议

1. **仅用于个人学习和研究**
2. **尊重内容创作者版权**
3. **遵守平台服务条款**
4. **不要用于商业目的**

---

## 📚 参考资源

### 开源项目

1. [Download-from-Doubao-Video-Sharing-without-Watermark](https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark)
2. [Download-Origin-Image-from-Doubao-without-Watermark](https://github.com/catscarlet/Download-Origin-Image-from-Doubao-without-Watermark)

### 技术文档

- [Fetch API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [CORS - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [UserScript开发指南](https://www.tampermonkey.net/documentation.php)

### 相关工具

- Tampermonkey: 浏览器用户脚本管理器
- Postman: API测试工具
- Chrome DevTools: 浏览器开发者工具

---

## 📝 更新日志

**2026-07-04**
- 初始版本
- 分析video_id: v0d69cg10004d946nuiljht2d4d2v44g
- 完成API逆向分析
- 提供Python和JavaScript实现方案

---

## ⚖️ 免责声明

本文档仅供技术学习和研究使用。使用本文档中的技术方案可能违反豆包平台的服务条款。作者不对因使用本文档中的内容而产生的任何法律问题负责。请用户自行评估风险，合法合规使用相关技术。

**内容已依据许可限制进行改写，确保符合合规要求。**
