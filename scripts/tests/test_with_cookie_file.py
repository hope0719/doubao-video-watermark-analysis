#!/usr/bin/env python3
"""
直接使用用户提供的完整 Cookie 字符串
省去解析步骤，避免出错
"""
import json, re, urllib.request, urllib.error, urllib.parse
from datetime import datetime

VIDEO_ID = "v0369cg10004d958scaljht7f13k4q80"

# 用户提供的完整 Cookie（从第二次消息复制，直接粘贴）
# 注意：这里需要用户确认哪个是最新的完整 Cookie
# 先用第一次的 Cookie + 手动补 sessionid

# 方案：直接从文件读 Cookie
# 用户需要把完整 Cookie 保存到文件

def load_cookie_file(path):
    with open(path, "r") as f:
        return f.read().strip()

# 尝试从文件读取
import os
cookie_file = "/Users/hope/Desktop/幻影空间/cookie_full.txt"
if not os.path.exists(cookie_file):
    print(f"[-] 找不到 {cookie_file}")
    print("请先创建这个文件，把完整 Cookie 粘贴进去")
    print("Cookie 格式：key1=value1; key2=value2; ...")
    exit(1)

COOKIE_STR = load_cookie_file(cookie_file)
print(f"[+] 从文件加载 Cookie，长度: {len(COOKIE_STR)}")
print()

QUERY = {
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

def call(endpoint, method, body):
    qs = "&".join(f"{k}={v}" for k, v in QUERY.items())
    url = f"https://www.doubao.com/samantha/{endpoint}?{qs}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://www.doubao.com",
        "Referer": "https://www.doubao.com/",
        "Cookie": COOKIE_STR,
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="ignore"), resp.status
    except urllib.error.HTTPError as e:
        return e.read().decode("utf-8", errors="ignore"), e.code
    except Exception as e:
        return str(e), -1

print("=== 测试: /samantha/video/get_play_info ===")
body, status = call("video/get_play_info", "POST", {"vid": VIDEO_ID})
print(f"HTTP Status: {status}")
print(f"响应长度: {len(body)} 字符")
print()

try:
    resp = json.loads(body)
    code = resp.get("code", -1)
    msg = resp.get("msg", "")
    print(f"code={code}  msg={msg}")
    
    if code == 0:
        print("\n[+] 调通了！分析 play_infos...")
        data = resp.get("data", {})
        play_infos = data.get("play_infos", [])
        
        for i, pi in enumerate(play_infos):
            print(f"\n  play_infos[{i}]:")
            print(f"    definition: {pi.get('definition', '')}")
            main = pi.get("main", "")
            print(f"    main URL 前 500 字符:")
            print(f"      {main[:500]}")
            print(f"    URL 含 lr=: {'lr=' in main}")
            
            if "lr=" in main:
                lr_val = re.search(r"[?&]lr=([^&]+)", main)
                if lr_val:
                    print(f"    lr 值: {urllib.parse.unquote(lr_val.group(1))}")
        
        # 保存完整响应
        out = f"/Users/hope/Desktop/幻影空间/video_get_play_info_response_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(out, "w") as f:
            json.dump(resp, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 完整响应已保存到: {out}")
        
    elif code == 710012001:
        print("\n[-] 仍然登录过期")
        print("     请用 Cookie-Editor 扩展导出完整 Cookie（含 HttpOnly）")
        print("     或者：在浏览器 F12 Network 标签找到 video/get_play_info 请求")
        print("     右键 → Copy → Copy as cURL，然后把 cURL 命令发给我")
        
except json.JSONDecodeError:
    print(f"非 JSON 响应: {body[:500]}")
