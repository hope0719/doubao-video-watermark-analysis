#!/usr/bin/env python3
"""
豆包"变清晰"功能探针

目标：
  - 豆包 APP / 网页有一个"变清晰"功能，对图片是 AI 超分（去水印时有效）
  - 视频端是否也有这个能力？响应里有没有不带水印的版本？

探测方式：
  1. 检查是否有 samantha/video/enhance_video 或类似端点
  2. 用登录态调用增强类接口
  3. 看 JS bundle 里有没有 enhance / hd / clear / sr 关键字对应的端点

输出：
  - 找到的候选端点列表
  - 每个端点调用结果
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
from datetime import datetime

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

# 候选端点（基于关键字猜测）
CANDIDATE_ENDPOINTS = [
    ("enhance_video", "POST", "https://www.doubao.com/samantha/video/enhance_video", {"vid": VIDEO_ID, "video_id": VIDEO_ID, "scene": "enhance"}),
    ("video_hd", "POST", "https://www.doubao.com/samantha/video/hd", {"vid": VIDEO_ID}),
    ("video_sr", "POST", "https://www.doubao.com/samantha/video/sr", {"vid": VIDEO_ID}),
    ("video_clear", "POST", "https://www.doubao.com/samantha/video/clear", {"vid": VIDEO_ID}),
    ("video_upscale", "POST", "https://www.doubao.com/samantha/video/upscale", {"vid": VIDEO_ID}),
    ("video_super_resolution", "POST", "https://www.doubao.com/samantha/video/super_resolution", {"vid": VIDEO_ID}),
    ("video_enhance_status", "GET", f"https://www.doubao.com/samantha/video/enhance_status?vid={VIDEO_ID}", None),
    ("hd_video", "POST", "https://www.doubao.com/samantha/media/hd_video", {"key": VIDEO_ID}),
    ("original_video", "POST", "https://www.doubao.com/samantha/media/original_video", {"key": VIDEO_ID}),
    ("clean_video", "POST", "https://www.doubao.com/samantha/media/clean_video", {"key": VIDEO_ID}),
    ("video_clean", "POST", "https://www.doubao.com/samantha/media/video_clean", {"key": VIDEO_ID}),
    ("video_no_watermark", "POST", "https://www.doubao.com/samantha/media/video_no_watermark", {"key": VIDEO_ID}),
    # 图像类增强
    ("image_enhance", "POST", "https://www.doubao.com/samantha/image/enhance", {"key": "test"}),
    ("image_sr", "POST", "https://www.doubao.com/samantha/image/sr", {"key": "test"}),
    # alice/resource 类
    ("watermark_remove", "POST", "https://www.doubao.com/alice/resource/watermark_remove", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("video_remove_watermark", "POST", "https://www.doubao.com/alice/resource/video_remove_watermark", {"vid": VIDEO_ID}),
    ("media_clean", "POST", "https://www.doubao.com/alice/resource/media_clean", {"key": VIDEO_ID}),
    # 创作者/会员接口
    ("creator_video_download", "POST", "https://www.doubao.com/creator/video/download", {"vid": VIDEO_ID}),
    ("vip_video_download", "POST", "https://www.doubao.com/vip/video/download", {"vid": VIDEO_ID}),
    ("member_video", "POST", "https://www.doubao.com/member/video", {"vid": VIDEO_ID}),
    # 抖音创作者下载
    ("creator_no_watermark", "POST", "https://creator.douyin.com/aweme/v1/creator/video/no_watermark_download/", {"video_id": VIDEO_ID}),
]

# 扫描 JS bundle 找更多候选
def scan_js_bundles():
    """扫描本地已下载的 JS bundle 找 enhance 类端点"""
    js_dir = "/tmp/doubao_js"
    if not os.path.exists(js_dir):
        print(f"[*] JS bundle 目录不存在: {js_dir}")
        return

    keywords = ['enhance', 'super_resolution', 'sr_video', 'video_hd', 'video_clear', 'video_sr',
                'clear_video', 'hd_video', 'original_video', 'no_watermark', 'unwatermark',
                '/alice/resource/', '/samantha/video/', '/samantha/media/']
    found = {}
    for fn in os.listdir(js_dir):
        path = os.path.join(js_dir, fn)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        except Exception:
            continue
        for kw in keywords:
            if kw in text:
                for m in re.finditer(rf'["\'`](/[a-z_/]*{re.escape(kw.replace("/", ""))}[a-z_/]*)["\'`]', text):
                    found.setdefault(kw, set()).add(m.group(1))
                # 也搜 genBaseURL 形式
                for m in re.finditer(rf'genBaseURL\(["\'`]([^"\'`]+)["\'`]', text):
                    found.setdefault('baseurl', set()).add(m.group(1))
                # 搜 endpoint 字符串
                for m in re.finditer(rf'["\'`](/[a-zA-Z0-9_/]+{re.escape(kw.replace("/", ""))}[a-zA-Z0-9_/]*)["\'`]', text):
                    found.setdefault(kw, set()).add(m.group(1))
    return found


def build_headers(cookie_str: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.doubao.com",
        "Referer": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}",
        "Content-Type": "application/json",
        "Cookie": cookie_str,
    }


def call(method: str, url: str, body: dict, cookie_str: str) -> dict:
    headers = build_headers(cookie_str)
    data = None
    if body:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
            return {"status": resp.status, "ct": resp.headers.get("Content-Type", ""), "body": content}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "ct": e.headers.get("Content-Type", ""), "body": e.read().decode("utf-8", errors="ignore")}
    except Exception as e:
        return {"status": -1, "body": str(e)}


def main():
    print("=" * 70)
    print("豆包'变清晰'/增强类端点 探针")
    print("=" * 70)

    # 1. 先扫 JS bundle
    print("\n[1/2] 扫描本地 JS bundle 找候选端点...")
    found = scan_js_bundles()
    if found:
        for kw, urls in found.items():
            print(f"  关键字 {kw}: {len(urls)} 个候选")
            for u in sorted(urls)[:10]:
                print(f"    {u}")

    # 2. 调用候选端点
    print("\n[2/2] 调用候选端点（需要登录态 Cookie）")
    print("获取方式：登录 https://www.doubao.com/ → F12 → 粘贴 document.cookie")

    cookie_file = "/Users/hope/Desktop/幻影空间/doubao_cookies.json"
    cookie_str = None
    if os.path.exists(cookie_file):
        try:
            with open(cookie_file, "r", encoding="utf-8") as f:
                cookies = json.load(f)
            cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
            print(f"[+] 从 {cookie_file} 加载 {len(cookies)} 个 cookie")
        except Exception:
            pass

    if not cookie_str:
        cookie_str = input("Cookie > ").strip()
    if not cookie_str:
        print("[-] 未提供 Cookie，仍会调用（会得到 401/403，但能看到端点是否存在）")
        cookie_str = ""

    print()
    for name, method, url, body in CANDIDATE_ENDPOINTS:
        r = call(method, url, body, cookie_str)
        body_preview = r.get("body", "")[:200]
        marker = "[200]" if r["status"] == 200 else f"[{r['status']}]"
        print(f"  {marker} {name:>30} {url.split('doubao.com')[-1]}")
        if r["status"] == 200:
            print(f"        body: {body_preview}")

    # 输出 JS bundle 扫描结果到文件
    out_path = f"/Users/hope/Desktop/幻影空间/doubao_enhance_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"scan": {k: sorted(list(v)) for k, v in found.items()}}, f, ensure_ascii=False, indent=2)
    print(f"\n[+] JS bundle 扫描结果已保存到 {out_path}")


if __name__ == "__main__":
    main()
