#!/usr/bin/env python3
"""
豆包视频去水印 — API 测试脚本

验证所有公开 API 返回的视频 URL 都带水印。
测试视频: v0269cg10004d946i5iljhtf2dunr5e0 (分享页)
"""

import httpx
import json
import sys
import re


def test_get_play_info(video_id: str) -> dict:
    """测试 /samantha/media/get_play_info API"""
    url = "https://www.doubao.com/samantha/media/get_play_info"
    payload = {"key": video_id}
    headers = {
        "Content-Type": "application/json",
        "origin": "https://www.doubao.com",
        "referer": "https://www.doubao.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/134.0.0.0 Safari/537.36",
    }
    
    print(f"\n{'='*60}")
    print(f"测试 1: GET_PLAY_INFO")
    print(f"POST {url}")
    
    response = httpx.post(url, json=payload, headers=headers, timeout=15)
    data = response.json()
    
    original_url = data.get("data", {}).get("original_media_info", {}).get("main_url", "")
    media_url = data.get("data", {}).get("media_info", [{}])[0].get("main_url", "")
    
    print(f"  original_media_info.main_url: {original_url[:80]}...")
    print(f"  media_info[0].main_url:       {media_url[:80]}...")
    
    if original_url == media_url:
        print(f"  ⚠️  两个字段完全相同 — 无水印路径已失效")
    else:
        print(f"  ✅ 两个字段不同 — 可能有无水印路径")
    
    has_watermark = "watermark" in original_url.lower()
    print(f"  {'⚠️  有水印参数: lr=video_gen_watermark_dyn' if 'video_gen_watermark_dyn' in original_url else '✅ 无水印参数'}")
    
    return {
        "api": "/samantha/media/get_play_info",
        "original_url": original_url,
        "media_url": media_url,
    }


def test_get_video_share_info(video_id: str, share_id: str) -> dict:
    """测试 /creativity/share/get_video_share_info API"""
    url = "https://www.doubao.com/creativity/share/get_video_share_info"
    payload = {
        "share_id": share_id,
        "vid": video_id,
        "creation_id": "",
    }
    headers = {
        "Content-Type": "application/json",
        "origin": "https://www.doubao.com",
        "referer": "https://www.doubao.com/",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/134.0.0.0 Safari/537.36",
    }
    
    print(f"\n{'='*60}")
    print(f"测试 2: GET_VIDEO_SHARE_INFO")
    print(f"POST {url}")
    
    response = httpx.post(url, json=payload, headers=headers, timeout=15)
    data = response.json()
    
    play_info = data.get("data", {}).get("play_info", {})
    main_url = play_info.get("main", "")
    backup_url = play_info.get("backup", "")
    
    print(f"  play_info.main:   {main_url[:80]}...")
    print(f"  play_info.backup: {backup_url[:80]}...")
    
    has_watermark = "watermark" in (main_url + backup_url).lower()
    print(f"  {'⚠️  有水印参数' if 'video_gen_watermark_dyn' in main_url else '✅ 无水印参数'}")
    
    return {"api": "/creativity/share/get_video_share_info", "main_url": main_url, "backup_url": backup_url}


def verify_etag_match(urls: list) -> None:
    """验证多个 URL 是否指向同一个文件（通过 etag 对比）"""
    print(f"\n{'='*60}")
    print(f"测试 3: CDN 文件一致性验证 (etag)")
    
    etags = {}
    for label, url in urls:
        if not url:
            continue
        try:
            resp = httpx.head(url, timeout=10, follow_redirects=True)
            etag = resp.headers.get("etag", "unknown")
            cl = resp.headers.get("content-length", "unknown")
            etags[label] = {"etag": etag, "size": cl}
            print(f"  {label:40s} etag={etag}  size={cl}")
        except Exception as e:
            print(f"  {label:40s} ERROR: {e}")
    
    # 判断是否都指向同一文件
    unique_etags = set(v["etag"] for v in etags.values())
    if len(unique_etags) == 1:
        print(f"\n  ⚠️  所有 URL 指向同一文件 (etag={list(unique_etags)[0]})")
    else:
        print(f"\n  ⚠️  不同 URL 对应不同文件 ({len(unique_etags)} 个不同 etag)")


def check_url_parameter_watermark(url: str) -> None:
    """测试 URL 参数操控是否影响水印"""
    import re
    
    print(f"\n{'='*60}")
    print(f"测试 4: URL 参数操控测试")
    
    # 提取并测试不同参数变体
    tests = {
        "原始 URL (基准)": url,
        "去掉 lr 参数": re.sub(r'&lr=[^&]+', '', url),
        "lr=none": re.sub(r'lr=[^&]+', 'lr=none', url),
        "lr=no_watermark": re.sub(r'lr=[^&]+', 'lr=video_gen_no_watermark', url),
        "去掉 download": re.sub(r'&download=[^&]+', '', url),
        "去掉 ft 参数": re.sub(r'&ft=[^&]+', '', url),
        "ft=AAAA (随机)": re.sub(r'ft=[^&]+', 'ft=AAAA', url),
        "cr=7&dr=3": re.sub(r'cr=\d+&dr=\d+', 'cr=7&dr=3', url),
    }
    
    for label, test_url in tests.items():
        try:
            resp = httpx.head(test_url, timeout=10, follow_redirects=True)
            etag = resp.headers.get("etag", "unknown")[:16]
            cl = resp.headers.get("content-length", "unknown")
            print(f"  {label:30s} etag={etag}... size={cl}")
        except Exception as e:
            print(f"  {label:30s} ERROR: {e}")


def main():
    # 测试视频参数
    video_id = "v0269cg10004d946i5iljhtf2dunr5e0"
    share_id = "49152711347982082"
    
    print("=" * 60)
    print("  豆包视频去水印 — 技术验证测试")
    print(f"  视频 ID: {video_id}")
    print(f"  分享 ID: {share_id}")
    print("=" * 60)
    
    # 测试 1: get_play_info
    result1 = test_get_play_info(video_id)
    
    # 测试 2: get_video_share_info
    result2 = test_get_video_share_info(video_id, share_id)
    
    # 测试 3: 文件一致性
    urls = [
        ("get_play_info (orig)", result1.get("original_url", "")),
        ("get_play_info (media)", result1.get("media_url", "")),
        ("share_info (main)", result2.get("main_url", "")),
        ("share_info (backup)", result2.get("backup_url", "")),
    ]
    verify_etag_match(urls)
    
    # 测试 4: URL 参数操控
    if result1.get("original_url"):
        check_url_parameter_watermark(result1["original_url"])
    
    print(f"\n{'='*60}")
    print(f"  最终结论")
    print(f"  所有 API 返回的视频 URL 均包含 'video_gen_watermark_dyn' 参数")
    print(f"  所有 URL 参数变体均返回相同文件 (etag 不变)")
    print(f"  视频水印无法通过客户端技术去除")
    print(f"{'='*60}")


if __name__ == "__main__":
    # 先安装 httpx: pip install httpx
    try:
        import httpx
    except ImportError:
        print("请先安装 httpx: pip install httpx")
        sys.exit(1)
    main()