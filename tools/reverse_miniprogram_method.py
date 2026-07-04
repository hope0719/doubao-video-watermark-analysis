#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 逆向小程序方法
既然小程序能快速去水印，说明它找到了我们没有发现的API或参数
"""

import requests
import json
import re
from urllib.parse import urlparse, parse_qs

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"
SHARE_URL = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"

print("="*70)
print("🔍 逆向小程序去水印方法")
print("="*70)
print("\n关键假设：小程序一定使用了特殊的API端点或参数组合")
print("="*70)

# 方向1: 测试移动端专用API（小程序是移动端）
print("\n\n【测试1】微信小程序专用API")
print("-"*70)

# 微信小程序有专门的User-Agent和特殊参数
miniprogram_apis = [
    {
        'url': 'https://www.doubao.com/samantha/media/get_play_info',
        'params': {
            'platform': 'miniprogram',
            'app_name': 'aweme_lite',
            'version_code': '1',
            'aid': '1128',  # 微信小程序的aid
            'channel': 'miniprogram',
            'from': 'miniprogram'
        },
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MI 8 Build/QKQ1.190828.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.186 Mobile Safari/537.36 XWEB/1260117 MMWEBSDK/20240501 MMWEBID/6170 MicroMessenger/8.0.50.2701(0x2800325D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android',
            'Content-Type': 'application/json',
            'Referer': 'https://servicewechat.com/'
        }
    },
    {
        'url': 'https://www.doubao.com/api/video/parse',
        'params': {
            'url': SHARE_URL,
            'platform': 'miniprogram'
        },
        'headers': {
            'User-Agent': 'MicroMessenger',
            'Content-Type': 'application/json'
        }
    }
]

for i, api_config in enumerate(miniprogram_apis):
    print(f"\n测试 {i+1}: {api_config['url']}")
    
    try:
        response = requests.post(
            api_config['url'],
            params=api_config.get('params', {}),
            headers=api_config['headers'],
            json={'key': VIDEO_ID} if 'get_play_info' in api_config['url'] else {'url': SHARE_URL},
            timeout=10
        )
        
        print(f"  状态: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"  响应类型: JSON")
                
                # 查找视频URL
                data_str = json.dumps(data)
                video_urls = re.findall(r'https://[^"]+\.(mp4|m3u8)[^"]*', data_str)
                
                if video_urls:
                    print(f"  ✅ 发现 {len(video_urls)} 个视频URL")
                    for url in video_urls[:3]:
                        print(f"     {url[:100]}...")
                        
                        # 检查lr参数
                        if 'lr=' in url:
                            lr_match = re.search(r'lr=([^&]+)', url)
                            if lr_match:
                                lr_value = lr_match.group(1)
                                print(f"       lr参数: {lr_value}")
                else:
                    print(f"  ⚠️ 未发现视频URL")
                    print(f"  响应: {data_str[:200]}")
            except:
                print(f"  响应: {response.text[:200]}")
        else:
            print(f"  响应: {response.text[:100]}")
    except Exception as e:
        print(f"  错误: {e}")


# 方向2: 测试分享链接的特殊解析API
print("\n\n【测试2】分享链接解析API")
print("-"*70)
print("小程序可能先解析分享链接，获取特殊参数")

parse_apis = [
    'https://www.doubao.com/api/share/parse',
    'https://www.doubao.com/samantha/share/parse',
    'https://www.doubao.com/web/share/parse',
    'https://www.doubao.com/api/video/share/parse',
]

for api_url in parse_apis:
    print(f"\n测试: {api_url}")
    
    try:
        response = requests.post(
            api_url,
            json={'share_url': SHARE_URL},
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout=5
        )
        
        print(f"  状态: {response.status_code}")
        
        if response.status_code == 200:
            print(f"  ✅ 成功!")
            try:
                data = response.json()
                print(f"  {json.dumps(data, indent=2, ensure_ascii=False)[:300]}")
            except:
                print(f"  {response.text[:200]}")
    except Exception as e:
        print(f"  错误: {e}")


# 方向3: 测试带特殊token的API
print("\n\n【测试3】带特殊认证token的API")
print("-"*70)
print("小程序可能有专属的access_token或app_key")

# 常见的微信小程序参数
special_params = {
    'appid': 'wx1234567890',  # 需要真实的小程序appid
    'access_token': 'test',
    'app_key': 'miniprogram',
    'from_miniprogram': '1',
    'miniprogram_scene': '1007',
}

api_url = "https://www.doubao.com/samantha/media/get_play_info"

for key, value in special_params.items():
    print(f"\n测试参数: {key}={value}")
    
    try:
        response = requests.post(
            api_url,
            params={
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
                key: value  # 添加特殊参数
            },
            headers={'Content-Type': 'application/json'},
            json={'key': VIDEO_ID},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'original_media_info' in data['data']:
                url = data['data']['original_media_info']['main_url']
                
                # 检查ETag
                head_resp = requests.head(url, timeout=5)
                etag = head_resp.headers.get('ETag', 'N/A').strip('"')
                
                print(f"  ✅ 获取成功")
                print(f"  ETag: {etag}")
                
                if etag.lower() != '40b21e0f35b657a0e08a8f4f8d21cfdb':
                    print(f"  🎉 ETag不同！可能找到了特殊方法！")
    except:
        pass


# 方向4: 测试不同的video_id格式
print("\n\n【测试4】测试video_id的不同格式")
print("-"*70)
print("小程序可能使用不同的ID格式获取不同版本")

# 从分享链接提取share_id
share_id = "49141126666482178"

id_variations = [
    {'key': VIDEO_ID},
    {'video_id': VIDEO_ID},
    {'id': VIDEO_ID},
    {'vid': VIDEO_ID},
    {'item_id': VIDEO_ID},
    {'aweme_id': VIDEO_ID},
    {'share_id': share_id},
    {'share_id': share_id, 'video_id': VIDEO_ID},
]

api_url = "https://www.doubao.com/samantha/media/get_play_info"

for body in id_variations:
    print(f"\n测试body: {body}")
    
    try:
        response = requests.post(
            api_url,
            params={
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
            },
            headers={'Content-Type': 'application/json'},
            json=body,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'original_media_info' in data['data']:
                url = data['data']['original_media_info']['main_url']
                
                # 获取ETag
                head_resp = requests.head(url, timeout=5)
                etag = head_resp.headers.get('ETag', 'N/A').strip('"')
                
                print(f"  ✅ 成功 | ETag: {etag}")
                
                if etag.lower() != '40b21e0f35b657a0e08a8f4f8d21cfdb':
                    print(f"  🎉 ETag不同！")
            else:
                print(f"  ⚠️ 无video_info")
        else:
            print(f"  状态: {response.status_code}")
    except Exception as e:
        pass


# 方向5: 测试CDN的特殊域名
print("\n\n【测试5】测试其他CDN域名")
print("-"*70)
print("小程序可能访问不同的CDN节点或域名")

# 先获取标准URL
standard_url = None
try:
    response = requests.post(
        "https://www.doubao.com/samantha/media/get_play_info",
        params={'version_code': '20800', 'device_platform': 'web', 'aid': '497858'},
        headers={'Content-Type': 'application/json'},
        json={'key': VIDEO_ID},
        timeout=10
    )
    data = response.json()
    standard_url = data['data']['original_media_info']['main_url']
except:
    pass

if standard_url:
    parsed = urlparse(standard_url)
    
    # 尝试不同的CDN域名
    cdn_domains = [
        'v9-videoweb.doubao.com',      # 原始
        'v9-show.douyinvod.com',        # 抖音CDN
        'v26-videoweb.doubao.com',      # 不同节点
        'v3-videoweb.doubao.com',       # 不同节点
        'origin-videoweb.doubao.com',   # origin节点
        'raw-videoweb.doubao.com',      # raw节点
    ]
    
    for domain in cdn_domains:
        test_url = standard_url.replace(parsed.netloc, domain)
        
        print(f"\n测试域名: {domain}")
        
        try:
            head_resp = requests.head(test_url, timeout=5)
            
            if head_resp.status_code == 200:
                etag = head_resp.headers.get('ETag', 'N/A').strip('"')
                size = head_resp.headers.get('Content-Length', 'N/A')
                
                print(f"  ✅ 可访问")
                print(f"  ETag: {etag}")
                print(f"  大小: {size}")
                
                if etag.lower() != '40b21e0f35b657a0e08a8f4f8d21cfdb':
                    print(f"  🎉 ETag不同！可能是无水印版本！")
            else:
                print(f"  状态: {head_resp.status_code}")
        except:
            print(f"  ❌ 无法访问")


print("\n\n" + "="*70)
print("💡 关键建议")
print("="*70)
print("""
如果小程序真的能快速去水印，可能的原因：

