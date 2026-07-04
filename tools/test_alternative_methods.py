#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 探索其他可能的方向
测试日期：2026-07-04
"""

import requests
import json
import re

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"
SHARE_URL = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"

# 方向1: 测试需要登录态的API（可能VIP用户有无水印权限）
def test_authenticated_apis():
    """测试需要登录态的API端点"""
    print("\n=== 测试1: 登录态API（需要用户提供Cookie）===")
    
    # 这些API可能需要登录态才能访问
    endpoints = [
        {
            "url": "https://www.doubao.com/samantha/user/get_video_download_url",
            "method": "POST",
            "body": {"video_id": VIDEO_ID, "quality": "origin"}
        },
        {
            "url": "https://www.doubao.com/samantha/creativity/download_video",
            "method": "POST", 
            "body": {"video_id": VIDEO_ID, "watermark": False}
        },
        {
            "url": "https://www.doubao.com/api/video/export",
            "method": "POST",
            "body": {"video_id": VIDEO_ID, "remove_watermark": True}
        }
    ]
    
    for ep in endpoints:
        print(f"\n测试: {ep['url']}")
        try:
            resp = requests.post(
                ep['url'],
                json=ep['body'],
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Referer": "https://www.doubao.com/",
                    # 注意：需要用户提供真实Cookie才能测试
                    # "Cookie": "请在这里填入真实Cookie"
                },
                timeout=10
            )
            print(f"  状态码: {resp.status_code}")
            print(f"  响应: {resp.text[:200]}")
        except Exception as e:
            print(f"  错误: {e}")


# 方向2: 测试GraphQL接口（可能有特殊字段控制水印）
def test_graphql_api():
    """测试GraphQL接口"""
    print("\n\n=== 测试2: GraphQL接口 ===")
    
    queries = [
        # 查询1: 尝试获取无水印URL字段
        {
            "query": """
                query GetVideo($videoId: String!) {
                    video(id: $videoId) {
                        id
                        playUrl
                        playUrlNoWatermark
                        originalUrl
                        downloadUrl
                        rawVideoUrl
                    }
                }
            """,
            "variables": {"videoId": VIDEO_ID}
        },
        # 查询2: 尝试传递参数控制水印
        {
            "query": """
                query GetVideoUrl($videoId: String!, $removeWatermark: Boolean) {
                    getVideoPlayInfo(videoId: $videoId, removeWatermark: $removeWatermark) {
                        url
                    }
                }
            """,
            "variables": {"videoId": VIDEO_ID, "removeWatermark": True}
        }
    ]
    
    for i, q in enumerate(queries):
        print(f"\n查询 {i+1}:")
        try:
            resp = requests.post(
                "https://www.doubao.com/graphql",
                json=q,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                },
                timeout=10
            )
            print(f"  状态码: {resp.status_code}")
            if resp.status_code == 200:
                print(f"  响应: {json.dumps(resp.json(), indent=2, ensure_ascii=False)[:500]}")
            else:
                print(f"  响应: {resp.text[:200]}")
        except Exception as e:
            print(f"  错误: {e}")


# 方向3: 测试分享链接是否有特殊参数可以获取无水印
def test_share_link_params():
    """测试分享链接的特殊参数"""
    print("\n\n=== 测试3: 分享链接特殊参数 ===")
    
    # 可能的参数组合
    param_combinations = [
        {"no_watermark": "1"},
        {"watermark": "0"},
        {"quality": "origin"},
        {"download": "nowatermark"},
        {"export": "clean"},
        {"raw": "true"},
        {"original": "1"},
        {"creator_view": "1"},  # 创作者视角
        {"owner": "1"},         # 所有者模式
        {"preview": "raw"},     # 预览原始版本
    ]
    
    for params in param_combinations:
        print(f"\n测试参数: {params}")
        try:
            resp = requests.get(
                SHARE_URL,
                params=params,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                },
                timeout=10,
                allow_redirects=True
            )
            print(f"  状态码: {resp.status_code}")
            print(f"  最终URL: {resp.url}")
            
            # 检查响应中是否有新的视频URL
            video_urls = re.findall(r'https://[^"\']+\.mp4[^"\']*', resp.text)
            if video_urls:
                print(f"  发现视频URL: {video_urls[0][:100]}...")
        except Exception as e:
            print(f"  错误: {e}")


# 方向4: 测试内部创作者API（可能创作者自己可以下载无水印版本）
def test_creator_apis():
    """测试创作者相关API"""
    print("\n\n=== 测试4: 创作者API ===")
    
    endpoints = [
        "https://www.doubao.com/samantha/creation/get_my_video",
        "https://www.doubao.com/samantha/creation/export_video", 
        "https://www.doubao.com/samantha/workspace/get_video_assets",
        "https://www.doubao.com/api/creator/video/download",
    ]
    
    for url in endpoints:
        print(f"\n测试: {url}")
        try:
            resp = requests.post(
                url,
                json={"video_id": VIDEO_ID},
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    # 注意：需要用户提供真实Cookie
                },
                timeout=10
            )
            print(f"  状态码: {resp.status_code}")
            print(f"  响应: {resp.text[:200]}")
        except Exception as e:
            print(f"  错误: {e}")


# 方向5: 分析页面HTML中可能的隐藏URL
def test_page_html_analysis():
    """分析页面HTML中的隐藏数据"""
    print("\n\n=== 测试5: 页面HTML分析 ===")
    
    try:
        resp = requests.get(
            SHARE_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=10
        )
        
        print(f"状态码: {resp.status_code}")
        html = resp.text
        
        # 1. 查找所有可能的视频URL模式
        patterns = [
            r'"videoUrl[^"]*":\s*"([^"]+)"',
            r'"playUrl[^"]*":\s*"([^"]+)"',
            r'"downloadUrl[^"]*":\s*"([^"]+)"',
            r'"originalUrl[^"]*":\s*"([^"]+)"',
            r'"rawUrl[^"]*":\s*"([^"]+)"',
            r'"url[^"]*":\s*"(https://[^"]+\.mp4[^"]*)"',
        ]
        
        found_urls = set()
        for pattern in patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                found_urls.add(match)
        
        print(f"\n发现 {len(found_urls)} 个可能的视频URL:")
        for url in found_urls:
            print(f"  - {url[:100]}...")
            
            # 检查URL中的lr参数
            if 'lr=' in url:
                lr_value = re.search(r'lr=([^&"]+)', url)
                if lr_value:
                    print(f"    lr参数: {lr_value.group(1)}")
        
        # 2. 查找__NEXT_DATA__或类似的数据注入
        next_data_match = re.search(r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, re.DOTALL)
        if next_data_match:
            print("\n发现 __NEXT_DATA__:")
            try:
                data = json.loads(next_data_match.group(1))
                print(json.dumps(data, indent=2, ensure_ascii=False)[:1000])
            except:
                print("  无法解析JSON")
        
        # 3. 查找window.初始化数据
        window_data_matches = re.findall(r'window\.__[A-Z_]+__\s*=\s*({[^;]+});', html)
        if window_data_matches:
            print(f"\n发现 {len(window_data_matches)} 个window初始化数据")
            for i, match in enumerate(window_data_matches[:3]):
                print(f"\n  数据 {i+1}: {match[:200]}...")
                
    except Exception as e:
        print(f"错误: {e}")


# 方向6: 测试视频生成时的临时URL（可能在生成完成前无水印）
def test_generation_status_api():
    """测试视频生成状态API"""
    print("\n\n=== 测试6: 视频生成状态API ===")
    
    endpoints = [
        "https://www.doubao.com/samantha/creation/get_generation_status",
        "https://www.doubao.com/samantha/task/get_task_result",
        "https://www.doubao.com/api/video/get_processing_info",
    ]
    
    for url in endpoints:
        print(f"\n测试: {url}")
        try:
            resp = requests.post(
                url,
                json={"video_id": VIDEO_ID},
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                },
                timeout=10
            )
            print(f"  状态码: {resp.status_code}")
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    print(f"  响应: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
                except:
                    print(f"  响应: {resp.text[:200]}")
        except Exception as e:
            print(f"  错误: {e}")


if __name__ == "__main__":
    print("豆包视频去水印 - 探索其他方向")
    print("=" * 60)
    print(f"目标视频ID: {VIDEO_ID}")
    print(f"分享链接: {SHARE_URL}")
    print("=" * 60)
    
    # 运行所有测试
    test_authenticated_apis()
    test_graphql_api()
    test_share_link_params()
    test_creator_apis()
    test_page_html_analysis()
    test_generation_status_api()
    
    print("\n\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print("\n说明:")
    print("1. 登录态API需要用户提供真实的Cookie才能测试")
    print("2. 如果用户是视频创作者本人，可能有特殊权限")
    print("3. 某些API可能只在特定场景下可用（如VIP用户）")
    print("4. 建议在浏览器DevTools中手动抓包对比")
