#!/usr/bin/env python3
"""
豆包 全链路终极探测 v3

基于 JS bundle 扫描 + 历史报告，列出所有视频/水印/下载/导出相关端点，
逐个用登录态 Cookie 调用，找出真正可能返回无水印 URL 的端点。

需要登录态 Cookie（从浏览器 console 获取 document.cookie）
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
from datetime import datetime
from urllib.parse import urlparse

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"
SHARE_ID = "49141126666482178"

# 基于 JS bundle 扫描得到的候选端点
ENDPOINTS = [
    # ============ 视频核心端点 ============
    ("media_get_play_info", "POST", "https://www.doubao.com/samantha/media/get_play_info", {"key": VIDEO_ID}),
    ("media_get_play_info_vid", "POST", "https://www.doubao.com/samantha/media/get_play_info", {"vid": VIDEO_ID}),
    ("media_mget_play_status", "POST", "https://www.doubao.com/samantha/media/mget_play_status", {"vid": VIDEO_ID}),
    ("media_mget_play_status_multi", "POST", "https://www.doubao.com/samantha/media/mget_play_status", {"vid_list": [VIDEO_ID]}),
    ("media_mget_play_status_vids", "POST", "https://www.doubao.com/samantha/media/mget_play_status", {"vids": [VIDEO_ID]}),
    ("video_get_play_info", "POST", "https://www.doubao.com/samantha/video/get_play_info", {"vid": VIDEO_ID, "video_id": VIDEO_ID}),
    ("video_query_video_gen_info", "POST", "https://www.doubao.com/samantha/video/query_video_gen_info", {"video_id": VIDEO_ID, "vid": VIDEO_ID}),

    # ============ 分享 / 创作 ============
    ("creativity_share_get_video_share_info", "POST", "https://www.doubao.com/creativity/share/get_video_share_info", {"share_id": SHARE_ID, "vid": VIDEO_ID, "creation_id": ""}),
    ("thread_share_info", "POST", "https://www.doubao.com/samantha/thread/share/info", {"share_id": SHARE_ID}),
    ("thread_share_snapshot", "POST", "https://www.doubao.com/samantha/thread/share/snapshot/get", {"share_id": SHARE_ID}),
    ("desktop_share_get", "POST", "https://www.doubao.com/samantha/desktop/share/get", {"share_id": SHARE_ID}),

    # ============ 水印端点 ============
    ("watermark_task_get", "GET", "https://www.doubao.com/alice/resource/watermark_task?task_id=test", None),
    ("watermark_download_post", "POST", "https://www.doubao.com/alice/resource/watermark_download", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("watermark_download_get", "GET", f"https://www.doubao.com/alice/resource/watermark_download?url=https%3A%2F%2Fwww.doubao.com%2Fvideo-sharing%3Fvideo_id%3D{VIDEO_ID}", None),
    ("watermark_task_post", "POST", "https://www.doubao.com/alice/resource/watermark_task", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("watermark_task_post2", "POST", "https://www.doubao.com/alice/resource/watermark_task", {"video_id": VIDEO_ID}),

    # ============ 文件 / 资源 ============
    ("upload_refresh_file_url", "POST", "https://www.doubao.com/alice/upload/refresh_file_url", {"file_url": f"https://v26-videoweb.doubao.com/...test..."}),
    ("message_get_file_url", "POST", "https://www.doubao.com/alice/message/get_file_url", {"file_id": VIDEO_ID}),
    ("aispace_get_file_url", "POST", "https://www.doubao.com/samantha/aispace/get_file_url", {"file_id": VIDEO_ID}),

    # ============ 导出 ============
    ("otter_doc_export", "POST", "https://www.doubao.com/samantha/otter/doc/export/", {"doc_id": VIDEO_ID}),
    ("otter_export_page_create", "POST", "https://www.doubao.com/samantha/otter/export/page/create", {"page_id": VIDEO_ID}),

    # ============ 创作/资产接口（之前没测过）============
    ("alice_media_bigmusic_get_video", "POST", "https://www.doubao.com/alice/media/bigmusic/get_video", {"video_id": VIDEO_ID}),
    ("alice_media_video_recommend", "POST", "https://www.doubao.com/alice/media/video/recommend", {"vid": VIDEO_ID}),
    ("alice_media_video_model", "POST", "https://www.doubao.com/alice/media/video_model", {"vid": VIDEO_ID}),

    # ============ 猜测的内部接口 ============
    ("samantha_video_get_no_wm", "POST", "https://www.doubao.com/samantha/video/get_no_watermark", {"vid": VIDEO_ID}),
    ("samantha_video_download", "POST", "https://www.doubao.com/samantha/video/download", {"vid": VIDEO_ID}),
    ("samantha_video_export", "POST", "https://www.doubao.com/samantha/video/export", {"vid": VIDEO_ID, "format": "mp4", "watermark": "false"}),
    ("samantha_video_original", "POST", "https://www.doubao.com/samantha/video/original", {"vid": VIDEO_ID}),
    ("samantha_video_clean", "POST", "https://www.doubao.com/samantha/video/clean", {"vid": VIDEO_ID}),
    ("samantha_video_hd", "POST", "https://www.doubao.com/samantha/video/hd", {"vid": VIDEO_ID}),

    # ============ 抖音/剪映 端点 ============
    ("douyin_creator_home", "GET", "https://creator.douyin.com/creator-micro/home/", None),
    ("douyin_creator_video_list", "GET", "https://creator.douyin.com/aweme/v1/creator/video/list/", None),
    ("douyin_web_my_videos", "GET", "https://www.douyin.com/aweme/v1/web/aweme/post/", None),
    ("capcut_draft_list", "GET", "https://www.capcut.com/api/v1/draft/list/", None),
    ("oceanengine_creative", "GET", "https://www.oceanengine.com/creative/manager/", None),

    # ============ 第三方 easydownload 后端（从反编译报告）============
    ("easydownload_parse", "POST", "https://api.easydownload.flyinglife.cn/parse", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}&share_id={SHARE_ID}"}),
    ("easydownload_v2", "POST", "https://api.easydownload.flyinglife.cn/v2/parse", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
]

QUERY = {
    "version_code": "20800",
    "language": "zh-CN",
    "device_platform": "web",
    "aid": "497858",
    "real_aid": "497858",
    "pkg_type": "release_version",
    "samantha_web": "1",
    "use-olympus-account": "1",
}


def build_headers(cookie_str: str, referer: str = "https://www.doubao.com/video-sharing") -> dict:
    h = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://www.doubao.com",
        "Referer": referer,
        "Content-Type": "application/json",
        "Cookie": cookie_str,
    }
    return h


def call(method: str, url: str, body: dict, cookie_str: str) -> dict:
    is_external = "douyin.com" in url or "capcut.com" in url or "oceanengine.com" in url or "easydownload" in url
    referer = "https://creator.douyin.com/" if "douyin.com" in url else "https://www.doubao.com/video-sharing"
    headers = build_headers(cookie_str, referer=referer)

    if "easydownload" in url:
        headers["User-Agent"] = "okhttp/4.9.0"
        headers["app-channel"] = "default"
        headers["app-package"] = "com.easydownload"

    qs = "&".join(f"{k}={v}" for k, v in QUERY.items())
    full_url = url if "?" in url else f"{url}?{qs}"

    data = None
    if body:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(full_url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
            return {"status": resp.status, "ct": resp.headers.get("Content-Type", ""), "body": content}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "ct": e.headers.get("Content-Type", ""), "body": e.read().decode("utf-8", errors="ignore")}
    except Exception as e:
        return {"status": -1, "body": str(e)}


def extract_video_urls(text: str) -> list:
    urls = set()
    for m in re.finditer(r'https?://[^\s"\'<>\\]+', text):
        u = m.group(0).rstrip('\\/')
        if any(p in u for p in ['.mp4', '.m3u8', 'videoweb', 'douyinvod', 'tos-cn-v-', 'tos-cn-p-', 'byteic.cn']):
            urls.add(u)
    return sorted(urls)


def main():
    print("=" * 70)
    print("豆包 全链路终极探测 v3")
    print("=" * 70)
    print(f"测试视频: {VIDEO_ID}")
    print(f"共 {len(ENDPOINTS)} 个候选端点")
    print()

    # Cookie 获取
    cookie_file_candidates = [
        "/Users/hope/Desktop/幻影空间/doubao_cookies.json",
        os.path.expanduser("~/doubao_cookies.json"),
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
        print("需要登录态 Cookie")
        print("获取方式：")
        print("  1. 浏览器登录 https://www.doubao.com/")
        print("  2. F12 → Console，粘贴 document.cookie")
        print("  3. 把字符串粘到下面")
        print()
        cookie_str = input("Cookie > ").strip()
        if cookie_str:
            # 保存以便复用
            cookies = []
            for kv in cookie_str.split("; "):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    cookies.append({"name": k, "value": v})
            with open("/Users/hope/Desktop/幻影空间/doubao_cookies.json", "w", encoding="utf-8") as f:
                json.dump(cookies, f, ensure_ascii=False, indent=2)
            print(f"[+] Cookie 已保存到 doubao_cookies.json")

    if not cookie_str:
        print("[-] 未提供 Cookie，退出")
        sys.exit(1)

    print(f"[+] Cookie 长度: {len(cookie_str)}")

    results = []
    interesting = []
    for name, method, url, body in ENDPOINTS:
        r = call(method, url, body, cookie_str)
        body_text = r.get("body", "")
        video_urls = extract_video_urls(body_text)
        status = r["status"]

        ok_marker = "OK" if status == 200 else f"  "
        print(f"  [{status:>3}] {ok_marker} {name:>40} video_urls={len(video_urls)}")

        if video_urls and status == 200:
            print(f"        [!!!] 找到 {len(video_urls)} 个视频 URL:")
            for u in video_urls[:3]:
                print(f"          {u[:200]}")
            interesting.append({"endpoint": name, "url": url, "video_urls": video_urls, "body": body_text[:1000]})

        results.append({
            "endpoint": name,
            "method": method,
            "url": url,
            "status": status,
            "ct": r.get("ct", ""),
            "video_urls": video_urls,
            "body_preview": body_text[:500],
        })

    out_path = f"/Users/hope/Desktop/幻影空间/doubao_probe_v3_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"all": results, "interesting": interesting}, f, ensure_ascii=False, indent=2)
    print(f"\n[+] 完整结果已保存到 {out_path}")

    print("\n=== 关键发现 ===")
    if interesting:
        print(f"[!!!] 共 {len(interesting)} 个端点返回了视频 URL：")
        for i in interesting:
            print(f"\n  {i['endpoint']}:")
            for u in i["video_urls"][:5]:
                print(f"    {u}")
    else:
        print("[-] 没有端点返回 200 + 视频 URL")
        print("    - 可能是 Cookie 已失效")
        print("    - 或者所有这些端点都需要更高的鉴权等级")


if __name__ == "__main__":
    main()
