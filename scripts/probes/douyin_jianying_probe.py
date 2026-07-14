#!/usr/bin/env python3
"""
抖音/剪映同步链路探测

用登录态 Cookie 探测：
  1. 抖音创作者中心（creator.douyin.com）是否能看到豆包生成的视频
  2. 抖音创作者服务平台的视频列表 API
  3. 剪映 web 端 API
  4. 巨量百应 / 巨量算数 相关 API
  5. 字节系通用 creator API

需要：
  - 在浏览器登录 https://www.douyin.com/ 或 https://creator.douyin.com/
  - 把 document.cookie 粘进来（推荐用 Cookie-Editor 扩展导出 JSON）
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
from datetime import datetime

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"
SHARE_ID = "49141126666482178"

# 探测端点：每个域名下的核心 creator / video / asset 接口
ENDPOINTS = [
    # 抖音创作者中心
    ("douyin_creator_home", "GET", "https://creator.douyin.com/creator-micro/home/", None, {"Referer": "https://creator.douyin.com/"}),
    ("douyin_creator_data", "GET", "https://creator.douyin.com/aweme/v1/creator/data/", None, {"Referer": "https://creator.douyin.com/"}),
    ("douyin_creator_video_list", "GET", "https://creator.douyin.com/aweme/v1/creator/video/list/", None, {"Referer": "https://creator.douyin.com/"}),
    ("douyin_creator_video_data", "GET", "https://creator.douyin.com/aweme/v1/creator/video/data/", None, {"Referer": "https://creator.douyin.com/"}),
    # 巨量百应
    ("oceanengine_publisher", "GET", "https://www.oceanengine.com/quickly/publisher/video/list/", None, {"Referer": "https://www.oceanengine.com/"}),
    ("oceanengine_creative", "GET", "https://www.oceanengine.com/creative/manager/", None, {"Referer": "https://www.oceanengine.com/"}),
    # 字节通用 creator API
    ("bytedance_creator_video", "GET", "https://creator.bytedance.com/api/v1/video/list/", None, {"Referer": "https://creator.bytedance.com/"}),
    # 剪映
    ("capcut_web_assets", "GET", "https://www.capcut.com/api/v1/assets/list/", None, {"Referer": "https://www.capcut.com/"}),
    ("capcut_draft_list", "GET", "https://www.capcut.com/api/v1/draft/list/", None, {"Referer": "https://www.capcut.com/"}),
    # 抖音 web 版
    ("douyin_web_my_videos", "GET", "https://www.douyin.com/aweme/v1/web/aweme/post/", None, {"Referer": "https://www.douyin.com/"}),
    ("douyin_web_favorite", "GET", "https://www.douyin.com/aweme/v1/web/aweme/favorite/", None, {"Referer": "https://www.douyin.com/"}),
    # 抖音开放平台
    ("douyin_open_api_video_list", "GET", "https://open.douyin.com/video/list/", None, {"Referer": "https://open.douyin.com/"}),
    # TikTok 系
    ("tiktok_creator", "GET", "https://www.tiktok.com/api/v1/creator/video/list/", None, {"Referer": "https://www.tiktok.com/"}),
]


def build_headers(cookie_str: str, extra: dict = None) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Cookie": cookie_str,
    }
    if extra:
        headers.update(extra)
    return headers


def call(method: str, url: str, body: dict, cookie_str: str) -> dict:
    headers = build_headers(cookie_str)
    data = None
    if body:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
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
    print("抖音/剪映 同步链路探测")
    print("=" * 70)
    print("\n需要登录态 Cookie")
    print("获取方式：")
    print("  1. 浏览器登录 https://creator.douyin.com/ 或 https://www.douyin.com/")
    print("  2. F12 → Console 粘贴: document.cookie")
    print("  3. 把字符串粘到下方")
    print()

    cookie_file_candidates = [
        "/Users/hope/Desktop/幻影空间/douyin_cookies.json",
        os.path.expanduser("~/douyin_cookies.json"),
    ]
    cookie_str = None
    for f in cookie_file_candidates:
        if os.path.exists(f):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    cookies = json.load(fh)
                if isinstance(cookies, list):
                    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
                    print(f"[+] 从 {f} 加载 {len(cookies)} 个 cookie")
                    break
            except Exception:
                pass

    if not cookie_str:
        cookie_str = input("Cookie > ").strip()
    if not cookie_str:
        print("[-] 未提供 Cookie，退出")
        sys.exit(1)

    print(f"[+] Cookie 长度: {len(cookie_str)}")

    for name, method, url, body, extra in ENDPOINTS:
        r = call(method, url, body, cookie_str)
        # 提取关键信息
        body_preview = r.get("body", "")[:300]
        print(f"\n--- {name} ---")
        print(f"  status={r['status']} ct={r.get('ct', '')}")
        if "video" in body_preview.lower() or ".mp4" in body_preview or "aweme_id" in body_preview:
            print(f"  [!!!] 含 video 字段:")
            print(f"  {body_preview}")
        elif r['status'] == 200:
            print(f"  body: {body_preview}")
        else:
            print(f"  body: {body_preview[:200]}")

    print("\n" + "=" * 70)
    print("提示：")
    print("  - 如果某些端点返回 200 且有 video 列表，说明这条链路走得通")
    print("  - 进一步可以查 v1/creator/video/data/ 拿单个视频的下载链接")
    print("  - 创作者中心的下载选项通常有无水印版本")


if __name__ == "__main__":
    main()
