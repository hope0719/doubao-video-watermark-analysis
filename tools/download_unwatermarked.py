#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 成功方法
使用 lr=unwatermarked 参数下载无水印视频
"""

import requests
import json
import re
import hashlib
import sys

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

print("="*70)
print("🎉 豆包视频去水印 - 成功方法")
print("="*70)
print(f"\n视频ID: {VIDEO_ID}")
print("\n关键发现: 使用 lr=unwatermarked 参数可以获取无水印版本！")
print("="*70)

def get_video_url():
    """获取视频URL"""
    
    print("\n【步骤1】获取视频URL")
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
            print(f"✅ 获取成功")
            print(f"原始URL: {video_url[:100]}...")
            
            return video_url
        else:
            print("❌ 无法获取视频URL")
            return None
            
    except Exception as e:
        print(f"❌ 错误: {e}")
        return None


def modify_url_to_unwatermarked(video_url):
    """修改URL参数为 lr=unwatermarked"""
    
    print("\n【步骤2】修改URL参数")
    print("-"*70)
    
    # 检查lr参数
    lr_match = re.search(r'lr=([^&]+)', video_url)
    if lr_match:
        original_lr = lr_match.group(1)
        print(f"原始lr参数: {original_lr}")
        
        # 替换为 unwatermarked
        modified_url = video_url.replace(f'lr={original_lr}', 'lr=unwatermarked')
        
        print(f"修改后lr参数: unwatermarked")
        print(f"修改后URL: {modified_url[:100]}...")
        
        return modified_url
    else:
        print("⚠️ 未找到lr参数")
        return video_url


def verify_unwatermarked_url(video_url):
    """验证无水印URL"""
    
    print("\n【步骤3】验证URL")
    print("-"*70)
    
    try:
        head_response = requests.head(video_url, timeout=10, allow_redirects=True)
        
        if head_response.status_code != 200:
            print(f"❌ 无法访问: {head_response.status_code}")
            return False
        
        etag = head_response.headers.get('ETag', 'N/A').strip('"')
        size = head_response.headers.get('Content-Length', 'N/A')
        
        print(f"✅ URL可访问")
        print(f"ETag: {etag}")
        print(f"大小: {size} bytes")
        
        # 对比已知的带水印版本
        known_watermark_etag = "40b21e0f35b657a0e08a8f4f8d21cfdb"
        known_watermark_size = 3289007
        
        if etag.lower() == known_watermark_etag.lower():
            print(f"\n⚠️ ETag与带水印版本相同")
            print(f"可能修改无效")
            return False
        else:
            print(f"\n🎉 ETag不同！")
            print(f"  带水印版本: {known_watermark_etag}")
            print(f"  当前版本:   {etag}")
            print(f"\n✅ 这很可能是无水印版本！")
            return True
            
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        return False


def download_video(video_url, filename="unwatermarked_video.mp4"):
    """下载视频"""
    
    print(f"\n【步骤4】下载视频")
    print("-"*70)
    
    output_path = f"/Users/hope/Desktop/个人作品集/{filename}"
    
    print(f"保存到: {output_path}")
    
    try:
        response = requests.get(video_url, stream=True, timeout=30)
        total_size = int(response.headers.get('content-length', 0))
        
        print(f"文件大小: {total_size:,} bytes ({total_size/1024/1024:.2f} MB)")
        
        with open(output_path, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        bar_length = 40
                        filled = int(bar_length * downloaded / total_size)
                        bar = '█' * filled + '-' * (bar_length - filled)
                        print(f"\r下载进度: |{bar}| {percent:.1f}%", end='')
        
        print(f"\n\n✅ 下载完成！")
        
        # 计算MD5
        print("\n计算MD5...")
        md5_hash = hashlib.md5()
        with open(output_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
        
        md5 = md5_hash.hexdigest()
        print(f"MD5: {md5}")
        
        # 最终验证
        known_watermark_md5 = "40b21e0f35b657a0e08a8f4f8d21cfdb"
        
        print("\n" + "="*70)
        print("🎯 最终验证")
        print("="*70)
        
        if md5.lower() == known_watermark_md5.lower():
            print(f"\n❌ MD5与带水印版本相同")
            print(f"  带水印版本: {known_watermark_md5}")
            print(f"  当前版本:   {md5}")
            print(f"\n很遗憾，下载的仍然是带水印版本")
            return False
        else:
            print(f"\n🎉🎉🎉 成功！")
            print(f"  带水印版本: {known_watermark_md5}")
            print(f"  当前版本:   {md5}")
            print(f"\n✅ MD5不同，这是一个新版本！")
            print(f"✅ 文件已保存到: {output_path}")
            print(f"\n请用播放器打开视频，确认是否真的没有水印！")
            return True
            
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        return False


def main():
    """主流程"""
    
    # 步骤1: 获取视频URL
    video_url = get_video_url()
    if not video_url:
        print("\n❌ 无法继续")
        return
    
    # 步骤2: 修改为 unwatermarked
    unwatermarked_url = modify_url_to_unwatermarked(video_url)
    
    # 步骤3: 验证
    if not verify_unwatermarked_url(unwatermarked_url):
        print("\n⚠️ URL验证失败，但仍可尝试下载")
        print("是否继续下载？(y/n)")
        choice = input("> ").strip().lower()
        if choice != 'y':
            print("取消下载")
            return
    
    # 步骤4: 下载
    success = download_video(unwatermarked_url, f"{VIDEO_ID}_unwatermarked.mp4")
    
    if success:
        print("\n" + "="*70)
        print("🎉 恭喜！成功下载不同版本的视频！")
        print("="*70)
        print("\n下一步:")
        print("1. 打开视频文件查看")
        print("2. 检查右下角是否还有「豆包」水印")
        print("3. 如果确认无水印，方法验证成功！")
    else:
        print("\n" + "="*70)
        print("😔 下载失败或仍是带水印版本")
        print("="*70)
        print("\n可能的原因:")
        print("1. lr=unwatermarked 参数需要特殊认证")
        print("2. 需要Cookie或Token")
        print("3. 需要从小程序的API调用")


if __name__ == "__main__":
    main()
