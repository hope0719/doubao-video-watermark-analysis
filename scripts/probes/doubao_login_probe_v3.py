#!/usr/bin/env python3
"""
豆包登录态探针 v3 - 完整复现浏览器请求
重点: 用用户 Monitor JSON 里的完整参数调用 video/get_play_info
"""

import json, re, urllib.request, urllib.error
from datetime import datetime

# 从用户 Monitor JSON 提取的完整参数
FULL_QUERY = {
    "version_code": "20800",
    "language": "zh",
    "device_platform": "web",
    "aid": "497858",
    "real_aid": "497858",
    "pkg_type": "release_version",
    "device_id": "7640142873476285967",
    "pc_version": "3.25.3",
    "web_id": "7640152102799443482",
    "tea_uuid": "7640152102799443482",
    "region": "CN",
    "sys_region": "CN",
    "samantha_web": "1",
}

VIDEO_ID = "v0369cg10004d958scaljht7f13k4q80"

def load_cookies():
    with open("/Users/hope/Desktop/幻影空间/doubao_cookies.json") as f:
        cookies = json.load(f)
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)

def call(url, method, body, cookie_str, extra_headers=None):
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://www.doubao.com",
        "Referer": "https://www.doubao.com/",
        "Cookie": cookie_str,
    }
    if extra_headers:
        headers.update(extra_headers)
    
    qs = "&".join(f"{k}={v}" for k, v in FULL_QUERY.items())
    full_url = f"{url}?{qs}"
    
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(full_url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="ignore"), resp.status
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8", errors="ignore"), e.code
    except Exception as e:
        return str(e), -1

def analyze_response(body, label):
    print(f"\n=== {label} ===")
    try:
        resp = json.loads(body)
        code = resp.get("code", 0)
        msg = resp.get("msg", "")
        print(f"  code={code} msg={msg}")
        
        if code == 0:
            data = resp.get("data", {})
            
            # 检查 media_info / original_media_info
            if "media_info" in data:
                mi = data["media_info"]
                om = data.get("original_media_info", {})
                mi_url = mi[0].get("main_url", "") if mi else ""
                om_url = om.get("main_url", "") if om else ""
                print(f"  media_info URL 有 lr: {'lr=' in mi_url}")
                print(f"  original_media_info URL 有 lr: {'lr=' in om_url}")
                print(f"  两个 URL 相同: {mi_url == om_url}")
                if mi_url != om_url:
                    print(f"  [!!!] 两个 URL 不同！")
                    print(f"    media: {mi_url[:120]}")
                    print(f"    origin: {om_url[:120]}")
            
            # 检查 play_infos（video/get_play_info 的响应格式）
            if "play_infos" in data:
                pi = data["play_infos"]
                if pi:
                    main = pi[0].get("main", "")
                    print(f"  play_infos[0].main 有 lr: {'lr=' in main}")
                    print(f"    URL: {main[:150]}")
            
            # 打印完整响应（前2000字符）
            print(f"  响应体前 1500 字符:")
            print(f"  {body[:1500]}")
    except json.JSONDecodeError:
        print(f"  非 JSON 响应: {body[:500]}")

cookie_str = load_cookies()
print(f"[+] Cookie 加载成功")
print(f"[+] 使用视频 ID: {VIDEO_ID}")
print(f"[+] 使用完整查询参数: {len(FULL_QUERY)} 个")
print()

# 测试 1: video/get_play_info（复现用户浏览器请求）
print("--- 测试1: video/get_play_info（复现你的浏览器请求） ---")
body1, status1 = call(
    "https://www.doubao.com/samantha/video/get_play_info",
    "POST",
    {"vid": VIDEO_ID},
    cookie_str
)
print(f"  HTTP status: {status1}")
analyze_response(body1, "video/get_play_info")

# 测试 2: media/get_play_info（对比）
print("\n--- 测试2: media/get_play_info（对比） ---")
body2, status2 = call(
    "https://www.doubao.com/samantha/media/get_play_info",
    "POST",
    {"key": VIDEO_ID, "vid": VIDEO_ID},
    cookie_str
)
print(f"  HTTP status: {status2}")
analyze_response(body2, "media/get_play_info")

# 测试 3: 在请求体中加 lr=no_watermark
print("\n--- 测试3: video/get_play_info + 请求体加 lr=no_watermark ---")
body3, status3 = call(
    "https://www.doubao.com/samantha/video/get_play_info",
    "POST",
    {"vid": VIDEO_ID, "lr": "no_watermark", "watermark": False},
    cookie_str
)
print(f"  HTTP status: {status3}")
analyze_response(body3, "video/get_play_info + lr=no_watermark")

# 测试 4: share/get_video_share_info
print("\n--- 测试4: creativity/share/get_video_share_info ---")
body4, status4 = call(
    "https://www.doubao.com/creativity/share/get_video_share_info",
    "POST",
    {"share_id": "49141126666482178", "vid": VIDEO_ID},
    cookie_str
)
print(f"  HTTP status: {status4}")
analyze_response(body4, "share/get_video_share_info")

print("\n\n=== 所有测试完成 ===")
