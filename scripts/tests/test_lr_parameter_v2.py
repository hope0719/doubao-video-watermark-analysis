#!/usr/bin/env python3
"""
从完整响应体中提取视频 URL，测试修改 lr 参数
"""
import json, re, urllib.request, urllib.error

# 读 v2 结果（里面有完整响应体）
with open("/Users/hope/Desktop/幻影空间/doubao_login_v2_20260706_011609.json") as f:
    data = json.load(f)

# 找 media_get_play_info 的响应，提取完整 main_url
for item in data:
    if item.get('endpoint') == 'media_get_play_info' and item.get('variant') == 'default':
        body = item.get('response_body', '')
        # 用正则提取完整的 main_url（JSON 字符串中的值）
        # 格式: "main_url":"https://...?"
        match = re.search(r'"main_url"\s*:\s*"([^"]+)"', body)
        if match:
            main_url = match.group(1)
            # 把 Unicode 转义还原（\u0026 → &）
            main_url = main_url.encode().decode('unicode_escape')
            print(f"[+] 完整 main_url:")
            print(f"    {main_url}")
            print()
            
            # 检查 lr 参数
            if 'lr=' in main_url:
                lr_match = re.search(r'[?&]lr=([^&]+)', main_url)
                print(f"[+] 当前 lr 参数: {lr_match.group(1) if lr_match else '未找到'}")
            else:
                print("[!] URL 中没有 lr 参数")
            break

# 构造测试 URL 列表
test_cases = []

if 'main_url' in dir() and 'main_url' in locals():
    # 原始 URL
    test_cases.append(("原始（video_gen_watermark_dyn）", main_url))
    
    # 替换 lr 参数
    if 'lr=' in main_url:
        base = re.sub(r'([?&])lr=[^&]+', r'\1LR_PLACEHOLDER', main_url)
        test_cases.append(("lr=no_watermark", base.replace('LR_PLACEHOLDER', 'no_watermark')))
        test_cases.append(("lr=origin", base.replace('LR_PLACEHOLDER', 'origin')))
        test_cases.append(("lr=unwatermarked", base.replace('LR_PLACEHOLDER', 'unwatermarked')))
        test_cases.append(("去掉 lr 参数", re.sub(r'&lr=[^&]+', '', main_url)))

print(f"\n=== 测试 {len(test_cases)} 种 URL ===\n")

for label, url in test_cases:
    print(f"--- {label} ---")
    print(f"  URL: {url[:120]}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "*/*",
        "Referer": "https://www.doubao.com/",
        "Range": "bytes=0-102400",
    }
    
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            ct = resp.headers.get("Content-Type", "")
            etag = resp.headers.get("ETag", "")
            content_range = resp.headers.get("Content-Range", "")
            print(f"  status: 206 (Partial Content)")
            print(f"  Content-Type: {ct}")
            print(f"  ETag: {etag}")
            print(f"  前 100KB 字节数: {len(content)}")
            if content_range:
                print(f"  Content-Range: {content_range}")
    except urllib.error.HTTPError as e:
        print(f"  status: {e.code}")
        print(f"  reason: {e.reason}")
    except Exception as e:
        print(f"  error: {e}")
    print()

print("=== 对比说明 ===")
print("如果所有 URL 返回相同的 ETag / 文件头 → 同一文件，水印已烘焙，改 lr 无效")
print("如果 ETag 不同 → CDN 可能根据 lr 路由到不同文件，值得完整下载对比")
