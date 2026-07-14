#!/usr/bin/env python3
"""
验证当前的API字段是否真的被关闭
"""
import requests
import json
import urllib3

urllib3.disable_warnings()

def test_get_play_info_api():
    """测试当前的get_play_info API"""
    
    # 使用Chrome扩展中捕获到的实际分享链接
    share_url = "https://www.doubao.com/video-sharing?source_type=mobile&share_id=49152711347982082&video_id=v0269cg10004d946i5iljhtf2dunr5e0"
    
    # 从分享链接提取信息
    video_id = "v0269cg10004d946i5iljhtf2dunr5e0"
    share_id = "49152711347982082"
    
    print(f"🧪 测试豆包API字段 \n")
    print(f"目标视频: {video_id}")
    print(f"分享ID: {share_id}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': f'https://www.doubao.com/video-sharing?source_type=mobile&share_id={share_id}&video_id={video_id}',
        'Origin': 'https://www.doubao.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
    }
    
    # 1. 尝试GET请求
    print(f"\n📡 测试 GET /samantha/media/get_play_info")
    try:
        response = requests.get(
            'https://www.doubao.com/samantha/media/get_play_info',
            params={'video_id': video_id},
            headers=headers,
            timeout=15,
            verify=False
        )
        print(f"   状态: {response.status_code}")
        print(f"   内容长度: {len(response.content)} 字节")
        
        if response.content:
            print(f"   Response: {response.content[:500]}")
        
        if response.status_code != 200:
            print(f"   ❌ 需要认证或已被禁用")
    
    except Exception as e:
        print(f"   ❌ 请求异常: {e}")
    
    # 2. 尝试POST（JS bundle中常见）
    print(f"\n📤 测试 POST /samantha/media/get_play_info")
    try:
        post_data = {
            'video_id': video_id,
            'key': video_id
        }
        
        response = requests.post(
            'https://www.doubao.com/samantha/media/get_play_info',
            json=post_data,
            headers=headers,
            timeout=15,
            verify=False
        )
        print(f"   状态: {response.status_code}")
        print(f"   内容长度: {len(response.content)} 字节")
        
        if response.content:
            try:
                json_data = response.json()
                print(f"   ✅ 获取到JSON响应")
                analyze_api_response(json_data)
                return json_data
            except:
                print(f"   ⚠️ 非JSON响应: {response.text[:1000]}")
        
    except Exception as e:
        print(f"   ❌ POST请求异常: {e}")

def analyze_api_response(data):
    """深入分析API响应结构"""
    
    print(f"\n🔍 深入分析API响应结构")
    print(f"="*50)
    
    # 查找所有包含'media'的字段
    def find_media_fields(obj, path=""):
        media_fields = []
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                
                if 'media' in key.lower() or 'video' in key.lower() or 'url' in key.lower():
                    media_fields.append((current_path, key, str(value)[:200]))
                
                if isinstance(value, (dict, list)):
                    media_fields.extend(find_media_fields(value, current_path))
        
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, (dict, list)):
                    media_fields.extend(find_media_fields(item, f"{path}[{i}]"))
        
        return media_fields
    
    media_fields = find_media_fields(data)
    
    print(f"\n💡 发现 {len(media_fields)} 个媒体相关字段:")
    
    for i, (path, key, value) in enumerate(media_fields, 1):
        print(f"\n[{i}] {path}")
        print(f"    Key: {key}")
        
        # 检查是否URL
        if 'http' in value.lower():
            print(f"    URL: {value}")
            
            # 检查参数
            if 'lr=' in value:
                if 'unwatermark' in value:
                    print(f"    🎯 无水印参数！")
                    with open('unwatermarked_found.txt', 'a') as f:
                        f.write(f"FOUND: {value}\n")
                elif 'watermark' in value:
                    print(f"    ❌ 带水印参数")
                else:
                    print(f"    💭 可能无水印")
        else:
            print(f"    Value: {value}")
    
    # 特别检查original_media_info
    if isinstance(data, dict):
        print(f"\n🎯 特别检查关键字段:")
        for key in ['original_media_info', 'no_watermark_info', 'unwatermarked_info']:
            if key in data:
                print(f"   ✅ 存在 {key}: {data[key]}")
            else:
                print(f"   ❌ 缺失 {key}")

if __name__ == "__main__":
    test_get_play_info_api()