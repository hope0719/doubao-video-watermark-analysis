# 豆包视频分析工具集 - 使用指南

## 📖 简介

这是一个用于豆包（Doubao）视频分享页面 API 分析和视频下载的 Python 工具集。

**⚠️ 重要提示**：这些工具下载的视频**仍带有水印**。本仓库的研究尚未找到成功去水印的方法。工具仅供技术分析和研究使用。

## ⚠️ 重要声明

**本工具仅供学习研究使用！**

- ✅ 下载自己创作的视频内容
- ✅ 学习技术实现原理
- ✅ 个人收藏备份
- ❌ 盗用他人作品进行商业传播
- ❌ 未经授权的二次创作和分发
- ❌ 违反平台服务条款的行为

请遵守豆包平台的服务条款，尊重内容创作者的版权。

## 🚀 快速开始

### 1. 环境要求

- Python 3.6 或更高版本
- pip (Python包管理器)

### 2. 安装依赖

```bash
pip install requests
```

或者使用requirements.txt:

```bash
pip install -r requirements.txt
```

### 3. 获取视频分享链接

在豆包App中：
1. 打开要下载的视频
2. 点击"分享"按钮
3. 选择"复制链接"
4. 链接格式类似：`https://www.doubao.com/video-sharing?share_id=xxx&video_id=xxx`

### 4. 基本使用

```bash
python doubao_video_downloader.py "https://www.doubao.com/video-sharing?video_id=v0d69cg10004d946nuiljht2d4d2v44g"
```

## 📚 详细用法

### 命令行参数

```
python doubao_video_downloader.py <分享链接> [选项]
```

**位置参数**:
- `url` - 豆包视频分享链接（必需）

**可选参数**:
- `-o, --output` - 指定输出文件名
- `-c, --cookies` - 提供Cookie用于身份验证
- `-v, --verbose` - 显示详细的调试信息
- `-h, --help` - 显示帮助信息

### 使用示例

#### 示例 1: 基本下载

```bash
python doubao_video_downloader.py "https://www.doubao.com/video-sharing?video_id=v0d69cg10004d946nuiljht2d4d2v44g"
```

输出文件: `v0d69cg10004d946nuiljht2d4d2v44g-无水印.mp4`

#### 示例 2: 指定输出文件名

```bash
python doubao_video_downloader.py "分享链接" -o my_awesome_video.mp4
```

输出文件: `my_awesome_video.mp4`

#### 示例 3: 使用Cookie（需要登录才能访问的视频）

```bash
python doubao_video_downloader.py "分享链接" -c "sessionid=abc123; uid=456789"
```

#### 示例 4: 显示详细日志

```bash
python doubao_video_downloader.py "分享链接" -v
```

**注意**：下载的视频文件目前均带有水印。如需无水印版本，请关注本仓库的持续研究进展。

#### 示例 5: 组合使用多个参数

```bash
python doubao_video_downloader.py "分享链接" \
  -o video.mp4 \
  -c "sessionid=abc123; uid=456789" \
  -v
```

## 🔧 获取Cookie（高级功能）

某些视频可能需要登录态才能访问。以下是获取Cookie的方法：

### 方法1: 使用Chrome浏览器

1. 在Chrome中登录豆包网站
2. 按 `F12` 打开开发者工具
3. 切换到 `Network` (网络) 标签
4. 刷新页面
5. 找到任意请求，查看 `Request Headers`
6. 复制 `Cookie` 字段的值

### 方法2: 使用Firefox浏览器

1. 在Firefox中登录豆包网站
2. 按 `F12` 打开开发者工具
3. 切换到 `网络` 标签
4. 刷新页面
5. 点击任意请求
6. 在右侧面板找到 `请求头`
7. 复制 `Cookie` 的值

### Cookie格式

Cookie字符串格式如下：
```
sessionid=xxx; uid=xxx; oauth_token=xxx
```

**重要**: 不要分享你的Cookie给他人，这相当于你的账号凭证！

## 📊 工作流程

```
1. 解析分享链接
   ↓
2. 提取 video_id
   ↓
3. 调用豆包API获取视频信息
   ↓
4. 获取视频CDN URL（目前均带水印）
   ↓
5. 下载视频到本地
   ↓
6. 验证文件完整性
```

## 🎯 运行示例

### 成功输出示例

```
============================================================
🎬 豆包视频去水印下载工具
============================================================

📌 步骤 1/3: 解析视频ID
✓ Video ID: v0d69cg10004d946nuiljht2d4d2v44g

📌 步骤 2/3: 获取视频信息
✓ 视频URL: https://...
✓ 分辨率: 1920x1080
✓ 时长: 30.5秒

📌 步骤 3/3: 下载视频

📥 开始下载视频...
📍 保存路径: v0d69cg10004d946nuiljht2d4d2v44g-无水印.mp4
📦 文件大小: 15.32 MB
进度: [████████████████████████████████████████] 100.0% (15.32/15.32 MB)
✅ 下载完成: v0d69cg10004d946nuiljht2d4d2v44g-无水印.mp4
✓ 文件大小: 15.32 MB

============================================================
🎉 所有操作完成！
============================================================
```

## 🐛 故障排查

### 问题1: 提示"无法提取video_id"

