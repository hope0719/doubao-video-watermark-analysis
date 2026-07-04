#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 测试 lr=unwatermarked 参数
重大发现：小程序使用的URL中有 lr=unwatermarked
"""

import requests
import hashlib
import json

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

# 已知的带水印版本
KNOWN_WATERMARK = {
    "md5": "40b21e0f35b657a0e08a8f4f8d21cfdb",
    "etag": "40b21e0f35b657a0e08a8f4f8d21cfdb"
}

print("="*70)
print("🔍 重大发现：测试 lr=unwatermarked 参数")
print("="*70)

# 测试1：标准API，强制请求 lr=unwatermarked
def test_api_with_unwatermarked():
    print("\n【测试1】通过API请求，尝试获取 lr=unwatermarked 的URL")
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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.75(0x18004b31) NetType/WIFI Language/zh_CN'
    }
    
    body = {'key': VIDEO_ID}
    
    try:
        response = requests.post(api_url, params=params, headers=headers, json=body, timeout=10)
        data = response.json()
        
        if 'data' in data and 'original_media_info' in data['data']:
            video_url = data['data']['original_media_info']['main_url']
            print(f"✅ 获取到视频URL")
            print(f"URL: {video_url[:150]}...")
            
            # 检查lr参数
            import re
            lr_match = re.search(r'lr=([^&]+)', video_url)
            if lr_match:
                lr_value = lr_match.group(1)
                print(f"\nlr参数: {lr_value}")
                
                if lr_value == 'unwatermarked':
                    print("🎉 API直接返回了 lr=unwatermarked！")
                    return video_url
                else:
                    print(f"⚠️ API返回的是 lr={lr_value}")
                    print("\n尝试手动修改lr参数...")
                    
                    # 手动替换lr参数
                    modified_url = video_url.replace(f'lr={lr_value}', 'lr=unwatermarked')
                    print(f"修改后URL: {modified_url[:150]}...")
                    return modified_url
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    return None


# 测试2：直接使用抓包的URL
def test_captured_url():
    print("\n\n【测试2】直接测试抓包的URL")
    print("-"*70)
    
    # 这是从抓包中提取的URL
    captured_url = "https://v26-videoweb.doubao.com/80b097246098da163a741ca8c573a3aa/6a49555e/video/tos/cn/tos-cn-v-9ecd54/oI4EIRKSI1lD1ex0AyvAILhcsJEAaI3Q499PrA/?a=497858&ch=0&cr=7&dr=0&er=0&lr=unwatermarked&net=5&cd=0%7C0%7C0%7C1&cv=1&br=887&bt=887&cs=4&ds=4&ft=p9XzxyknffPdOW~-N12NvAq-fXzdPrKWrXkuRkatofGSejVhWL6&mime_type=video_mp4&qs=0&rc=OWhmZTVlN2hpODw1Zzg3aUBpMzhxZ2lrbzg5PDczNGY5M0BhMDAuNGM0XzUxLV8yXi80YSNib3IvcWdmZjFhLS1kNi9zcw%3D%3D&btag=80000e00008000&dy_q=1783187273&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=20260705014753A21164F3336294831FE2"
    
    print("抓包URL:")
    print(f"{captured_url[:100]}...")
    print(f"\n关键参数: lr=unwatermarked")
    
    return captured_url


# 测试3：验证URL并对比
def verify_url(video_url):
    print("\n\n【测试3】验证URL并对比")
    print("-"*70)
    
    if not video_url:
        print("❌ 没有URL")
        return
    
    print(f"\n测试URL: {video_url[:100]}...")
    
    try:
        # HEAD请求获取元数据
        print("\n获取文件元数据...")
        head_response = requests.head(video_url, timeout=10, allow_redirects=True)
        
        print(f"状态码: {head_response.status_code}")
        
        if head_response.status_code != 200:
            print(f"❌ 无法访问")
            return
        
        etag = head_response.headers.get('ETag', 'N/A').strip('"').lower()
        size = head_response.headers.get('Content-Length', 'N/A')
        
        print(f"ETag: {etag}")
        print(f"大小: {size} bytes")
        
        # 关键对比
        print("\n" + "="*70)
        print("📊 对比分析")
        print("="*70)
        
        if etag != 'n/a' and etag == KNOWN_WATERMARK['etag'].lower():
            print(f"\n❌ ETag相同")
            print(f"  已知带水印: {KNOWN_WATERMARK['etag']}")
            print(f"  当前版本:   {etag}")
            print("\n结论：仍然是带水印版本")
        elif etag == 'n/a':
            print(f"\n⚠️ 无法获取ETag")
            print(f"  需要下载完整文件验证")
            download_choice = True
        else:
            print(f"\n🎉 ETag不同！")
            print(f"  已知带水印: {KNOWN_WATERMARK['etag']}")
            print(f"  当前版本:   {etag}")
            print("\n✅ 这可能是无水印版本！")
            download_choice = True
        
        # 询问是否下载
        if download_choice:
            print("\n是否下载完整文件进行最终验证？(y/n)")
            choice = input("> ").strip().lower()
            
            if choice == 'y':
                download_and_verify(video_url)
        
    except Exception as e:
        print(f"❌ 错误: {e}")


# 测试4：下载并验证
def download_and_verify(video_url):
    print("\n\n【测试4】下载完整文件并计算MD5")
    print("-"*70)
    
    filename = "/Users/hope/Desktop/个人作品集/test_unwatermarked.mp4"
    
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
        print("\n计算MD5...")
        md5_hash = hashlib.md5()
        with open(filename, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
        
        md5 = md5_hash.hexdigest()
        print(f"MD5: {md5}")
        
        # 最终判断
        print("\n" + "="*70)
        print("🎯 最终验证结果")
        print("="*70)
        
        if md5.lower() == KNOWN_WATERMARK['md5'].lower():
            print(f"\n❌ MD5相同")
            print(f"  已知带水印: {KNOWN_WATERMARK['md5']}")
            print(f"  当前版本:   {md5}")
            print("\n结论: lr=unwatermarked 参数无效，仍然是带水印版本")
        else:
            print(f"\n🎉🎉🎉 成功！MD5不同！")
            print(f"  已知带水印: {KNOWN_WATERMARK['md5']}")
            print(f"  当前版本:   {md5}")
            print(f"\n✅ 这是一个不同的文件！")
            print(f"✅ 文件已保存: {filename}")
            print(f"\n请用播放器打开视频，确认是否真的没有水印！")
            
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")


# 主流程
def main():
    print("\n关键发现:")
    print("从抓包中发现小程序使用的URL参数是 lr=unwatermarked")
    print("而不是我们之前测试的 lr=video_gen_watermark_dyn")
    print("="*70)
    
    # 测试1：尝试通过API获取
    url_from_api = test_api_with_unwatermarked()
    
    # 测试2：使用抓包的URL
    captured_url = test_captured_url()
    
    # 优先测试抓包的URL
    print("\n\n" + "="*70)
    print("🚀 开始验证")
    print("="*70)
    
    print("\n选择测试哪个URL：")
    print("1. 抓包的URL（推荐）")
    print("2. API返回的URL（修改lr参数）")
    
    choice = input("\n请选择 (1/2): ").strip()
    
    if choice == '1':
        verify_url(captured_url)
    elif choice == '2':
        verify_url(url_from_api)
    else:
        print("\n默认使用抓包的URL")
        verify_url(captured_url)


if __name__ == "__main__":
    main()
