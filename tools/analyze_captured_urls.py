#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析小程序抓包的URL与API返回的URL的区别
找出小程序如何获取 lr=unwatermarked 的URL
"""

import re
from urllib.parse import urlparse, parse_qs

print("="*70)
print("🔍 分析URL差异")
print("="*70)

# 小程序抓包的URL（有 lr=unwatermarked）
captured_url1 = "https://v26-videoweb.doubao.com/80b097246098da163a741ca8c573a3aa/6a49555e/video/tos/cn/tos-cn-v-9ecd54/oI4EIRKSI1lD1ex0AyvAILhcsJEAaI3Q499PrA/?a=497858&ch=0&cr=7&dr=0&er=0&lr=unwatermarked&net=5&cd=0%7C0%7C0%7C1&cv=1&br=887&bt=887&cs=4&ds=4&ft=p9XzxyknffPdOW~-N12NvAq-fXzdPrKWrXkuRkatofGSejVhWL6&mime_type=video_mp4&qs=0&rc=OWhmZTVlN2hpODw1Zzg3aUBpMzhxZ2lrbzg5PDczNGY5M0BhMDAuNGM0XzUxLV8yXi80YSNib3IvcWdmZjFhLS1kNi9zcw%3D%3D&btag=80000e00008000&dy_q=1783187273&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=20260705014753A21164F3336294831FE2"

captured_url2 = "https://v9-videoweb.doubao.com/95de289192c9cec24c8d98ac0283680c/6a4959aa/video/tos/cn/tos-cn-v-9ecd54/oItZeSQQIeWpNXSBFJyxVAjxkGR6JOUgIDHqEL/?a=497858&ch=0&cr=7&dr=0&er=0&lr=unwatermarked&net=5&cd=0%7C0%7C0%7C1&cv=1&br=918&bt=918&cs=4&ds=4&ft=p9XzxyknffPdOW~-N12NvAq-fXzdPrKYbXkuRkatofGSejVhWL6&mime_type=video_mp4&qs=0&rc=PGg5aGY4Mzo6Ojc2ZWUzaEBpajhzazhrbzRuPDczNGY5M0BhMzQyLjU0NTUxNC41MGNjYSNlLWNrcWdmZjFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783188373&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=2026070502061305AEBB606EC8D182E129"

# API返回的URL（有 lr=video_gen_watermark_dyn）
api_url = "https://v26-videoweb.doubao.com/676a69d24fadbc8b452725e8cb4b30dd/6a4a9ead/video/tos/cn/tos-cn-v-9ecd54/o4IQDED9Ii1IJRubRUs6AeJ04gA4aQXmoIKtvk/?a=497858&ch=0&cr=0&dr=0&er=0&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C0&cv=1&br=2549&bt=2549&cs=0&ds=3&ft=vTVAHK~cBBkq8ZmopmNvk_vjVQWw&mime_type=video_mp4&qs=0&rc=Nzk8ZDplZDxnOjpoMzMzZ0Bpajc1NzVrb3g5PDczNGY5M0AzLWE2YmA1Ni8xNDNhMjNeYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=c0000e00008000&dy_q=1783179111&feature_id=e38567d78da7ae34faf3833d9e13c66f&l=2026070423315099A6934620BF31D50347&download=true"

print("\n【对比1】小程序URL #1")
print("-"*70)
parsed1 = urlparse(captured_url1)
params1 = parse_qs(parsed1.query)

print(f"视频ID路径: {parsed1.path.split('/')[-2]}")
print(f"lr: {params1.get('lr', ['N/A'])[0]}")
print(f"cr: {params1.get('cr', ['N/A'])[0]}")
print(f"net: {params1.get('net', ['N/A'])[0]}")
print(f"cd: {params1.get('cd', ['N/A'])[0]}")
print(f"btag: {params1.get('btag', ['N/A'])[0]}")

print("\n【对比2】小程序URL #2")
print("-"*70)
parsed2 = urlparse(captured_url2)
params2 = parse_qs(parsed2.query)

print(f"视频ID路径: {parsed2.path.split('/')[-2]}")
print(f"lr: {params2.get('lr', ['N/A'])[0]}")
print(f"cr: {params2.get('cr', ['N/A'])[0]}")
print(f"net: {params2.get('net', ['N/A'])[0]}")
print(f"cd: {params2.get('cd', ['N/A'])[0]}")
print(f"btag: {params2.get('btag', ['N/A'])[0]}")

print("\n【对比3】API返回的URL")
print("-"*70)
parsed_api = urlparse(api_url)
params_api = parse_qs(parsed_api.query)

print(f"视频ID路径: {parsed_api.path.split('/')[-2]}")
print(f"lr: {params_api.get('lr', ['N/A'])[0]}")
print(f"cr: {params_api.get('cr', ['N/A'])[0]}")
print(f"net: {params_api.get('net', ['N/A'])[0]}")
print(f"cd: {params_api.get('cd', ['N/A'])[0]}")
print(f"btag: {params_api.get('btag', ['N/A'])[0]}")

print("\n" + "="*70)
print("📊 关键差异分析")
print("="*70)

print("\n1. lr参数:")
print(f"   小程序: unwatermarked")
print(f"   API:    video_gen_watermark_dyn")

print("\n2. cr参数:")
print(f"   小程序: 7")
print(f"   API:    0")

print("\n3. net参数:")
print(f"   小程序: 有 (net=5)")
print(f"   API:    无")

print("\n4. cd参数:")
print(f"   小程序: 0|0|0|1")
print(f"   API:    0|0|0|0")

print("\n5. btag参数:")
print(f"   小程序: 80000e00008000")
print(f"   API:    c0000e00008000")

print("\n6. 视频ID哈希:")
print(f"   小程序URL1: oI4EIRKSI1lD1ex0AyvAILhcsJEAaI3Q499PrA")
print(f"   小程序URL2: oItZeSQQIeWpNXSBFJyxVAjxkGR6JOUgIDHqEL")
print(f"   API URL:    o4IQDED9Ii1IJRubRUs6AeJ04gA4aQXmoIKtvk")
print(f"   ⚠️ 注意：所有三个URL的视频ID哈希都不同！")

print("\n" + "="*70)
print("💡 关键发现")
print("="*70)

print("""
1. 小程序的URL不是简单地修改lr参数得到的
2. 小程序的URL包含特殊的参数签名（cr, net, cd, btag等）
3. 视频ID的哈希部分完全不同
4. 这些参数很可能是通过特殊的API生成的

结论：
- 直接修改lr参数无效（CDN会验证签名）
- 必须找到小程序调用的API端点
- 该API会返回带有正确签名的 lr=unwatermarked URL
""")

print("\n" + "="*70)
print("🎯 下一步行动")
print("="*70)

print("""
请在抓包中查找：

1. 小程序在下载视频前调用的API
   - 可能是 /parse、/get_url、/download 等
   - 查找返回这些URL的请求

2. 关键Headers
   - 可能有特殊的 Authorization
   - 可能有 X-Miniprogram-* 开头的headers
   - 可能有特殊的 Cookie

3. 请求体
   - 可能包含 watermark: false
   - 可能包含 type: "unwatermarked"

请分享：
- 小程序调用的完整API请求（不是视频URL）
- 该API的响应内容
- 所有的Headers和参数
""")
