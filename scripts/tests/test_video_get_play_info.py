#!/usr/bin/env python3
"""
使用用户提供的完整 Cookie 调用 video/get_play_info
"""
import json, re, urllib.request, urllib.error, urllib.parse
from datetime import datetime

VIDEO_ID = "v0369cg10004d958scaljht7f13k4q80"

# 用户提供的完整 Cookie（逐行解析，正确处理 URL 编码）
RAW = (
    "hook_slardar_session_id=202607060104406A5E3ED4E8E75BAE1167; "
    "i18next=zh; "
    "passport_csrf_token=9046aab226e8a54ee7f447dde5aaaa4d; "
    "passport_csrf_token_default=9046aab226e8a54ee7f447dde5aaaa4d; "
    "s_v_web_id=verify_mp748dtx_Ud1EeBiV_ueCW_4mi7_9kwL_4MXk6pSaNDXI; "
    "dbx-web-theme=light; "
    "flow_user_country=CN; "
    "x-tt-multi-sids=VVVZRxRHVVEcX1dAWRtRRlxDNVtOWlEdVFxdFR5PAAZICFVGXklWSkEUQVtMClVAB18O; "
    "flow_cur_user_sec_id=Kz9bAGEdJCBsLCAyPRwmJhUSJThrKjFMEVxWOW4ODCtsKD5KPxhTGiAxITtPEVJPKFxaEUAzOiYAFzMDGX9VFD0nIxlYWzISPgYNOg==; "
    "flow_multi_user_sec_info=Kz9bAGEdJCBsLCAyPRwmJhUSJThrKjFMEVxWOW4ODCtsKD5KPxhTGiAxITtPEVJPKFxaEUAzOiYAFzMDGX9VFD0nIxlYWzISPgYNOhdNVFUVXlFGXRpUSk9FQQ==; "
    "is_microsoft_channel=1; "
    "flow_ssr_sidebar_expand=1; "
    "biz_trace_id=306a579f; "
    "ttwid=1|Up_enoKzvr8z7uWMxpb5ckIid2zrjySmaNwUWKrZwfw|1783271083|0"
)

# 手动解析（因为 ttwid 值含 | 字符）
COOKIES = {}
for part in RAW.split("; "):
    part = part.strip()
    if "=" in part:
        k, v = part.split("=", 1)
        COOKIES[k] = v

# 把 ttwid 的 %7C 解码为 |
if "ttwid" in COOKIES:
    COOKIES["ttwid"] = urllib.parse.unquote(COOKIES["ttwid"])

# 另外从用户完整 Cookie 里补充 sessionid 等字段
# 用户消息里有: sessionid=4c14d202b38edee455d588d54aa09a3a
# 但注意这些值可能已过期，我们先用之前 document.cookie 能拿到的字段

# 构造 Cookie 字符串
COOKIE_STR = "; ".join(f"{k}={v}" for k, v in COOKIES.items())
print(f"[+] Cookie 字段数: {len(COOKIES)}")
print(f"[+] Cookie 长度: {len(COOKIE_STR)}")
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
        print("\n[+] 调通了！分析 play_infos 响应...")
        data = resp.get("data", {})
        play_infos = data.get("play_infos", [])
        print(f"play_infos 数量: {len(play_infos)}")
        
        for i, pi in enumerate(play_infos):
            print(f"\n  play_infos[{i}]:")
            print(f"    definition: {pi.get('definition', '')}")
            main = pi.get("main", "")
            print(f"    main URL 长度: {len(main)}")
            print(f"    main URL 前 400 字符:")
            print(f"      {main[:400]}")
            print(f"    URL 含 lr=: {'lr=' in main}")
            if "lr=" in main:
                lr_val = re.search(r"[?&]lr=([^&]+)", main)
                print(f"    lr 值: {urllib.parse.unquote(lr_val.group(1)) if lr_val else '未提取'}")
        
        # 保存完整响应
        out = f"/Users/hope/Desktop/幻影空间/video_get_play_info_full_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(out, "w") as f:
            json.dump(resp, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 完整响应已保存到: {out}")
        
    elif code == 710012001:
        print("\n[-] 仍然返回登录过期")
        print("     原因：sessionid 不在 document.cookie 里，需要 Cookie-Editor 导出")
        print(f"     响应: {body[:300]}")
    else:
        print(f"     未知 code，响应: {body[:500]}")
        
except json.JSONDecodeError:
    print(f"非 JSON 响应: {body[:500]}")
