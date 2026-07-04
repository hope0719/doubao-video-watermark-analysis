#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 另类方法探索
探索我们还没有尝试过的可能性
"""

import requests
import json
import re

VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"
SHARE_URL = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"

print("="*70)
print("🔍 探索另类方法")
print("="*70)

# 方向1: 抓取真实用户的Cookie，测试登录态
print("\n\n【方向1】使用真实登录态")
print("-"*70)
print("⚠️ 重要：如果你是视频创作者本人，可能有特殊下载权限")
print("\n操作步骤:")
print("1. 在浏览器中登录豆包账号")
print("2. 按F12打开开发者工具")
print("3. 切换到Network标签")
print("4. 刷新视频页面")
print("5. 找到 get_play_info 请求")
print("6. 复制完整的Cookie")
print("\n如果你有Cookie，请粘贴到下方测试:")
print("(留空则跳过)")

# 这里应该让用户输入，但为了自动化，我们先跳过
user_cookie = ""  # 用户可以在这里粘贴Cookie

if user_cookie:
    print("\n测试带登录态的请求...")
    api_url = "https://www.doubao.com/samantha/media/get_play_info"
    
    headers = {
        'Content-Type': 'application/json',
        'Cookie': user_cookie,
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    params = {
        'version_code': '20800',
        'device_platform': 'web',
        'aid': '497858',
    }
    
    try:
        response = requests.post(
            api_url,
            params=params,
            headers=headers,
            json={'key': VIDEO_ID},
            timeout=10
        )
        
        data = response.json()
        if 'data' in data:
            video_url = data['data']['original_media_info']['main_url']
            print(f"✅ 获取到视频URL")
            print(f"   {video_url[:100]}...")
            
            # 检查lr参数
            if 'lr=' in video_url:
                lr_match = re.search(r'lr=([^&]+)', video_url)
                if lr_match:
                    lr_value = lr_match.group(1)
                    print(f"   lr参数: {lr_value}")
                    
                    if lr_value != 'video_gen_watermark_dyn':
                        print("   🎉 lr参数不同！可能是无水印版本！")
    except Exception as e:
        print(f"❌ 错误: {e}")
else:
    print("⏭️ 跳过登录态测试（未提供Cookie）")


# 方向2: 搜索豆包官方的导出/下载功能
print("\n\n【方向2】查找官方导出功能")
print("-"*70)
print("说明：豆包可能提供官方的导出功能给创作者")
print("\n可能的位置:")
print("1. 视频详情页的「...」菜单")
print("2. 创作中心 -> 我的作品")
print("3. 账号设置 -> 数据导出")
print("\n如果你能找到官方导出功能，它可能提供无水印版本")


# 方向3: 测试抖音底层API
print("\n\n【方向3】测试抖音底层API")
print("-"*70)
print("豆包视频可能托管在抖音的CDN上")
print("尝试使用抖音的API端点...")

# 抖音相关的API端点
douyin_apis = [
    "https://www.douyin.com/aweme/v1/play/",
    "https://aweme.snssdk.com/aweme/v1/play/",
]

print("\n测试中...")
for api in douyin_apis:
    try:
        # 尝试构造抖音风格的请求
        test_url = f"{api}?video_id={VIDEO_ID}"
        resp = requests.get(test_url, timeout=5)
        print(f"\n{api}")
        print(f"  状态: {resp.status_code}")
        if resp.status_code == 200:
            print(f"  响应: {resp.text[:100]}")
    except Exception as e:
        print(f"\n{api}")
        print(f"  错误: {e}")


# 方向4: 分析视频生成参数
print("\n\n【方向4】分析视频生成参数")
print("-"*70)
print("如果我们知道视频的生成参数，可能可以重新生成无水印版本")

# 尝试获取视频的创建信息
creation_apis = [
    "https://www.doubao.com/samantha/creation/get_video_info",
    "https://www.doubao.com/samantha/video/get_creation_params",
]

print("\n查询视频创建信息...")
for api in creation_apis:
    try:
        resp = requests.post(
            api,
            json={'video_id': VIDEO_ID},
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        print(f"\n{api}")
        print(f"  状态: {resp.status_code}")
        if resp.status_code == 200:
            print(f"  响应: {resp.text[:200]}")
    except Exception as e:
        print(f"\n{api}")
        print(f"  错误: {e}")


# 方向5: WebSocket连接
print("\n\n【方向5】WebSocket实时推送")
print("-"*70)
print("豆包可能使用WebSocket推送视频生成状态")
print("在视频生成过程中，可能推送临时的无水印URL")
print("\n⚠️ 这需要抓取视频生成时的WebSocket连接")
print("建议操作:")
print("1. 在豆包上创建一个新视频")
print("2. 在生成过程中，使用浏览器DevTools的WS标签")
print("3. 监听所有WebSocket消息")
print("4. 查找包含视频URL的消息")


# 方向6: 分析豆包桌面应用
print("\n\n【方向6】分析桌面应用/移动应用")
print("-"*70)
print("豆包的桌面/移动应用可能有不同的API")
print("\n建议:")
print("1. 下载豆包桌面应用（Mac/Windows）")
print("2. 使用抓包工具（Charles/Fiddler）")
print("3. 在应用中播放/下载视频")
print("4. 查看应用使用的实际API和参数")
print("\n移动端:")
print("1. 安装豆包iOS/Android应用")
print("2. 使用HTTP Toolkit或类似工具抓包")
print("3. 对比移动端API是否有不同")


# 方向7: 搜索泄露的内部API文档
print("\n\n【方向7】搜索内部API文档")
print("-"*70)
print("使用搜索引擎查找可能泄露的API文档")

search_queries = [
    "豆包 API 文档 site:github.com",
    "doubao api documentation",
    "豆包视频下载 internal api",
    "字节跳动 豆包 开发者文档",
]

print("\n建议搜索:")
for q in search_queries:
    print(f"  - {q}")


# 方向8: 社区求助
print("\n\n【方向8】向成功者求助")
print("-"*70)
print("既然有人成功去水印了，可以：")
print("\n1. 在相关论坛/社区发帖询问")
print("   - V2EX")
print("   - GitHub Issues")
print("   - 知乎")
print("   - Reddit r/howtocn")
print("\n2. 询问具体方法和步骤")
print("3. 请求分享他们下载的无水印视频样本")
print("4. 对比MD5哈希，确认是否真的无水印")


# 方向9: AI去水印（后期处理）
print("\n\n【方向9】AI后期去水印")
print("-"*70)
print("如果无法获取原始无水印视频，可以使用AI技术")
print("\n推荐工具:")
print("1. Video Watermark Remover AI")
print("2. Inpaint (图片/视频修复)")
print("3. Runway ML")
print("4. 自建模型（使用DeepFill/LaMa等算法）")
print("\n⚠️ 注意：会有画质损失")


# 方向10: 联系豆包官方
print("\n\n【方向10】联系官方支持")
print("-"*70)
print("最直接的方法：")
print("\n1. 如果你是视频创作者，联系豆包客服")
print("2. 询问是否提供无水印导出功能")
print("3. 说明你的使用场景（教育、研究等）")
print("4. 可能需要VIP会员或创作者认证")


print("\n\n" + "="*70)
print("💡 关键洞察")
print("="*70)
print("""
基于所有测试，我们确认：
1. ✅ 公开API确实只返回带水印版本
2. ✅ 所有URL参数修改都无效
3. ❓ 但以下可能性还未完全排除：

   A. 登录用户/VIP用户有特殊权限
      → 需要真实Cookie测试
   
   B. 创作者本人有特殊下载权限
      → 需要创作者账号测试
   
   C. 移动应用使用不同的API
      → 需要抓包移动应用
   
   D. 视频生成时的临时URL
      → 需要在生成过程中抓包
   
   E. 内部API端点
      → 需要找到内部文档或逆向工程

如果有人声称成功去水印，请务必：
1. 让他们提供具体的操作步骤
2. 分享下载的视频样本
3. 计算MD5，对比是否真的不同
4. 确认不是图片去水印（图片可以去，视频不行）
""")

print("\n" + "="*70)
print("🎯 下一步行动建议")
print("="*70)
print("""
1. 【最重要】如果你是创作者，用你的账号测试
   → 登录后重新运行测试脚本
   
2. 在浏览器中手动操作，查看是否有「导出」按钮
   → 官方功能最可靠
   
3. 使用抓包工具分析移动应用
   → 可能有不同的API
   
4. 联系声称成功的人，要求详细步骤
   → 验证是否真的成功
   
5. 如果确实无法获取，考虑AI后期处理
   → 实用主义解决方案
""")

print("\n📧 需要帮助？")
print("如果你能提供以下信息，我可以继续协助：")
print("1. 你的豆包账号Cookie（如果你是创作者）")
print("2. 声称成功者的具体方法描述")
print("3. 移动应用的抓包记录")
print("4. 任何新发现的API端点")
