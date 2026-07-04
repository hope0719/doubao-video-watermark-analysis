#!/usr/bin/env python3
import requests
import json
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

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

print("正在获取视频信息...")

try:
    response = requests.post(api_url, params=params, headers=headers, json=data, timeout=30)
    response.raise_for_status()
    
    result = response.json()
    original_url = result['data']['original_media_info']['main_url']
    
    print(f"\n原始URL参数分析:")
    parsed = urlparse(original_url)
    query_params = parse_qs(parsed.query)
    
    # 打印关键参数
    print(f"  lr (watermark类型): {query_params.get('lr', ['无'])[0]}")
    
    # 尝试不同的方法去除水印
    methods = [
        ("方法1: 移除lr参数", lambda u: remove_param(u, 'lr')),
        ("方法2: 修改lr为空", lambda u: modify_param(u, 'lr', '')),
        ("方法3: 修改lr为video_gen", lambda u: modify_param(u, 'lr', 'video_gen')),
        ("方法4: 修改lr为origin", lambda u: modify_param(u, 'lr', 'origin')),
        ("方法5: 修改lr为original", lambda u: modify_param(u, 'lr', 'original')),
        ("方法6: 原始URL", lambda u: u),
    ]
    
    for method_name, method_func in methods:
        print(f"\n{'='*60}")
        print(method_name)
        print('='*60)
        
        modified_url = method_func(original_url)
        output_file = f"{video_id}-{method_name.split(':')[0]}.mp4"
        
        try:
            # 测试URL是否有效
            test_response = requests.head(modified_url, headers={'User-Agent': headers['User-Agent']}, timeout=10)
            
            if test_response.status_code == 200:
                print(f"✓ URL有效，开始下载...")
                
                # 下载视频
                video_response = requests.get(modified_url, stream=True, headers={'User-Agent': headers['User-Agent']})
                
                total_size = int(video_response.headers.get('content-length', 0))
                downloaded = 0
                
                with open(output_file, 'wb') as f:
                    for chunk in video_response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total_size:
                                percent = (downloaded / total_size) * 100
                                print(f"\r  下载进度: {percent:.1f}%", end='')
                
                print(f"\n✅ 保存为: {output_file}")
                print(f"  文件大小: {downloaded / (1024*1024):.2f} MB")
            else:
                print(f"✗ URL无效 (HTTP {test_response.status_code})")
                
        except Exception as e:
            print(f"✗ 失败: {e}")

except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()

def remove_param(url, param_name):
    """从URL中移除指定参数"""
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    query_params.pop(param_name, None)
    new_query = urlencode(query_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))

def modify_param(url, param_name, new_value):
    """修改URL中的参数值"""
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    query_params[param_name] = [new_value]
    new_query = urlencode(query_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))
