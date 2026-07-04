#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 实际下载测试与水印检测
通过OpenCV进行视频帧分析，检测水印位置和特征
测试日期：2026-07-04
"""

import requests
import json
import hashlib
import os
from urllib.parse import urlparse, parse_qs

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

def get_video_url_from_api():
    """从API获取视频URL"""
    print("=" * 70)
    print("📡 步骤1: 从API获取视频URL")
    print("=" * 70)
    
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    try:
        response = requests.post(
            api_url,
            json={"key": VIDEO_ID},
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # 提取所有可能的视频URL
            video_urls = []
            
            # 1. original_media_info.main_url (1080p)
            if 'data' in data and 'original_media_info' in data['data']:
                original_url = data['data']['original_media_info'].get('main_url')
                if original_url:
                    video_urls.append({
                        'url': original_url,
                        'quality': '1080p',
                        'source': 'original_media_info'
                    })
            
            # 2. media_info[0].main_url (720p)
            if 'data' in data and 'media_info' in data['data']:
                for i, media in enumerate(data['data']['media_info']):
                    url = media.get('main_url')
                    if url:
                        video_urls.append({
                            'url': url,
                            'quality': media.get('definition', '720p'),
                            'source': f'media_info[{i}]'
                        })
            
            print(f"\n✅ 找到 {len(video_urls)} 个视频URL:")
            for i, v in enumerate(video_urls):
                print(f"\n  [{i+1}] {v['source']} ({v['quality']})")
                print(f"      {v['url'][:100]}...")
            
            return video_urls
        else:
            print(f"❌ API请求失败: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ 错误: {e}")
        return []


def analyze_url_structure(url):
    """分析URL结构，提取所有参数"""
    print("\n" + "=" * 70)
    print("🔍 URL结构分析")
    print("=" * 70)
    
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    
    print(f"\n域名: {parsed.netloc}")
    print(f"路径: {parsed.path}")
    print(f"\n参数列表:")
    
    for key, values in params.items():
        for value in values:
            print(f"  {key} = {value}")
            
            # 特别标注可疑参数
            if key in ['lr', 'watermark', 'quality', 'definition']:
                print(f"    ⚠️ 这是可能控制水印的参数！")
    
    return params


def download_video_with_variations(base_url):
    """下载视频的多个变体版本，测试不同的URL参数"""
    print("\n" + "=" * 70)
    print("📥 步骤2: 下载不同参数版本进行对比")
    print("=" * 70)
    
    # 生成URL变体
    variations = [
        {'name': 'original', 'url': base_url},
        {'name': 'no_lr_param', 'url': base_url.split('?')[0]},  # 去除所有参数（会403）
    ]
    
    # 尝试修改lr参数
    if 'lr=' in base_url:
        lr_variations = [
            'video_gen_no_watermark',
            'video_gen_original',
            'origin',
            'raw',
            'clean',
            'nowatermark'
        ]
        
        for lr_val in lr_variations:
            import re
            new_url = re.sub(r'lr=[^&]+', f'lr={lr_val}', base_url)
            variations.append({
                'name': f'lr_{lr_val}',
                'url': new_url
            })
    
    results = []
    
    for var in variations:
        print(f"\n测试: {var['name']}")
        print(f"URL: {var['url'][:100]}...")
        
        try:
            # 先HEAD请求获取元数据
            head_response = requests.head(var['url'], timeout=10, allow_redirects=True)
            
            if head_response.status_code == 200:
                etag = head_response.headers.get('ETag', 'N/A')
                content_length = head_response.headers.get('Content-Length', 'N/A')
                content_type = head_response.headers.get('Content-Type', 'N/A')
                
                print(f"  ✅ 状态: {head_response.status_code}")
                print(f"  📦 ETag: {etag}")
                print(f"  📊 大小: {content_length} bytes")
                print(f"  📄 类型: {content_type}")
                
                # 下载前512KB用于快速MD5对比
                range_response = requests.get(
                    var['url'],
                    headers={'Range': 'bytes=0-524287'},
                    timeout=10
                )
                
                if range_response.status_code in [200, 206]:
                    partial_md5 = hashlib.md5(range_response.content).hexdigest()
                    print(f"  🔐 前512KB MD5: {partial_md5}")
                    
                    results.append({
                        'name': var['name'],
                        'url': var['url'],
                        'etag': etag,
                        'size': content_length,
                        'partial_md5': partial_md5,
                        'status': 'success'
                    })
                else:
                    print(f"  ⚠️ 无法下载部分内容: {range_response.status_code}")
            else:
                print(f"  ❌ 状态: {head_response.status_code}")
                results.append({
                    'name': var['name'],
                    'status': 'failed',
                    'code': head_response.status_code
                })
                
        except Exception as e:
            print(f"  ❌ 错误: {e}")
            results.append({
                'name': var['name'],
                'status': 'error',
                'error': str(e)
            })
    
    return results


def compare_results(results):
    """对比不同版本的结果"""
    print("\n\n" + "=" * 70)
    print("📊 步骤3: 对比分析结果")
    print("=" * 70)
    
    successful_results = [r for r in results if r.get('status') == 'success']
    
    if len(successful_results) == 0:
        print("\n❌ 没有成功下载的版本")
        return
    
    print(f"\n✅ 成功下载 {len(successful_results)} 个版本")
    
    # 按ETag分组
    etag_groups = {}
    for r in successful_results:
        etag = r.get('etag', 'N/A')
        if etag not in etag_groups:
            etag_groups[etag] = []
        etag_groups[etag].append(r)
    
    print(f"\n🔍 发现 {len(etag_groups)} 个不同的ETag组:")
    
    for i, (etag, group) in enumerate(etag_groups.items()):
        print(f"\n  组 {i+1}: ETag = {etag}")
        print(f"  包含 {len(group)} 个版本:")
        for r in group:
            print(f"    - {r['name']}")
            print(f"      MD5: {r['partial_md5']}")
            print(f"      大小: {r['size']}")
    
    # 判断
    if len(etag_groups) == 1:
        print("\n" + "=" * 70)
        print("⚠️ 重要结论:")
        print("=" * 70)
        print("所有不同参数的URL返回相同的ETag和MD5")
        print("这意味着CDN上只存储了一个文件版本")
        print("所有URL参数只是缓存key，不影响实际文件内容")
        print("❌ 无法通过URL参数获取不同版本")
    else:
        print("\n" + "=" * 70)
        print("🎉 重大发现!")
        print("=" * 70)
        print(f"发现了 {len(etag_groups)} 个不同的文件版本！")
        print("以下版本可能是无水印的:")
        
        for i, (etag, group) in enumerate(etag_groups.items()):
            if i > 0:  # 假设第一个是默认的带水印版本
                print(f"\n  可能的无水印版本 {i}:")
                for r in group:
                    print(f"    - {r['name']}")
                    print(f"      URL: {r['url'][:80]}...")


def analyze_with_opencv(video_path):
    """使用OpenCV分析视频帧，检测水印"""
    print("\n" + "=" * 70)
    print("🎥 步骤4: 使用OpenCV分析视频帧")
    print("=" * 70)
    
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("❌ 未安装OpenCV")
        print("\n安装方法:")
        print("  pip install opencv-python")
        return
    
    if not os.path.exists(video_path):
        print(f"❌ 视频文件不存在: {video_path}")
        return
    
    print(f"\n正在分析: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print("❌ 无法打开视频文件")
        return
    
    # 获取视频信息
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"\n视频信息:")
    print(f"  分辨率: {width}x{height}")
    print(f"  帧率: {fps} FPS")
    print(f"  总帧数: {total_frames}")
    print(f"  时长: {total_frames/fps:.2f} 秒")
    
    # 分析右下角区域（水印通常在这里）
    print("\n🔍 分析右下角区域（水印通常位置）...")
    
    # 采样几帧进行分析
    sample_frames = [0, total_frames//4, total_frames//2, 3*total_frames//4, total_frames-1]
    
    watermark_region_samples = []
    
    for frame_num in sample_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        
        if ret:
            # 提取右下角区域（假设水印在右下20%区域）
            h, w = frame.shape[:2]
            watermark_region = frame[int(h*0.8):, int(w*0.8):]
            
            # 计算该区域的统计特征
            mean_color = np.mean(watermark_region, axis=(0, 1))
            std_color = np.std(watermark_region, axis=(0, 1))
            
            watermark_region_samples.append({
                'frame': frame_num,
                'mean': mean_color,
                'std': std_color
            })
            
            print(f"\n  帧 {frame_num}:")
            print(f"    右下角平均颜色: {mean_color}")
            print(f"    右下角标准差: {std_color}")
    
    cap.release()
    
    # 检测水印一致性
    print("\n📊 水印区域一致性分析:")
    if len(watermark_region_samples) > 1:
        # 计算各帧右下角的差异
        mean_diff = []
        for i in range(1, len(watermark_region_samples)):
            diff = np.abs(watermark_region_samples[i]['mean'] - watermark_region_samples[0]['mean'])
            mean_diff.append(np.mean(diff))
        
        avg_diff = np.mean(mean_diff)
        print(f"  帧间差异: {avg_diff:.2f}")
        
        if avg_diff < 5:
            print("  ⚠️ 右下角区域在不同帧中几乎完全一致")
            print("  ✅ 这是水印的典型特征（静态覆盖层）")
            print("  ❌ 确认视频带有水印")
        else:
            print("  ✅ 右下角区域在不同帧中有显著变化")
            print("  ✅ 该区域是正常视频内容")
            print("  🎉 可能是无水印视频！")


def download_full_video(url, output_path):
    """下载完整视频文件"""
    print(f"\n正在下载完整视频到: {output_path}")
    
    try:
        response = requests.get(url, stream=True, timeout=30)
        total_size = int(response.headers.get('content-length', 0))
        
        with open(output_path, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # 显示进度
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r  进度: {percent:.1f}% ({downloaded}/{total_size})", end='')
        
        print(f"\n✅ 下载完成: {output_path}")
        return True
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        return False


def main():
    """主流程"""
    print("\n" + "=" * 70)
    print("豆包视频去水印 - 实际下载测试与水印检测")
    print("=" * 70)
    print(f"视频ID: {VIDEO_ID}")
    print("=" * 70)
    
    # 步骤1: 获取视频URL
    video_urls = get_video_url_from_api()
    
    if not video_urls:
        print("\n❌ 无法获取视频URL，退出")
        return
    
    # 使用第一个URL（通常是最高质量）
    base_url = video_urls[0]['url']
    
    # 分析URL结构
    analyze_url_structure(base_url)
    
    # 步骤2: 下载并对比不同参数版本
    results = download_video_with_variations(base_url)
    
    # 步骤3: 对比结果
    compare_results(results)
    
    # 步骤4: 如果已有下载的视频，使用OpenCV分析
    existing_video = f"/Users/hope/Desktop/个人作品集/{VIDEO_ID}-无水印.mp4"
    if os.path.exists(existing_video):
        print(f"\n发现已存在的视频文件: {existing_video}")
        analyze_with_opencv(existing_video)
    else:
        print(f"\n是否下载完整视频进行OpenCV分析? (需要 ~3MB)")
        print(f"输入 'y' 继续, 其他键跳过...")
        
        # 自动化模式：直接下载
        if True:  # 可以改为 input().lower() == 'y'
            print("正在下载...")
            output_path = f"/Users/hope/Desktop/个人作品集/{VIDEO_ID}-test.mp4"
            if download_full_video(base_url, output_path):
                analyze_with_opencv(output_path)
    
    print("\n\n" + "=" * 70)
    print("✅ 分析完成")
    print("=" * 70)


if __name__ == "__main__":
    main()
