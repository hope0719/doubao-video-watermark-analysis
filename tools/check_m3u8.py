#!/usr/bin/env python3
"""
检查豆包视频是否使用HLS流媒体协议
尝试发现.m3u8播放列表和.ts分片
"""
import requests
import json
import re

video_id = "v0d69cg10004d946nuiljht2d4d2v44g"

# 1. 获取视频信息
api_url = "https://www.doubao.com/samantha/media/get_play_info"
params = {
    'version_code': '20800',
    'language': 'zh-CN',
    'device_platform': 'web',
    'aid': '497858',
}

headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://www.doubao.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

print("="*60)
print("方向1: 检查HLS/M3U8流媒体")
print("="*60)

try:
    response = requests.post(api_url, params=params, headers=headers, json={'key': video_id}, timeout=30)
    result = response.json()
    
    video_url = result['data']['original_media_info']['main_url']
    
    print(f"\n原始视频URL: {video_url[:100]}...")
    
    # 检查URL中是否包含m3u8相关信息
    if 'm3u8' in video_url.lower():
        print("✓ 发现m3u8播放列表!")
    else:
        print("✗ 不是m3u8格式")
    
    # 2. 尝试获取可能的m3u8 URL（修改扩展名）
    base_url = video_url.split('?')[0]
    m3u8_urls = [
        video_url.replace('.mp4', '.m3u8'),
        base_url.replace('.mp4', '.m3u8') + '?' + video_url.split('?')[1],
        base_url + '/index.m3u8?' + video_url.split('?')[1] if '?' in video_url else base_url + '/index.m3u8',
    ]
    
    print("\n尝试访问可能的m3u8播放列表:")
    for m3u8_url in m3u8_urls[:3]:
        try:
            print(f"\n测试: {m3u8_url[:80]}...")
            m3u8_response = requests.get(m3u8_url, headers=headers, timeout=10)
            
            if m3u8_response.status_code == 200:
                print(f"✓ HTTP 200 - 成功!")
                print(f"Content-Type: {m3u8_response.headers.get('content-type')}")
                print(f"内容预览:\n{m3u8_response.text[:500]}")
                
                # 解析m3u8内容
                if '#EXTM3U' in m3u8_response.text:
                    print("\n✓ 这是一个有效的m3u8播放列表!")
                    
                    # 查找.ts分片
                    ts_segments = re.findall(r'([^\s]+\.ts)', m3u8_response.text)
                    if ts_segments:
                        print(f"发现 {len(ts_segments)} 个.ts分片")
                        print(f"示例: {ts_segments[0]}")
                break
            else:
                print(f"✗ HTTP {m3u8_response.status_code}")
        except Exception as e:
            print(f"✗ 失败: {e}")
    
    # 3. 检查响应头中是否有其他流媒体协议线索
    print("\n" + "="*60)
    print("检查视频文件头信息:")
    print("="*60)
    
    head_response = requests.head(video_url, headers=headers, timeout=10)
    print(f"Content-Type: {head_response.headers.get('content-type')}")
    print(f"Content-Length: {head_response.headers.get('content-length')} bytes")
    print(f"Accept-Ranges: {head_response.headers.get('accept-ranges')}")
    print(f"ETag: {head_response.headers.get('etag')}")
    
    # 检查是否支持range请求（分片下载）
    if head_response.headers.get('accept-ranges') == 'bytes':
        print("\n✓ 支持Range请求，可以分片下载")
        
        # 下载前1KB查看文件头
        range_response = requests.get(
            video_url, 
            headers={**headers, 'Range': 'bytes=0-1023'},
            timeout=10
        )
        
        if range_response.status_code == 206:
            print("✓ Range请求成功 (HTTP 206)")
            
            # 检查文件魔数
            file_header = range_response.content[:12]
            print(f"文件头(hex): {file_header.hex()}")
            
            # MP4文件通常以ftyp开头
            if b'ftyp' in file_header:
                print("✓ 确认为MP4容器格式")
            elif b'#EXTM3U' in range_response.content:
                print("✓ 这是m3u8播放列表!")

except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
