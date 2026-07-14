#!/usr/bin/env python3
"""
使用用户提供的完整 Cookie 调用 video/get_play_info
重点：这次 Cookie 含有 sessionid 等关键字段
"""
import json, re, urllib.request, urllib.error
from datetime import datetime

VIDEO_ID = "v0369cg10004d958scaljht7f13k4q80"

# 用户提供的完整 Cookie（含 sessionid / ttwid 等）
COOKIE_STR = (
    "hook_slardar_session_id=202607060104406A5E3ED4E8E75BAE1167;"
    "i18next=zh;"
    "passport_csrf_token=9046aab226e8a54ee7f447dde5aaaa4d;"
    "passport_csrf_token_default=9046aab226e8a54ee7f447dde5aaaa4d;"
    "s_v_web_id=verify_mp748dtx_Ud1EeBiV_ueCW_4mi7_9kwL_4MXk6pSaNDXI;"
    "n_mh=6grxceSFCVrRAb57vVgcSLTBT-or_RNntglldUCne0A;"
    "dbx-web-theme=light;"
    "flow_user_country=CN;"
    "multi_sids=3960900312632624%3A4c14d202b38edee455d588d54aa09a3a;"
    "odin_tt=209a8d9fac12202af51cdab6b5ccce10a8e332ac63d26528cc9178f2a74460188af616b5004ac83c5a58db48ae9267508831365412e4a8c85d5622349f38e031;"
    "sid_guard=4c14d202b38edee455d588d54aa09a3a%7C1783056778%7C2592000%7CSun%2C+02-Aug-2026+05%3A32%3A58+GMT;"
    "uid_tt=3cca2589c2ed9e55a74bab564ac5ae76;"
    "uid_tt_ss=3cca2589c2ed9e55a74bab564ac5ae76;"
    "sid_tt=4c14d202b38edee455d588d54aa09a3a;"
    "sessionid=4c14d202b38edee455d588d54aa09a3a;"
    "sessionid_ss=4c14d202b38edee455d588d54aa09a3a;"
    "session_tlb_tag=sttt%7C9%7CTBTSArOO3uRV1YjVSqCaOv__________ki6SijCEcZ7CsWZVXr5CGitQA9l8AcHdYgc9zIXCHL8%3D;"
    "is_staff_user=false;"
    "has_biz_token=false;"
    "sid_ucp_v1=1.0.0-KGI3Y2I4MTE3ZDExZDAxOTRhOWYwNmQzNGY4N2VhZmYwYzY3Y2FjMmQKIAiwmoDBr82EBxCKk53SBhjCsR4gDDC4hb6lBjgHQPQHGgJobCIgNGMxNGQyMDJiMzhlZGVlNDU1ZDU4OGQ1NGFhMDlhM2E;"
    "ssid_ucp_v1=1.0.0-KGI3Y2I4MTE3ZDExZDAxOTRhOWYwNmQzNGY4N2VhZmYwYzY3Y2FjMmQKIAiwmoDBr82EBxCKk53SBhjCsR4gDDC4hb6lBjgHQPQHGgJobCIgNGMxNGQyMDJiMzhlZGVlNDU1ZDU4OGQ1NGFhMDlhM2E;"
    "x-tt-multi-sids=VVVZRxRHVVEcX1dAWRtRRlxDNVtOWlEdVFxdFR5PAAZICFVGXklWSkEUQVtMClVAB18O;"
    "flow_cur_user_sec_id=Kz9bAGEdJCBsLCAyPRwmJhUSJThrKjFMEVxWOW4ODCtsKD5KPxhTGiAxITtPEVJPKFxaEUAzOiYAFzMDGX9VFD0nIxlYWzISPgYNOg==;"
    "flow_multi_user_sec_info=Kz9bAGEdJCBsLCAyPRwmJhUSJThrKjFMEVxWOW4ODCtsKD5KPxhTGiAxITtPEVJPKFxaEUAzOiYAFzMDGX9VFD0nIxlYWzISPgYNOhdNVFUVXlFGXRpUSk9FQQ==;"
    "is_microsoft_channel=1;"
    "flow_ssr_sidebar_expand=1;"
    "biz_trace_id=306a579f;"
    "ttwid=1%7CUp_enoKzvr8z7uWMxpb5ckIid2zrjySmaNwUWKrZwfw%7C1783271083%7C0270da7de60f1bef34875ca4e732e561bd2ee2608ec840e6011d229b65cbafa4"
)

