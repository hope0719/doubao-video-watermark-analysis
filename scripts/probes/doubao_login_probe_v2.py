#!/usr/bin/env python3
"""
豆包登录态探针 v2 - 保存完整响应体
"""
import json, re, urllib.request, urllib.error
from datetime import datetime

VIDEO_ID = "v0369cg10004d958scaljht7f13k4q80"  # 从用户 Monitor JSON 中提取的真实视频ID
SHARE_ID = "49141126666482178"

ENDPOINTS = [
    ("media_get_play_info", "POST", "https://www.doubao.com/samantha/media/get_play_info"),
    ("video_get_play_info", "POST", "https://www.doubao.com/samantha/video/get_play_info"),
    ("query_video_gen_info", "POST", "https://www.doubao.com/samantha/video/query_video_gen_info"),
    ("share_get_video_share_info", "POST", "https://www.doubao.com/creativity/share/get_video_share_info"),
    ("mget_play_status", "POST", "https://www.doubao.com/samantha/media/mget_play_status"),
    ("watermark_task", "POST", "https://www.doubao.com/alice/resource/watermark_task"),
    ("watermark_download", "POST", "https://www.doubao.com/alice/resource/watermark_download"),
]

VARIANTS = {
    "default": {"version_code": "20800", "language": "zh", "device_platform": "web", "aid": "497858"},
    "old_vc": {"version_code": "12000", "language": "zh", "device_platform": "web", "aid": "497858"},
    "no_aid": {"version_code": "20800", "language": "zh", "device_platform": "web"},
}

BODIES = {
    "media_get_play_info": lambda: {"key": VIDEO_ID, "vid": VIDEO_ID},
    "video_get_play_info": lambda: {"vid": VIDEO_ID},
    "query_video_gen_info": lambda: {"video_id": VIDEO_ID},
    "share_get_video_share_info": lambda: {"share_id": SHARE_ID, "vid": VIDEO_ID},
    "mget_play_status": lambda: {"vid": VIDEO_ID},
    "watermark_task": lambda: {"video_id": VIDEO_ID, "url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"},
    "watermark_download": lambda: {"video_id": VIDEO_ID},
}

def load_cookies():
    with open("/Users/hope/Desktop/幻影空间/doubao_cookies.json") as f:
        cookies = json.load(f)
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)

def call(ep_url, method, body, query, cookie_str):
    qs = "&".join(f"{k}={v}" for k, v in query.items())
    url = f"{ep_url}?{qs}" if "?" not in ep_url else f"{ep_url}&{qs}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://www.doubao.com",
        "Referer": "https://www.doubao.com/",
        "Cookie": cookie_str,
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="ignore"), resp.status
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8", errors="ignore"), e.code
    except Exception as e:
        return str(e), -1

def extract_lr(body):
    return list(set(re.findall(r'"lr"\s*:\s*"([^"]+)"', body))) or \
           list(set(re.findall(r'[?&]lr=([^&\s"\'\\\\]+)', body)))

def extract_video_urls(body):
    return list(set(re.findall(r'https?://[^\s"\'\\\\<>]+?(?:\.mp4|\.m3u8)[^\s"\'\\\\<>]*', body)))

cookie_str = load_cookies()
print(f"[+] Cookie 加载成功，长度: {len(cookie_str)}")
print(f"[+] 使用视频 ID: {VIDEO_ID}")
print()

results = []
for ep_name, method, ep_url in ENDPOINTS:
    for var_name, query in VARIANTS.items():
        body = BODIES.get(ep_name, lambda: {})()
        full_body, status = call(ep_url, method, body, query, cookie_str)
        
        lr_vals = extract_lr(full_body)
        video_urls = extract_video_urls(full_body)
        
        # 保存完整响应（限制长度）
        save_body = full_body[:5000] if full_body else ""
        
        print(f"  [{status}] {ep_name:35s} {var_name:15s} lr={lr_vals} urls={len(video_urls)}")
        
        if video_urls:
            for u in video_urls[:2]:
                print(f"         URL: {u[:120]}")
        
        results.append({
            "endpoint": ep_name,
            "variant": var_name,
            "status": status,
            "lr_values": lr_vals,
            "video_urls": video_urls,
            "response_body": save_body,
        })

out = f"/Users/hope/Desktop/幻影空间/doubao_login_v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(out, "w") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\n[+] 完整结果保存到: {out}")

# 汇总
print("\n=== 汇总 ===")
for r in results:
    if r["lr_values"]:
        print(f"[!!!] {r['endpoint']} ({r['variant']}): lr={r['lr_values']}")
    if r["video_urls"]:
        print(f"[VID] {r['endpoint']} ({r['variant']}): {len(r['video_urls'])} 个视频 URL")
