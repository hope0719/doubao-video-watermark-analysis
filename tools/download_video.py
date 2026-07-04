#!/usr/bin/env python3
import requests
import json

# 从分享链接提取的video_id
video_id = "v0d69cg10004d946nuiljht2d4d2v44g"

# API端点
api_url = "https://www.doubao.com/samantha/media/get_play_info"

# 请求参数
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

# 请求头
headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://www.doubao.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

# 请求体
data = {'key': video_id}

print(f"正在获取视频信息...")
print(f"Video ID: {video_id}")

try:
    # 调用API
    response = requests.post(api_url, params=params, headers=headers, json=data, timeout=30)
    response.raise_for_status()
    
    result = response.json()
    
    # 提取无水印视频URL
    video_url = result['data']['original_media_info']['main_url']
    
    print(f"✓ 获取到无水印视频URL")
    print(f"开始下载...")
    
    # 下载视频
    video_response = requests.get(video_url, stream=True, headers={'User-Agent': headers['User-Agent']})
    video_response.raise_for_status()
    
    total_size = int(video_response.headers.get('content-length', 0))
    output_file = f"{video_id}-无水印.mp4"
    
    downloaded = 0
    with open(output_file, 'wb') as f:
        for chunk in video_response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size:
                    percent = (downloaded / total_size) * 100
                    print(f"\r下载进度: {percent:.1f}%", end='')
    
    print(f"\n✅ 下载完成: {output_file}")
    print(f"文件大小: {downloaded / (1024*1024):.2f} MB")
    
except requests.exceptions.RequestException as e:
    print(f"❌ 网络请求失败: {e}")
except KeyError as e:
    print(f"❌ 无法获取视频URL，可能需要登录: {e}")
except Exception as e:
    print(f"❌ 错误: {e}")
