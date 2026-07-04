#!/usr/bin/env python3
import requests
import json

video_id = "v0d69cg10004d946nuiljht2d4d2v44g"

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
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

data = {'key': video_id}

print("正在分析API响应...")

try:
    response = requests.post(api_url, params=params, headers=headers, json=data, timeout=30)
    response.raise_for_status()
    
    result = response.json()
    
    # 打印完整的响应结构
    print("\n" + "="*60)
    print("完整API响应:")
    print("="*60)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 分析可能的视频URL字段
    print("\n" + "="*60)
    print("可能的视频URL字段:")
    print("="*60)
    
    if 'data' in result:
        data = result['data']
        
        # 检查所有可能包含视频URL的字段
        fields_to_check = [
            'original_media_info',
            'media_info', 
            'video_info',
            'play_info',
            'raw_video',
            'source_video'
        ]
        
        for field in fields_to_check:
            if field in data:
                print(f"\n{field}:")
                print(json.dumps(data[field], indent=2, ensure_ascii=False))
        
        # 递归查找所有包含'url'的字段
        print("\n" + "="*60)
        print("所有包含URL的字段:")
        print("="*60)
        
        def find_urls(obj, path=""):
            urls = []
            if isinstance(obj, dict):
                for key, value in obj.items():
                    new_path = f"{path}.{key}" if path else key
                    if 'url' in key.lower():
                        urls.append((new_path, value))
                    urls.extend(find_urls(value, new_path))
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    urls.extend(find_urls(item, f"{path}[{i}]"))
            return urls
        
        all_urls = find_urls(result)
        for path, url in all_urls:
            print(f"\n{path}:")
            print(f"  {url}")
    
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