**原因**: 分享链接格式不正确

**解决方法**:
- 确保链接完整复制
- 链接应该包含 `video_id=` 参数
- 尝试用引号包裹链接: `"链接"`

### 问题2: 提示"可能需要登录"

**原因**: 视频需要登录才能访问

**解决方法**:
- 使用 `-c` 参数提供Cookie
- 参考上文"获取Cookie"部分

### 问题3: 下载速度很慢

**原因**: 网络连接问题或服务器限速

**解决方法**:
- 检查网络连接
- 尝试使用代理
- 等待一段时间后重试

### 问题4: 文件下载不完整

**原因**: 网络中断或磁盘空间不足

**解决方法**:
- 检查磁盘空间
- 确保网络稳定
- 重新下载

### 问题5: 提示"响应数据格式错误"

**原因**: API可能已更新或被限制

**解决方法**:
- 使用 `-v` 参数查看详细日志
- 检查是否需要更新脚本
- 尝试提供Cookie

## 🔍 技术原理

### API端点

```
POST https://www.doubao.com/samantha/media/get_play_info
```

### 关键参数

```python
{
    "key": "video_id",  # 从分享链接提取的视频ID
    "version_code": "20800",
    "device_platform": "web",
    # ... 其他参数
}
```

### API响应

```json
{
  "data": {
    "original_media_info": {
      "main_url": "https://.../?lr=video_gen_watermark_dyn",  // 注意：目前带水印
      "width": 1920,
      "height": 1080,
      "size": 16058032,
      "duration": 30500
    }
  }
}
```

**注意**：当前 `original_media_info.main_url` 与 `media_info[0].main_url` 完全相同，均带 `lr=video_gen_watermark_dyn` 参数，下载后均有水印。

更多技术细节请参考: [技术分析报告](../analysis/technical-report.md)

## 📦 依赖说明

### 核心依赖

- **requests**: HTTP请求库，用于API调用和文件下载

### Python标准库

- **sys**: 系统相关功能
- **re**: 正则表达式
- **json**: JSON数据处理
- **argparse**: 命令行参数解析
- **urllib**: URL解析
- **pathlib**: 文件路径操作

## 🛠️ 高级配置

### 创建requirements.txt

```txt
requests>=2.28.0
```

### 创建配置文件（可选）

可以创建 `config.json` 存储常用Cookie:

```json
{
  "cookies": {
    "sessionid": "your_session_id",
    "uid": "your_uid",
    "oauth_token": "your_token"
  }
}
```

然后修改脚本读取配置文件。

### 批量下载脚本

创建 `batch_download.py`:

```python
#!/usr/bin/env python3
import subprocess
import sys

# 要下载的视频链接列表
video_urls = [
    "https://www.doubao.com/video-sharing?video_id=xxx1",
    "https://www.doubao.com/video-sharing?video_id=xxx2",
    "https://www.doubao.com/video-sharing?video_id=xxx3",
]

for url in video_urls:
    print(f"\n正在处理: {url}")
    subprocess.run([sys.executable, "doubao_video_downloader.py", url])

print("\n所有视频下载完成！")
```

使用方法:
```bash
python batch_download.py
```

## 📝 常见问题 (FAQ)

**Q: 为什么有的视频可以下载，有的不行？**

A: 某些视频可能设置了访问权限，需要登录或有特定权限才能访问。尝试提供Cookie解决。

**Q: 下载的视频能用于商业用途吗？**

A: 不可以。本工具仅供个人学习研究使用，商业使用可能侵犯版权。

**Q: Cookie会过期吗？**

A: 会的。Cookie通常有有效期，过期后需要重新获取。

**Q: 脚本安全吗？**

A: 脚本是开源的，你可以查看所有代码。不会上传或泄露你的任何信息。

**Q: 支持下载其他平台的视频吗？**

A: 本工具专门针对豆包平台。其他平台需要单独的工具。

## 🔄 更新日志

### v1.0.0 (2026-07-04)
- ✨ 初始版本发布
- ✅ 支持从分享链接下载视频（目前均带水印）
- ✅ 支持自定义输出文件名
- ✅ 支持Cookie身份验证
- ✅ 显示下载进度条
- ✅ 详细的错误提示
- ✅ 支持调试模式

### ⚠️ 已知限制
- 下载的视频文件目前均带有"豆包 AI"水印
- 水印是服务端编码时像素级嵌入的，客户端无法通过参数切换去除
- 本仓库仍在探索有效的去水印方案

## 🤝 贡献

如果你发现bug或有改进建议，欢迎：
- 提交Issue
- 发起Pull Request
- 分享使用心得

## 📜 许可证

本项目采用 AGPLv3 许可证。详见 LICENSE 文件。

## 🙏 致谢

- 感谢豆包平台提供的服务
- 参考了开源项目 [Download-from-Doubao-Video-Sharing-without-Watermark](https://github.com/catscarlet/Download-from-Doubao-Video-Sharing-without-Watermark)
- 感谢所有为技术研究做出贡献的开发者

## 📧 联系方式

如有问题或建议，请通过以下方式联系：
- 提交GitHub Issue
- 发送邮件（在项目页面查看）

---

**最后提醒**: 请合法合规使用本工具，尊重他人的劳动成果和知识产权！
