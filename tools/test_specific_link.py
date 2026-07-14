#!/usr/bin/env python3
# 专门分析您提供的豆包视频链接
import requests
import json
import hashlib
from urllib.parse import urlencode

def test_specific_video():
    """测试特定的豆包视频分享链接"""
    
    # 您的视频信息
    share_id = "49141126666482178"
    video_id = "v0d69cg10004d946nuiljht2d4d2v44g"
    
    print("="*80)
    print(f"测试豆包视频去水印 - 特定链接分析")
    print(f"视频ID: {video_id}")
    print(f"分享ID: {share_id}")
    print("="*80)
    
    # 标准请求头
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': f'https://www.doubao.com/video-sharing?share_id={share_id}&source_type=mobile&video_id={video_id}&share_scene=video_viewer'
    }
    
    # 标准API参数
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
    
    # 测试多个API端点
    api_endpoints = [
        {
            'name': '分享页API',
            'url': 'https://www.doubao.com/creativity/share/get_video_share_info',
            'data': {
                'share_id': share_id,
                'vid': video_id,
                'creation_id': ''
            }
        },
        {
            'name': '媒体播放API',
            'url': 'https://www.doubao.com/samantha/media/get_play_info', 
            'data': {'key': video_id}
        },
        {
            'name': '视频播放API',
            'url': 'https://www.doubao.com/samantha/video/get_play_info',
            'data': {'vid': video_id}
        }
    ]
    
    all_video_urls = []
    
    for endpoint in api_endpoints:
        print(f"\n{'='*60}")
        print(f"测试API: {endpoint['name']}")
        print(f"URL: {endpoint['url']}")
        print(f"{'='*60}")
        
        try:
            response = requests.post(
                endpoint['url'], 
                params=params, 
                headers=headers, 
                json=endpoint['data'],
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ API调用成功")
                
                # 查找视频URL
                def find_video_urls(obj, path=""):
                    urls = []
                    if isinstance(obj, dict):
                        for key, value in obj.items():
                            new_path = f"{path}.{key}" if path else key
                            if isinstance(value, str) and ('mp4' in value or 'videoweb.doubao.com' in value):
                                urls.append((new_path, value))
                            elif isinstance(value, (dict, list)):
                                urls.extend(find_video_urls(value, new_path))
                    elif isinstance(obj, list):
                        for i, item in enumerate(obj):
                            urls.extend(find_video_urls(item, f"{path}[{i}]"))
                    return urls
                
                video_urls = find_video_urls(result)
                
                if video_urls:
                    print(f"\n发现 {len(video_urls)} 个视频URL:")
                    for path, url in video_urls:
                        print(f"\n📹 {path}:")
                        print(f"   {url}")
                        
                        # 分析lr参数
                        if 'lr=' in url:
                            import re
                            lr_match = re.search(r'lr=([^&]+)', url)
                            if lr_match:
                                lr_value = lr_match.group(1)
                                print(f"   🔍 lr参数: {lr_value}")
                                
                                # 检查是否包含无水印关键词
                                watermark_keywords = ['unwatermarked', 'no_watermark', 'raw', 'original', 'clean']
                                if any(kw in lr_value.lower() for kw in watermark_keywords):
                                    print(f"   ⚠️  发现可能的无水印参数!")
                                else:
                                    print(f"   📝 水印参数: {lr_value}")
                        
                        all_video_urls.append((endpoint['name'], path, url))
                        
                        # 获取ETag验证文件一致性
                        try:
                            head_response = requests.head(url, timeout=10)
                            etag = head_response.headers.get('etag', 'N/A')
                            content_length = head_response.headers.get('content-length', 'N/A')
                            print(f"   📊 ETag: {etag}")
                            print(f"   📏 大小: {content_length} bytes")
                        except Exception as e:
                            print(f"   ❌ 无法获取ETag: {e}")
                            
                else:
                    print("❌ 未找到视频URL")
                    
            else:
                print(f"❌ API调用失败: HTTP {response.status_code}")
                print(f"响应: {response.text[:200]}")
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    # 总结分析
    print(f"\n{'='*80}")
    print("🔍 综合分析总结")
    print(f"{'='*80}")
    
    if all_video_urls:
        print(f"✅ 共发现 {len(all_video_urls)} 个视频URL")
        
        # 检查URL一致性
        urls_only = [url for _, _, url in all_video_urls]
        unique_urls = list(set(urls_only))
        
        if len(unique_urls) == 1:
            print("❌ 所有API返回相同的URL（符合之前的测试结论）")
        else:
            print(f"⚠️  发现 {len(unique_urls)} 个不同的URL:")
            for u in unique_urls:
                print(f"   {u}")
        
        # 检查ETag一致性
        try:
            if len(all_video_urls) > 1:
                first_url = all_video_urls[0][2]
                second_url = all_video_urls[1][2]
                
                first_head = requests.head(first_url, timeout=10)
                second_head = requests.head(second_url, timeout=10)
                
                first_etag = first_head.headers.get('etag', 'N/A')
                second_etag = second_head.headers.get('etag', 'N/A')
                
                if first_etag == second_etag:
                    print(f"🔍 ETag一致性: ✅ 相同 ({first_etag})")
                else:
                    print(f"🔍 ETag一致性: ❌ 不同")
                    print(f"   URL1 ETag: {first_etag}")
                    print(f"   URL2 ETag: {second_etag}")
                    
        except Exception as e:
            print(f"🔍 ETag检查失败: {e}")
    
    else:
        print("❌ 未发现任何视频URL")
    
    print(f"\n{'='*80}")
    print("🏁 分析完成")
    print(f"{'='*80}")

if __name__ == "__main__":
    test_specific_video()