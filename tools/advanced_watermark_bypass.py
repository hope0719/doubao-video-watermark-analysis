#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 高级绕过测试
测试所有可能的参数组合和API端点
"""

import requests
import json
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

def get_video_url():
    """获取基础视频URL"""
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
    
    try:
        response = requests.post(api_url, params=params, headers=headers, json={'key': VIDEO_ID}, timeout=10)
        data = response.json()
        
        if 'data' in data and 'original_media_info' in data['data']:
            return data['data']['original_media_info']['main_url']
    except:
        pass
    
    return None


def test_lr_parameter_variations(base_url):
    """测试lr参数的各种变体"""
    print("\n" + "="*70)
    print("🔍 测试1: lr参数变体")
    print("="*70)
    
    # 解析URL
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query)
    
    # lr参数的所有可能值
    lr_values = [
        'video_gen_watermark_dyn',      # 原始值
        'video_gen_no_watermark',       # 尝试1
        'video_gen_nowatermark',        # 尝试2
        'video_gen_watermark_none',     # 尝试3
        'video_gen_original',           # 尝试4
        'video_gen_clean',              # 尝试5
        'video_gen_raw',                # 尝试6
        'origin',                       # 尝试7
        'original',                     # 尝试8
        'raw',                          # 尝试9
        'clean',                        # 尝试10
        'nowatermark',                  # 尝试11
        'no_watermark',                 # 尝试12
        '',                             # 尝试13: 空值
    ]
    
    results = []
    
    for lr_val in lr_values:
        # 修改lr参数
        new_params = params.copy()
        new_params['lr'] = [lr_val] if lr_val else []
        
        # 重建URL
        new_query = urlencode(new_params, doseq=True)
        new_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', new_query, ''))
        
        print(f"\n测试 lr={lr_val if lr_val else '(空)'}")
        
        try:
            # HEAD请求获取元数据
            resp = requests.head(new_url, timeout=5, allow_redirects=True)
            
            if resp.status_code == 200:
                etag = resp.headers.get('ETag', 'N/A')
                size = resp.headers.get('Content-Length', 'N/A')
                
                print(f"  ✅ 状态: {resp.status_code}")
                print(f"  📦 ETag: {etag}")
                print(f"  📊 大小: {size}")
                
                results.append({
                    'lr': lr_val,
                    'status': 200,
                    'etag': etag,
                    'size': size
                })
            else:
                print(f"  ❌ 状态: {resp.status_code}")
                results.append({
                    'lr': lr_val,
                    'status': resp.status_code
                })
        except Exception as e:
            print(f"  ❌ 错误: {e}")
    
    # 分析结果
    print("\n" + "="*70)
    print("📊 lr参数测试结果分析")
    print("="*70)
    
    successful = [r for r in results if r.get('status') == 200]
    unique_etags = set([r['etag'] for r in successful if 'etag' in r])
    
    print(f"\n成功请求: {len(successful)}/{len(lr_values)}")
    print(f"不同的ETag数: {len(unique_etags)}")
    
    if len(unique_etags) == 1:
        print("\n❌ 所有lr参数返回相同的ETag")
        print("   结论: lr参数不影响实际文件内容")
    elif len(unique_etags) > 1:
        print("\n🎉 发现不同的ETag!")
        print("   以下lr参数可能返回不同的文件:")
        
        etag_map = {}
        for r in successful:
            if 'etag' in r:
                etag = r['etag']
                if etag not in etag_map:
                    etag_map[etag] = []
                etag_map[etag].append(r['lr'])
        
        for i, (etag, lr_list) in enumerate(etag_map.items()):
            print(f"\n  版本 {i+1} (ETag: {etag}):")
            for lr in lr_list:
                print(f"    - lr={lr}")


def test_api_parameter_variations():
    """测试API请求参数的变体"""
    print("\n\n" + "="*70)
    print("🔍 测试2: API请求参数变体")
    print("="*70)
    
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    # 不同的参数组合
    param_sets = [
        {
            'name': '默认Web参数',
            'params': {
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
            }
        },
        {
            'name': 'iOS参数',
            'params': {
                'version_code': '18.0.0',
                'device_platform': 'ios',
                'aid': '1128',
            }
        },
        {
            'name': 'Android参数',
            'params': {
                'version_code': '18.0.0',
                'device_platform': 'android',
                'aid': '1128',
            }
        },
        {
            'name': 'VIP标记',
            'params': {
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
                'vip': '1',
                'is_premium': 'true',
            }
        },
        {
            'name': '创作者模式',
            'params': {
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
                'creator_mode': '1',
                'is_owner': 'true',
            }
        },
        {
            'name': '导出模式',
            'params': {
                'version_code': '20800',
                'device_platform': 'web',
                'aid': '497858',
                'export': 'true',
                'download_type': 'original',
            }
        },
    ]
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    results = []
    
    for param_set in param_sets:
        print(f"\n测试: {param_set['name']}")
        
        try:
            response = requests.post(
                api_url,
                params=param_set['params'],
                headers=headers,
                json={'key': VIDEO_ID},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'original_media_info' in data['data']:
                    video_url = data['data']['original_media_info']['main_url']
                    
                    # 提取lr参数
                    lr_match = re.search(r'lr=([^&]+)', video_url)
                    lr_value = lr_match.group(1) if lr_match else 'N/A'
                    
                    # 获取ETag
                    head_resp = requests.head(video_url, timeout=5)
                    etag = head_resp.headers.get('ETag', 'N/A')
                    
                    print(f"  ✅ 状态: {response.status_code}")
                    print(f"  📄 lr参数: {lr_value}")
                    print(f"  📦 ETag: {etag}")
                    print(f"  🔗 URL: {video_url[:100]}...")
                    
                    results.append({
                        'name': param_set['name'],
                        'lr': lr_value,
                        'etag': etag,
                        'url': video_url
                    })
                else:
                    print(f"  ⚠️ 响应中没有视频URL")
            else:
                print(f"  ❌ 状态: {response.status_code}")
        
        except Exception as e:
            print(f"  ❌ 错误: {e}")
    
    # 分析结果
    print("\n" + "="*70)
    print("📊 API参数测试结果分析")
    print("="*70)
    
    unique_lr = set([r['lr'] for r in results])
    unique_etag = set([r['etag'] for r in results])
    
    print(f"\n不同的lr参数值: {len(unique_lr)}")
    for lr in unique_lr:
        print(f"  - {lr}")
    
    print(f"\n不同的ETag值: {len(unique_etag)}")
    for etag in unique_etag:
        print(f"  - {etag}")
    
    if len(unique_etag) == 1:
        print("\n❌ 所有API参数组合返回相同的文件")
    else:
        print("\n🎉 发现不同的文件版本!")


def test_hidden_api_fields():
    """测试API请求体中的隐藏字段"""
    print("\n\n" + "="*70)
    print("🔍 测试3: API请求体隐藏字段")
    print("="*70)
    
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    params = {
        'version_code': '20800',
        'device_platform': 'web',
        'aid': '497858',
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    # 尝试不同的请求体字段
    body_variations = [
        {'key': VIDEO_ID},  # 基础
        {'key': VIDEO_ID, 'watermark': False},
        {'key': VIDEO_ID, 'remove_watermark': True},
        {'key': VIDEO_ID, 'no_watermark': True},
        {'key': VIDEO_ID, 'quality': 'original'},
        {'key': VIDEO_ID, 'export_mode': True},
        {'key': VIDEO_ID, 'creator_download': True},
        {'key': VIDEO_ID, 'type': 'raw'},
        {'key': VIDEO_ID, 'version': 'clean'},
        {'video_id': VIDEO_ID, 'watermark': 0},
        {'video_id': VIDEO_ID, 'quality': 'origin', 'clean': 1},
    ]
    
    results = []
    
    for i, body in enumerate(body_variations):
        print(f"\n测试 {i+1}: {body}")
        
        try:
            response = requests.post(
                api_url,
                params=params,
                headers=headers,
                json=body,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'data' in data and 'original_media_info' in data['data']:
                    video_url = data['data']['original_media_info']['main_url']
                    
                    # 提取lr参数
                    lr_match = re.search(r'lr=([^&]+)', video_url)
                    lr_value = lr_match.group(1) if lr_match else 'N/A'
                    
                    # 获取ETag
                    head_resp = requests.head(video_url, timeout=5)
                    etag = head_resp.headers.get('ETag', 'N/A')
                    
                    print(f"  ✅ 获得视频URL")
                    print(f"  📄 lr参数: {lr_value}")
                    print(f"  📦 ETag: {etag}")
                    
                    results.append({
                        'body': str(body),
                        'lr': lr_value,
                        'etag': etag
                    })
                else:
                    print(f"  ⚠️ 没有视频URL (可能字段名不对)")
            else:
                print(f"  ❌ 状态: {response.status_code}")
                print(f"     {response.text[:100]}")
        
        except Exception as e:
            print(f"  ❌ 错误: {e}")
    
    # 分析
    print("\n" + "="*70)
    print("📊 请求体字段测试结果")
    print("="*70)
    
    unique_etag = set([r['etag'] for r in results])
    print(f"\n成功请求: {len(results)}/{len(body_variations)}")
    print(f"不同的ETag数: {len(unique_etag)}")
    
    if len(unique_etag) == 1:
        print("\n❌ 所有请求体变体返回相同的文件")
    else:
        print("\n🎉 发现不同的文件!")


def test_url_path_variations(base_url):
    """测试CDN URL路径的变体"""
    print("\n\n" + "="*70)
    print("🔍 测试4: CDN URL路径变体")
    print("="*70)
    
    parsed = urlparse(base_url)
    
    # 尝试修改路径
    path_variations = [
        parsed.path,  # 原始
        parsed.path.replace('/video/', '/video_raw/'),
        parsed.path.replace('/video/', '/video_original/'),
        parsed.path.replace('/video/', '/video_clean/'),
        parsed.path.replace('/tos/', '/tos_raw/'),
    ]
    
    params = parse_qs(parsed.query)
    
    for i, path in enumerate(path_variations):
        print(f"\n测试路径 {i+1}: {path[:80]}...")
        
        new_query = urlencode(params, doseq=True)
        new_url = urlunparse((parsed.scheme, parsed.netloc, path, '', new_query, ''))
        
        try:
            resp = requests.head(new_url, timeout=5)
            print(f"  状态: {resp.status_code}")
            
            if resp.status_code == 200:
                print(f"  ETag: {resp.headers.get('ETag', 'N/A')}")
        except Exception as e:
            print(f"  错误: {e}")


def main():
    """主函数"""
    print("="*70)
    print("豆包视频去水印 - 高级绕过测试")
    print("="*70)
    print(f"视频ID: {VIDEO_ID}")
    print("="*70)
    
    # 获取基础视频URL
    print("\n正在获取视频URL...")
    base_url = get_video_url()
    
    if not base_url:
        print("❌ 无法获取视频URL")
        return
    
    print(f"✅ 获取成功")
    print(f"URL: {base_url[:100]}...")
    
    # 运行所有测试
    test_lr_parameter_variations(base_url)
    test_api_parameter_variations()
    test_hidden_api_fields()
    test_url_path_variations(base_url)
    
    print("\n\n" + "="*70)
    print("✅ 所有测试完成")
    print("="*70)
    print("\n如果所有测试都返回相同的ETag，则证明:")
    print("1. 水印是在服务端编码时嵌入的")
    print("2. CDN只存储一个版本")
    print("3. 所有参数只是标记，不影响实际内容")
    print("4. 客户端无法获取无水印版本")


if __name__ == "__main__":
    main()
