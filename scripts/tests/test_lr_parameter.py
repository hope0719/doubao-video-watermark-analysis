#!/usr/bin/env python3
"""
测试：直接修改视频 CDN URL 中的 lr 参数，看是否返回不同文件
"""
import json, re, urllib.request, urllib.error
from datetime import datetime

# 先从之前保存的响应中拿到真实的视频 URL
with open("/Users/hope/Desktop/幻影空间/doubao_login_v2_20260706_011609.json") as f:
    data = json.load(f)

# 找一条有视频 URL 的响应
video_url = None
for item in data:
    body = item.get('response_body', '')
    urls = re.findall(r'https?://[^\s"\'\\<>]+', body)
    video_urls = [u for u in urls if '.mp4' in u or 'videoweb' in u or 'douyinvod' in u]
    if video_urls:
        video_url = video_urls[0]
        print(f"[+] 找到视频 URL（来自 {item['endpoint']}）:")
        print(f"    {video_url[:200]}")
        break

if not video_url:
    print("[-] 没有找到视频 URL，使用默认测试 URL")
    video_url = "https://v9-videoweb.doubao.com/fef576824e11d08f09f56eb060f22b6b/6a4be2d8/video/tos/cn/tos-cn-v-9ecd54/o4jCIQ9qCEhYSaIKgQ4IEcJO4e1QjA90BUsdq5/?a=497858&ch=0&cr=0&dr=0&er=0&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C0&cv=1&br=1695&bt=1695&cs=0&ds=3&download=true"

print(f"\n原始 URL 中的 lr = video_gen_watermark_dyn")
print()

# 构造不同 lr 参数的 URL
test_urls = [
    ("原始（带水印）", video_url),
]

# 把 lr=video_gen_watermark_dyn 替换成不同值
if 'lr=video_gen_watermark_dyn' in video_url:
    base = video_url.replace('lr=video_gen_watermark_dyn', 'LR_PLACEHOLDER')
    test_urls.append(("lr=no_watermark", base.replace('LR_PLACEHOLDER', 'no_watermark')))
    test_urls.append(("lr=origin", base.replace('LR_PLACEHOLDER', 'origin')))
    test_urls.append(("lr=unwatermarked", base.replace('LR_PLACEHOLDER', 'unwatermarked')))
    test_urls.append(("去掉 lr 参数", video_url.split('&lr=')[0] + '&' + video_url.split('&lr=')[1].split('&')[0] + '&'.join(video_url.split('&lr=')[1].split('&')[1:])))

# 如果 URL 里没有 lr=（可能已经被提取时截断了），尝试加 lr 参数
# 这里需要先获取真实的完整 URL

print("=== 测试不同 lr 参数的视频 URL ===\n")

for label, url in test_urls:
    print(f"--- {label} ---")
    print(f"  URL: {url[:150]}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.doubao.com/",
        "Range": "bytes=0-102400",  # 只下载前 100KB
    }
    
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            total_size = resp.headers.get("Content-Range", "")
            ct = resp.headers.get("Content-Type", "")
            etag = resp.headers.get("ETag", "")
            print(f"  status: {resp.status}")
            print(f"  Content-Type: {ct}")
            print(f"  ETag: {etag}")
            print(f"  前 100KB 大小: {len(content)} bytes")
            if total_size:
                print(f"  Content-Range: {total_size}")
    except urllib.error.HTTPError as e:
        print(f"  status: {e.code}")
        print(f"  reason: {e.reason}")
        body = e.read()
        print(f"  body: {body[:200]}")
    except Exception as e:
        print(f"  error: {e}")
    print()

print("=== 对比说明 ===")
print("如果不同 lr 参数的 ETag / 文件大小相同 → CDN 返回同一文件（水印已烘焙）")
print("如果 ETag / 文件大小不同 → 可能存在不同版本（值得进一步测试）")
