#!/usr/bin/env python3
"""
方向2: 模拟移动端（iOS/Android）请求
检查移动端是否有不同的API或参数
"""
import requests
import json

video_id = "v0d69cg10004d946nuiljht2d4d2v44g"

print("="*60)
print("方向2: 模拟移动端请求")
print("="*60)

# 测试不同的设备平台和User-Agent
test_cases = [
    {
        "name": "iOS App",
        "device_platform": "ios",
        "user_agent": "aweme/18.0.0 (iPhone; iOS 16.0; Scale/3.00)",
        "version_code": "18.0.0"
    },
    {
        "name": "Android App",
        "device_platform": "android",
        "user_agent": "aweme/18.0.0 (Linux; U; Android 12; zh-CN; SM-G9980 Build/SP1A.210812.016)",
        "version_code": "180000"
    },
    {
        "name": "iPad",
        "device_platform": "ipad",
        "user_agent": "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "version_code": "20800"
    },
    {
        "name": "微信内置浏览器",
        "device_platform": "web",
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.38",
        "version_code": "20800"
    },
]

api_url = "https://www.doubao.com/samantha/media/get_play_info"

for test_case in test_cases:
    print(f"\n{'='*60}")
    print(f"测试: {test_case['name']}")
    print('='*60)
    
    params = {
        'version_code': test_case['version_code'],
        'language': 'zh-CN',
        'device_platform': test_case['device_platform'],
        'aid': '497858',
        'real_aid': '497858',
        'pkg_type': 'release_version',
        'samantha_web': '1',
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': test_case['user_agent']
    }
    
    try:
        response = requests.post(
            api_url, 
            params=params, 
            headers=headers, 
            json={'key': video_id}, 
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if 'data' in result and 'original_media_info' in result['data']:
                video_url = result['data']['original_media_info']['main_url']
                
                # 获取ETag验证是否是相同文件
                head_resp = requests.head(video_url, timeout=10)
                etag = head_resp.headers.get('etag', 'N/A')
                
                print(f"✓ 成功获取视频URL")
                print(f"  ETag: {etag}")
                
                # 检查URL参数差异
                if 'lr=' in video_url:
                    lr_param = video_url.split('lr=')[1].split('&')[0]
                    print(f"  lr参数: {lr_param}")
                
                # 检查是否有quality/definition参数
                if 'quality=' in video_url or 'definition=' in video_url:
                    print(f"  ✓ 发现quality/definition参数")
                
            else:
                print(f"✗ API返回数据格式异常")
                print(f"  Response: {json.dumps(result, ensure_ascii=False)[:200]}")
        else:
            print(f"✗ HTTP {response.status_code}")
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")

# 尝试其他可能的API端点
print(f"\n{'='*60}")
print("测试其他API端点")
print('='*60)

alternative_apis = [
    "https://www.doubao.com/samantha/video/get_video_info",
    "https://www.doubao.com/samantha/creativity/get_video_detail",
    "https://www.doubao.com/api/video/get_play_info",
    "https://www.doubao.com/aweme/v1/play/",
]

headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

for api in alternative_apis:
    print(f"\n测试: {api}")
    try:
        response = requests.post(
            api,
            json={'key': video_id, 'video_id': video_id},
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✓ HTTP 200")
            result = response.json()
            print(f"  响应: {json.dumps(result, ensure_ascii=False)[:200]}...")
        else:
            print(f"✗ HTTP {response.status_code}")
    except Exception as e:
        print(f"✗ {type(e).__name__}")
