#!/usr/bin/env python3
"""
豆包登录态全链路探针 v2 - 简化版

不需要 playwright。用户需要：
  1. 在 Chrome/Edge 打开 https://www.doubao.com/ 并登录
  2. F12 → Console 粘贴下方代码，把所有 cookie 复制出来
  3. 把 cookie 字符串粘到本脚本运行

也可以：
  - 浏览器已经登录，直接用 Chrome DevTools Protocol (CDP) 拉取 cookie

Cookie 抓取代码（在豆包 Console 粘贴）：
  document.cookie.split('; ').map(c => c.split('=')).map(([k,v]) => k + '=' + v).join('; ')

或者：
  JSON.stringify(await (await fetch('/')).text())  // 不行，改用下面这个

完整版（推荐）：
  (async () => {
    const r = await fetch('https://www.doubao.com/');
    const cookies = r.headers.get('set-cookie') || '';
    return cookies;
  })()

最简版：直接用 document.cookie
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

ENDPOINTS = [
    ("samantha_media_get_play_info", "POST", "https://www.doubao.com/samantha/media/get_play_info", {"key": VIDEO_ID}),
    ("samantha_media_get_play_info_minimal", "POST", "https://www.doubao.com/samantha/media/get_play_info", {"vid": VIDEO_ID}),
    ("samantha_video_get_play_info", "POST", "https://www.doubao.com/samantha/video/get_play_info", {"vid": VIDEO_ID, "video_id": VIDEO_ID}),
    ("samantha_video_get_play_info_key", "POST", "https://www.doubao.com/samantha/video/get_play_info", {"key": VIDEO_ID}),
    ("samantha_video_query_video_gen_info", "POST", "https://www.doubao.com/samantha/video/query_video_gen_info", {"video_id": VIDEO_ID, "vid": VIDEO_ID}),
    ("samantha_video_query_video_gen_info_min", "POST", "https://www.doubao.com/samantha/video/query_video_gen_info", {"vid": VIDEO_ID}),
    ("creativity_share_get_video_share_info", "POST", "https://www.doubao.com/creativity/share/get_video_share_info", {"share_id": SHARE_ID, "vid": VIDEO_ID, "creation_id": ""}),
    ("watermark_task_get", "GET", "https://www.doubao.com/alice/resource/watermark_task?task_id=test", None),
    ("watermark_download_post", "POST", "https://www.doubao.com/alice/resource/watermark_download", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("watermark_download_get", "GET", f"https://www.doubao.com/alice/resource/watermark_download?url=https%3A%2F%2Fwww.doubao.com%2Fvideo-sharing%3Fvideo_id%3D{VIDEO_ID}", None),
    ("watermark_task_post", "POST", "https://www.doubao.com/alice/resource/watermark_task", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("alice_resource_register", "POST", "https://www.doubao.com/alice/resource/register", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    ("alice_resource_prepare_upload", "POST", "https://www.doubao.com/alice/resource/prepare_upload", {"url": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}"}),
    # 抖音/剪映
    ("douyin_creator_video_list", "GET", "https://creator.douyin.com/aweme/v1/creator/video/list/", None),
]

# 不同 query 组合
QUERY_VARIANTS = [
    {"name": "default_v20800", "query": {"version_code": "20800", "language": "zh-CN", "device_platform": "web", "aid": "497858", "real_aid": "497858", "pkg_type": "release_version", "samantha_web": "1", "use-olympus-account": "1"}},
    {"name": "minimal", "query": {"aid": "497858"}},
    {"name": "old_vc_8000", "query": {"version_code": "8000", "aid": "1128"}},
    {"name": "old_vc_12000", "query": {"version_code": "12000", "aid": "497858"}},
    {"name": "no_params", "query": {}},
]


def build_headers(cookie_str: str) -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://www.doubao.com",
        "Referer": f"https://www.doubao.com/video-sharing?video_id={VIDEO_ID}&share_id={SHARE_ID}",
        "Content-Type": "application/json",
        "Cookie": cookie_str,
    }


def call(method: str, url: str, body: dict, cookie_str: str, query: dict) -> dict:
    qs = "&".join(f"{k}={v}" for k, v in query.items())
    full_url = url if not query else f"{url}{'&' if '?' in url else '?'}{qs}"

    headers = build_headers(cookie_str)
    if "douyin.com" in url:
        headers["Referer"] = "https://creator.douyin.com/"

    data = None
    if body:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(full_url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
            return {"ok": True, "status": resp.status, "ct": resp.headers.get("Content-Type", ""), "body": content}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "ct": e.headers.get("Content-Type", ""), "body": e.read().decode("utf-8", errors="ignore")}
    except Exception as e:
        return {"ok": False, "status": -1, "body": str(e)}


def extract_video_urls(text: str) -> list:
    urls = set()
    for m in re.finditer(r'https?://[^\s"\'<>\\]+', text):
        u = m.group(0).rstrip('\\/')
        if any(p in u for p in ['.mp4', '.m3u8', 'videoweb', 'douyinvod', 'tos-cn-v-', 'tos-cn-p-', 'byteic.cn']):
            urls.add(u)
    return sorted(urls)


def extract_lr_params(urls: list) -> list:
    return [re.search(r'lr=([^&]+)', u).group(1) for u in urls if 'lr=' in u]


def main():
    print("=" * 70)
    print("豆包登录态全链路探针")
    print("=" * 70)
    print("\n获取 Cookie 步骤：")
    print("  1. 在 Chrome/Edge 打开 https://www.doubao.com/ 并登录")
    print("  2. F12 → Console，粘贴以下代码回车：")
    print("     document.cookie")
    print("  3. 把输出的字符串粘到这里")
    print()
    print("或者使用 CDP 方式（更完整，需要安装 chrome-remote-interface）")
    print()

    # 优先用文件中的 cookie
    cookie_file_candidates = [
        "/Users/hope/Desktop/幻影空间/doubao_cookies.json",
        os.path.expanduser("~/doubao_cookies.json"),
    ]
    cookie_str = None
    for f in cookie_file_candidates:
        if os.path.exists(f):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    cookies = json.load(fh)
                if isinstance(cookies, list):
                    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
                    print(f"[+] 从 {f} 加载了 {len(cookies)} 个 cookie")
                    break
            except Exception as e:
                print(f"[!] {f} 加载失败: {e}")

    if not cookie_str:
        print("请输入 Cookie 字符串（直接粘贴）:")
        cookie_str = input("> ").strip()
        # 也支持简化的 name=value; name2=value2 格式

    if not cookie_str:
        print("[-] 未提供 Cookie，退出")
        sys.exit(1)

    print(f"[+] Cookie 长度: {len(cookie_str)}")

    all_results = []
    for ep_name, method, url, body in ENDPOINTS:
        print(f"\n--- {ep_name} ---")
        for variant in QUERY_VARIANTS:
            r = call(method, url, body, cookie_str, variant["query"])
            urls = extract_video_urls(r.get("body", ""))
            lr_values = extract_lr_params(urls)
            status = r["status"]
            ok_marker = "OK" if status == 200 else "FAIL"
            print(f"  [{variant['name']:>15}] {ok_marker} status={status} video_urls={len(urls)} lr={lr_values}")
            if urls:
                for u in urls[:3]:
                    print(f"      {u[:200]}")
            all_results.append({
                "endpoint": ep_name,
                "variant": variant["name"],
                "status": status,
                "body_preview": r.get("body", "")[:500],
                "video_urls": urls,
                "lr_values": lr_values,
            })

    out_path = f"/Users/hope/Desktop/幻影空间/doubao_login_probe_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n[+] 完整结果已保存到 {out_path}")

    # 找无水印 URL
    print("\n=== 关键发现 ===")
    no_wm_urls = []
    for r in all_results:
        for u in r["video_urls"]:
            if any(x in u for x in ['no_watermark', 'unwatermarked', 'lr=origin']):
                no_wm_urls.append(u)
    if no_wm_urls:
        print(f"[!!!] 找到 {len(no_wm_urls)} 个无水印 URL:")
        for u in no_wm_urls[:5]:
            print(f"  {u}")
    else:
        print("[-] 没有找到 lr=no_watermark 的 URL")

    # 找所有 video URLs 汇总去重
    all_urls = set()
    for r in all_results:
        for u in r["video_urls"]:
            all_urls.add(u)
    print(f"\n[+] 共发现 {len(all_urls)} 个去重后的视频 URL")
    if all_urls:
        # 按域名分类
        by_host = {}
        for u in all_urls:
            m = re.match(r'https?://([^/]+)/', u)
            host = m.group(1) if m else '?'
            by_host.setdefault(host, []).append(u)
        for host, lst in by_host.items():
            print(f"  {host}: {len(lst)} 个 URL")
            for u in lst[:2]:
                print(f"    {u[:200]}")


if __name__ == "__main__":
    main()