# URL 解码 Cookie 值
import urllib.parse
decoded_cookies = []
for part in COOKIE_STR.split(";"):
    part = part.strip()
    if "=" in part:
        k, v = part.split("=", 1)
        decoded_cookies.append(f"{k}={urllib.parse.unquote(v)}")
DECODED_COOKIE = "; ".join(decoded_cookies)

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
    url = f"https://www.doubao.com{samantha/{endpoint}?{qs}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://www.doubao.com",
        "Referer": "https://www.doubao.com/",
        "Cookie": DECODED_COOKIE,
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

print("=" * 70)
print("豆包 完整 Cookie 测试")
print("=" * 70)
print(f"Cookie 长度: {len(DECODED_COOKIE)}")
print()

# 测试 1: video/get_play_info（最重要）
print("=== 测试1: /samantha/video/get_play_info ===")
body, status = call("video/get_play_info", "POST", {"vid": VIDEO_ID})
print(f"  HTTP Status: {status}")
print(f"  响应长度: {len(body)} 字符")
print()

try:
    resp = json.loads(body)
    code = resp.get("code", -1)
    msg = resp.get("msg", "")
    print(f"  code={code} msg={msg}")
    
    if code == 0:
        data = resp.get("data", {})
        play_infos = data.get("play_infos", [])
        print(f"  play_infos 数量: {len(play_infos)}")
        
        if play_infos:
            pi = play_infos[0]
            main_url = pi.get("main", "")
            print(f"  play_infos[0].main URL 前 300 字符:")
            print(f"    {main_url[:300]}")
            print()
            print(f"  URL 含 lr=: {'lr=' in main_url}")
            if "lr=" in main_url:
                lr_match = re.search(r"[?&]lr=([^&]+)", main_url)
                print(f"  lr 值: {lr_match.group(1) if lr_match else '未提取'}")
            
            # 保存完整 URL
            with open("/Users/hope/Desktop/幻影空间/video_get_play_info_main_url.txt", "w") as f:
                f.write(main_url)
            print(f"  完整 URL 已保存到 video_get_play_info_main_url.txt")
        
        # 打印完整响应
        print(f"\n  完整响应:")
        print(f"  {json.dumps(resp, ensure_ascii=False, indent=2)[:3000]}")
        
    elif code == 710012001:
        print(f"  [!] 仍然登录过期！sessionid 可能已失效或需要其他字段")
        print(f"  响应: {body[:500]}")
        
except json.JSONDecodeError:
    print(f"  非 JSON 响应: {body[:500]}")

# 测试 2: media/get_play_info（对比）
print("\n=== 测试2: /samantha/media/get_play_info（对比） ===")
body2, status2 = call("media/get_play_info", "POST", {"key": VIDEO_ID, "vid": VIDEO_ID})
print(f"  HTTP Status: {status2}")
try:
    resp2 = json.loads(body2)
    code2 = resp2.get("code", -1)
    print(f"  code={code2}")
    if code2 == 0:
        data2 = resp2.get("data", {})
        mi = data2.get("media_info", [{}])[0].get("main_url", "")
        om = data2.get("original_media_info", {}).get("main_url", "")
        print(f"  media_info main_url 含 lr: {'lr=' in mi}")
        print(f"  original_media_info main_url 含 lr: {'lr=' in om}")
        print(f"  两个 URL 相同: {mi == om}")
        if mi != om:
            print(f"  [!!!] 两个 URL 不同！")
            print(f"    media: {mi[:150]}")
            print(f"    origin: {om[:150]}")
except Exception as e:
    print(f"  解析失败: {e}")

print("\n" + "=" * 70)
print("结论：")
if status == 200 and "code=0" in body:
    print("  [+] video/get_play_info 调通了！")
    print("     查看上面的 play_infos 响应，确认是否有无水印 URL")
else:
    print("  [-] video/get_play_info 仍然返回登录过期")
    print("     可能需要从浏览器 DevTools 的 Network 标签直接复制完整请求（含所有 Header）")
print("=" * 70)