1. 【最可能】小程序有专门的appid和access_token
   → 需要抓包小程序的实际请求
   → 使用微信开发者工具或抓包工具

2. 小程序使用了不同的API端点
   → 可能是内部API或合作伙伴API

3. 小程序访问了不同的CDN节点
   → 某些节点可能返回不同版本

4. 小程序利用了时间窗口
   → 视频刚生成时可能有无水印版本

📱 如何抓包小程序的真实请求：

方法1 - 微信开发者工具：
1. 下载微信开发者工具
2. 在工具中打开去水印小程序（需要小程序源码或体验版）
3. 在Network标签中查看实际请求
4. 复制请求的URL、参数、headers

方法2 - 手机抓包：
1. 安装Charles或Fiddler
2. 配置手机代理到电脑
3. 在微信中使用去水印小程序
4. 查看Charles中捕获的请求
5. 找到视频URL相关的请求

方法3 - 反编译小程序：
1. 从手机中提取小程序包(.wxapkg)
2. 使用wxappUnpacker解包
3. 查看JavaScript源码
4. 找到API调用逻辑

💬 你能提供什么信息？

如果你能提供以下任何信息，我可以立即测试：
1. 小程序的名称（例如"小青去水印"）
2. 小程序的appid
3. 抓包到的实际请求URL和参数
4. 小程序返回的视频URL样例
""")
