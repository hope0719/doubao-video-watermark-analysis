#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 带登录态测试工具
如果你是视频创作者，这个工具可以测试登录后是否有特殊权限
"""

import requests
import json
import re
import hashlib

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

print("="*70)
print("🔐 豆包视频 - 登录态测试工具")
print("="*70)
print(f"\n目标视频ID: {VIDEO_ID}")
print("\n" + "="*70)
print("📋 获取Cookie的步骤")
print("="*70)
print("""
1. 在Chrome/Edge浏览器中访问 https://www.doubao.com
2. 登录你的豆包账号（重要：如果你是视频创作者更好）
3. 按 F12 打开开发者工具
4. 点击 Network（网络）标签
5. 刷新页面或访问你的视频
6. 找到任意一个到 doubao.com 的请求
7. 在右侧找到 Request Headers
8. 复制整个 Cookie 行的值

示例格式：
sessionid=xxx; tt_webid=xxx; passport_csrf_token=xxx; ...

⚠️ 注意：Cookie包含敏感信息，请勿分享给他人
""")

print("\n请粘贴你的Cookie（直接回车跳过）：")
user_cookie = input("> ").strip()

if not user_cookie:
    print("\n❌ 未提供Cookie，无法继续测试")
    print("\n💡 提示：")
    print("如果你不是视频创作者，登录态可能也无效")
    print("最有可能成功的是：视频创作者本人 + 登录状态")
    exit(0)

print("\n✅ 已获取Cookie，开始测试...")
print("="*70)

# 测试1: 标准API带登录态
def test_standard_api_with_auth():
    print("\n【测试1】标准API + 登录态")
    print("-"*70)
    
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
        'Referer': 'https://www.doubao.com/',
        'Cookie': user_cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.post(
            api_url,
            params=params,
            headers=headers,
            json={'key': VIDEO_ID},
            timeout=10
        )
        
        print(f"响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'data' in data and 'original_media_info' in data['data']:
                video_url = data['data']['original_media_info']['main_url']
                
                print(f"\n✅ 获取到视频URL")
                print(f"URL: {video_url[:100]}...")
                
                # 检查lr参数
                lr_match = re.search(r'lr=([^&]+)', video_url)
                if lr_match:
                    lr_value = lr_match.group(1)
                    print(f"\nlr参数: {lr_value}")
                    
                    if lr_value == 'video_gen_watermark_dyn':
                        print("⚠️ lr参数仍然是 video_gen_watermark_dyn")
                        print("   这意味着返回的可能仍是带水印版本")
                    else:
                        print("🎉 lr参数不同！这可能是无水印版本！")
                        print(f"   新的lr值: {lr_value}")
                
                # 获取ETag
                print("\n获取视频文件元数据...")
                head_resp = requests.head(video_url, timeout=10)
                etag = head_resp.headers.get('ETag', 'N/A').strip('"')
                size = head_resp.headers.get('Content-Length', 'N/A')
                
                print(f"ETag: {etag}")
                print(f"大小: {size} bytes")
                
                # 对比已知的带水印版本
                known_watermark_etag = "40b21e0f35b657a0e08a8f4f8d21cfdb"
                known_watermark_size = "3289007"
                
                if etag.lower() == known_watermark_etag.lower():
                    print("\n❌ ETag与已知的带水印版本相同")
                    print("   登录态没有改变返回的视频版本")
                elif size == known_watermark_size:
                    print("\n❌ 文件大小与已知的带水印版本相同")
                    print("   登录态没有改变返回的视频版本")
                else:
                    print("\n🎉 ETag或文件大小不同！")
                    print("   这可能是一个不同的版本！")
                    print("\n建议下载完整文件进行验证")
                    
                return video_url, etag
        else:
            print(f"❌ 请求失败: {response.status_code}")
            print(f"响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    return None, None


# 测试2: 创作者专属API
def test_creator_apis():
    print("\n\n【测试2】创作者专属API")
    print("-"*70)
    
    creator_apis = [
        {
            'url': 'https://www.doubao.com/samantha/creation/get_my_video',
            'body': {'video_id': VIDEO_ID}
        },
        {
            'url': 'https://www.doubao.com/samantha/creation/download_video',
            'body': {'video_id': VIDEO_ID, 'watermark': False}
        },
        {
            'url': 'https://www.doubao.com/samantha/workspace/export_video',
            'body': {'video_id': VIDEO_ID, 'format': 'original'}
        },
        {
            'url': 'https://www.doubao.com/api/creator/video/get_download_url',
            'body': {'video_id': VIDEO_ID, 'quality': 'origin'}
        },
    ]
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'Referer': 'https://www.doubao.com/',
        'Cookie': user_cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    for api_info in creator_apis:
        print(f"\n测试: {api_info['url']}")
        
        try:
            response = requests.post(
                api_info['url'],
                json=api_info['body'],
                headers=headers,
                timeout=10
            )
            
            print(f"  状态: {response.status_code}")
            
            if response.status_code == 200:
                print(f"  ✅ 请求成功！")
                try:
                    data = response.json()
                    print(f"  响应: {json.dumps(data, indent=2, ensure_ascii=False)[:300]}")
                    
                    # 查找视频URL
                    response_str = json.dumps(data)
                    video_urls = re.findall(r'https://[^"]+\.mp4[^"]*', response_str)
                    if video_urls:
                        print(f"\n  🎬 发现视频URL:")
                        for url in video_urls:
                            print(f"     {url[:80]}...")
                except:
                    print(f"  响应: {response.text[:200]}")
            elif response.status_code == 404:
                print(f"  ⚠️ 端点不存在")
            elif response.status_code == 401 or response.status_code == 403:
                print(f"  ⚠️ 权限不足（可能需要创作者权限）")
            else:
                print(f"  响应: {response.text[:100]}")
                
        except Exception as e:
            print(f"  错误: {e}")


# 测试3: 下载并验证
def download_and_verify(video_url, etag):
    print("\n\n【测试3】下载并验证视频")
    print("-"*70)
    
    if not video_url:
        print("❌ 没有视频URL，跳过下载")
        return
    
    print("是否下载完整视频进行验证？(y/n)")
    choice = input("> ").strip().lower()
    
    if choice != 'y':
        print("跳过下载")
        return
    
    filename = f"/Users/hope/Desktop/个人作品集/test_with_login_{VIDEO_ID}.mp4"
    
    print(f"\n正在下载到: {filename}")
    
    try:
        response = requests.get(video_url, stream=True, timeout=30)
        total_size = int(response.headers.get('content-length', 0))
        
        print(f"文件大小: {total_size} bytes")
        
        with open(filename, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r进度: {percent:.1f}%", end='')
        
        print(f"\n\n✅ 下载完成")
        
        # 计算MD5
        print("计算MD5...")
        md5_hash = hashlib.md5()
        with open(filename, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
        
        md5 = md5_hash.hexdigest()
        print(f"MD5: {md5}")
        
        # 对比
        known_md5 = "40b21e0f35b657a0e08a8f4f8d21cfdb"
        
        if md5.lower() == known_md5.lower():
            print("\n❌ MD5与已知的带水印版本完全相同")
            print("   结论: 登录态没有获取到不同的视频版本")
        else:
            print("\n🎉🎉🎉 MD5不同！这是一个新版本！")
            print(f"   已知带水印版本: {known_md5}")
            print(f"   当前版本:       {md5}")
            print(f"\n   ✅ 恭喜！这可能是无水印版本！")
            print(f"   文件已保存到: {filename}")
            
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")


# 主流程
print("\n开始测试...")

video_url, etag = test_standard_api_with_auth()
test_creator_apis()
download_and_verify(video_url, etag)

print("\n\n" + "="*70)
print("✅ 测试完成")
print("="*70)

print("""
📊 结果分析：

如果ETag和MD5都相同：
  → 登录态没有特殊权限
  → 即使是创作者也无法通过API获取无水印版本
  
如果ETag或MD5不同：
  → 🎉 恭喜！找到了不同的版本
  → 请检查视频是否真的没有水印
  
💡 下一步建议：

1. 如果测试失败，尝试在豆包网页上查找「导出」或「下载」按钮
2. 检查账号设置中是否有「数据导出」功能
3. 联系豆包客服，询问创作者导出功能
4. 使用AI工具进行后期去水印处理
""")
