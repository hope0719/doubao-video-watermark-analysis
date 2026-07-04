#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 深入对比N/A ETag的文件
重点：实际下载并对比那些返回N/A ETag的文件
"""

import requests
import hashlib
import os

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

def get_video_urls_with_different_params():
    """获取使用不同参数的视频URL"""
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    base_params = {
        'version_code': '20800',
        'device_platform': 'web',
        'aid': '497858',
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    # 测试不同的请求体
    test_cases = [
        {
            'name': '默认请求',
            'body': {'key': VIDEO_ID}
        },
        {
            'name': '添加watermark=False',
            'body': {'key': VIDEO_ID, 'watermark': False}
        },
        {
            'name': '添加creator_download=True',
            'body': {'key': VIDEO_ID, 'creator_download': True}
        },
        {
            'name': '添加version=clean',
            'body': {'key': VIDEO_ID, 'version': 'clean'}
        },
    ]
    
    results = []
    
    for test in test_cases:
        print(f"\n获取URL: {test['name']}")
        try:
            response = requests.post(
                api_url,
                params=base_params,
                headers=headers,
                json=test['body'],
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and 'original_media_info' in data['data']:
                    url = data['data']['original_media_info']['main_url']
                    print(f"  ✅ 获取成功")
                    print(f"     {url[:80]}...")
                    
                    results.append({
                        'name': test['name'],
                        'url': url
                    })
        except Exception as e:
            print(f"  ❌ 错误: {e}")
    
    return results


def download_and_compare_files(url_list):
    """下载文件并进行详细对比"""
    print("\n" + "="*70)
    print("📥 下载并对比文件")
    print("="*70)
    
    files = []
    
    for item in url_list:
        filename = f"/Users/hope/Desktop/个人作品集/test_{item['name'].replace(' ', '_')}.mp4"
        
        print(f"\n下载: {item['name']}")
        print(f"目标: {filename}")
        
        try:
            # 下载文件
            response = requests.get(item['url'], stream=True, timeout=30)
            total_size = int(response.headers.get('content-length', 0))
            etag = response.headers.get('ETag', 'N/A')
            
            print(f"  文件大小: {total_size} bytes")
            print(f"  ETag: {etag}")
            
            # 保存文件
            with open(filename, 'wb') as f:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                
                print(f"  ✅ 下载完成: {downloaded} bytes")
            
            # 计算MD5
            md5_hash = hashlib.md5()
            with open(filename, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    md5_hash.update(chunk)
            
            md5 = md5_hash.hexdigest()
            print(f"  🔐 MD5: {md5}")
            
            # 计算SHA256以更准确对比
            sha256_hash = hashlib.sha256()
            with open(filename, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            
            sha256 = sha256_hash.hexdigest()
            print(f"  🔐 SHA256: {sha256}")
            
            files.append({
                'name': item['name'],
                'filename': filename,
                'size': os.path.getsize(filename),
                'etag': etag,
                'md5': md5,
                'sha256': sha256
            })
            
        except Exception as e:
            print(f"  ❌ 错误: {e}")
    
    return files


def analyze_file_differences(files):
    """分析文件差异"""
    print("\n\n" + "="*70)
    print("📊 文件对比分析")
    print("="*70)
    
    if len(files) < 2:
        print("\n❌ 文件数量不足，无法对比")
        return
    
    # 按MD5分组
    md5_groups = {}
    for f in files:
        md5 = f['md5']
        if md5 not in md5_groups:
            md5_groups[md5] = []
        md5_groups[md5].append(f)
    
    print(f"\n发现 {len(md5_groups)} 个不同的MD5组:")
    
    for i, (md5, group) in enumerate(md5_groups.items()):
        print(f"\n组 {i+1}: MD5 = {md5}")
        print(f"  SHA256: {group[0]['sha256']}")
        print(f"  文件大小: {group[0]['size']} bytes")
        print(f"  包含以下版本:")
        for f in group:
            print(f"    - {f['name']}")
            print(f"      ETag: {f['etag']}")
    
    # 判断结果
    if len(md5_groups) == 1:
        print("\n" + "="*70)
        print("❌ 关键结论")
        print("="*70)
        print("所有不同参数下载的文件完全相同（MD5和SHA256一致）")
        print("这证明:")
        print("  1. 所有URL参数和请求体字段都不影响实际文件内容")
        print("  2. CDN只存储一个文件版本")
        print("  3. ETag为N/A只是HTTP响应头的差异，不代表文件不同")
        print("  4. 水印是在服务端编码时永久嵌入的")
        print("  5. ❌ 客户端无法获取无水印版本")
    else:
        print("\n" + "="*70)
        print("🎉 重大发现！")
        print("="*70)
        print(f"发现了 {len(md5_groups)} 个不同的文件版本！")
        print("这意味着某些参数确实能获取不同的文件")
        print("\n对比各组，可能的无水印版本:")
        
        # 比较文件大小，通常无水印版本可能更小或更大
        sizes = [(md5, group[0]['size']) for md5, group in md5_groups.items()]
        sizes.sort(key=lambda x: x[1])
        
        print(f"\n按文件大小排序:")
        for md5, size in sizes:
            group = md5_groups[md5]
            print(f"  {size} bytes - {group[0]['name']}")


def compare_video_frames(file1, file2):
    """使用OpenCV对比两个视频的帧"""
    print("\n\n" + "="*70)
    print("🎥 视频帧级别对比")
    print("="*70)
    
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("❌ 未安装OpenCV，跳过帧对比")
        print("   安装: pip install opencv-python")
        return
    
    print(f"\n对比文件:")
    print(f"  文件1: {file1}")
    print(f"  文件2: {file2}")
    
    cap1 = cv2.VideoCapture(file1)
    cap2 = cv2.VideoCapture(file2)
    
    if not cap1.isOpened() or not cap2.isOpened():
        print("❌ 无法打开视频文件")
        return
    
    # 获取视频信息
    fps1 = cap1.get(cv2.CAP_PROP_FPS)
    fps2 = cap2.get(cv2.CAP_PROP_FPS)
    frame_count1 = int(cap1.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_count2 = int(cap2.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"\n文件1: {fps1} FPS, {frame_count1} 帧")
    print(f"文件2: {fps2} FPS, {frame_count2} 帧")
    
    if fps1 != fps2 or frame_count1 != frame_count2:
        print("\n⚠️ 视频元数据不同！")
        print("   这可能表示它们是不同的编码版本")
    
    # 对比前10帧
    print("\n对比前10帧...")
    differences = []
    
    for i in range(min(10, frame_count1, frame_count2)):
        ret1, frame1 = cap1.read()
        ret2, frame2 = cap2.read()
        
        if ret1 and ret2:
            # 计算帧差异
            if frame1.shape == frame2.shape:
                diff = cv2.absdiff(frame1, frame2)
                diff_percentage = (np.sum(diff) / (frame1.shape[0] * frame1.shape[1] * frame1.shape[2] * 255)) * 100
                differences.append(diff_percentage)
                
                print(f"  帧 {i}: 差异 {diff_percentage:.4f}%")
            else:
                print(f"  帧 {i}: 分辨率不同")
        else:
            break
    
    cap1.release()
    cap2.release()
    
    if differences:
        avg_diff = np.mean(differences)
        print(f"\n平均帧差异: {avg_diff:.4f}%")
        
        if avg_diff < 0.01:
            print("✅ 视频几乎完全相同（差异 < 0.01%）")
            print("   可能只是编码参数略有不同")
        elif avg_diff < 1:
            print("⚠️ 视频有轻微差异（差异 < 1%）")
            print("   可能是压缩率或画质参数不同")
        else:
            print("🎉 视频有显著差异！")
            print("   这可能是不同的内容版本（如有无水印）")


def main():
    """主函数"""
    print("="*70)
    print("豆包视频去水印 - 深入对比N/A ETag的文件")
    print("="*70)
    print(f"视频ID: {VIDEO_ID}")
    print("="*70)
    
    # 步骤1: 获取不同参数的视频URL
    print("\n步骤1: 获取不同参数的视频URL")
    url_list = get_video_urls_with_different_params()
    
    if len(url_list) < 2:
        print("\n❌ 无法获取足够的URL进行对比")
        return
    
    print(f"\n✅ 获取了 {len(url_list)} 个URL")
    
    # 步骤2: 下载并对比
    files = download_and_compare_files(url_list)
    
    # 步骤3: 分析差异
    analyze_file_differences(files)
    
    # 步骤4: 如果有两个以上文件，进行帧级别对比
    if len(files) >= 2:
        compare_video_frames(files[0]['filename'], files[1]['filename'])
    
    print("\n\n" + "="*70)
    print("✅ 所有分析完成")
    print("="*70)


if __name__ == "__main__":
    main()
