#!/usr/bin/env python3
"""
使用Playwright直接捕获豆包页面发出的API调用
专门设计用于找到original_media_info等隐藏字段
"""
import asyncio
import json
from playwright.async_api import async_playwright

async def capture_real_api_calls():
    """捕获豆包页面真实的网络请求"""
    
    # 使用之前分析中提到的实际参数
    video_id = "v0269cg10004d946i5iljhtf2dunr5e0"
    share_id = "49152711347982082"
    
    share_url = f"https://www.doubao.com/video-sharing?source_type=mobile&share_id={share_id}&video_id={video_id}"
    
    print(f"🎯 开始捕获豆包页面真实API调用\n")
    print(f"目标页面: {share_url}")
    
    api_responses = []
    
    async with async_playwright() as p:
        # 启动有界面的浏览器以便观察
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 拦截所有网络请求
        async def handle_request(request):
            if any(key in request.url for key in ['media', 'video', 'play_info']):
                print(f"🔍 拦截到请求: {request.url}")
        
        async def handle_response(response):
            # 只关注API相关响应
            if any(key in response.url for key in ['media', 'video', 'play_info', '/samantha/']):
                print(f"📋 捕获到响应: {response.url}")
                
                try:
                    # 检查响应内容
                    content_type = response.headers.get('content-type', '')
                    
                    if 'application/json' in content_type:
                        json_data = await response.json()
                        print(f"   ✅ JSON响应，大小: {len(str(json_data))} 字符")
                        
                        api_responses.append({
                            'url': response.url,
                            'method': response.request.method,
                            'data': json_data
                        })
                        
                        # 保存响应到文件
                        filename = f"captured_api_response_{len(api_responses)}.json"
                        with open(filename, 'w', encoding='utf-8') as f:
                            json.dump(json_data, f, ensure_ascii=False, indent=2)
                        print(f"   💾 已保存到 {filename}")
                        
                        # 分析这个响应
                        analyze_for_unwatermark(json_data)
                    else:
                        print(f"   ⚠️ 非JSON响应: {content_type}")
                        
                        # 即使不是JSON，也检查是否有URL
                        text = await response.text()
                        if len(text) < 100000:  # 限制大响应
                            find_urls_in_text(text)
                
                except Exception as e:
                    print(f"   ❌ 解析响应失败: {e}")
        
        # 注册拦截器
        page.on('request', handle_request)
        page.on('response', handle_response)
        
        try:
            print(f"\n🌐 正在加载页面...")
            await page.goto(share_url, wait_until='networkidle')
            
            print(f"\n📊 页面加载完成，暂停3秒等待动态内容...")
            await asyncio.sleep(3)
            
            print(f"\n🎮 正在查找并点击视频播放器...")
            
            # 查找video元素或播放按钮
            video_selectors = [
                'video',
                '.video-player',
                '[class*="video" i]',
                '[class*="play" i]',
                'div:has-text("play")',
                'button:has-text("play")'
            ]
            
            for selector in video_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        print(f"   找到元素: {selector}")
                        await element.click()
                        print(f"   已点击")
                        await asyncio.sleep(2)
                        break
                except Exception as e:
                    print(f"   点击 {selector} 失败: {e}")
            
            print(f"\n⏸️ 暂停5秒等待API调用...")
            await asyncio.sleep(5)
            
            print(f"\n📈 共捕获到 {len(api_responses)} 个API响应")
            
            # 主动触发更详细的API调用
            print(f"\n🚀 尝试直接调用页面API...")
            
            try:
                # 执行JavaScript来触发API
                result = await page.evaluate(f"""
                    (async () => {{
                        try {{
                            const response = await fetch('/samantha/media/get_play_info?video_id={video_id}', {{
                                method: 'POST',
                                headers: {{
                                    'Content-Type': 'application/json',
                                    'Referer': window.location.href,
                                    'Accept': 'application/json'
                                }},
                                body: JSON.stringify({{
                                    video_id: '{video_id}',
                                    key: '{video_id}'
                                }})
                            }});
                            
                            if (response.ok) {{
                                const data = await response.json();
                                console.log('Page JS API Response:', data);
                                return data;
                            }} else {{
                                console.log('API调用失败:', response.status);
                                return null;
                            }}
                        }} catch (e) {{
                            console.error('API调用异常:', e);
                            return null;
                        }}
                    }})()
                """)
                
                if result:
                    print(f"✅ 页面JS调用成功！")
                    analyze_for_unwatermark(result)
                    
                    # 保存这个重要结果
                    with open('page_js_api_result.json', 'w') as f:
                        json.dump(result, f, ensure_ascii=False, indent=2)
            
            except Exception as e:
                print(f"❌ 页面JS调用失败: {e}")
                
        except Exception as e:
            print(f"❌ 浏览器操作失败: {e}")
        
        finally:
            print(f"\n🔚 关闭浏览器...")
            await browser.close()

def analyze_for_unwatermark(data):
    """专门查找无水印数据"""
    print(f"\n🔍 分析查找无水印数据...")
    
    found_fields = []
    
    def scan(obj, path=""):
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                
                # 1. 匹配关键字段名
                if any(unwater in key.lower() for unwater in [
                    'original', 'raw', 'clean', 'no_watermark', 
                    'unwatermark', 'watermark_free'
                ]):
                    found_fields.append({
                        'path': current_path,
                        'key': key,
                        'value': value,
                        'type': 'special_field'
                    })
                    print(f"   🎯 发现特殊字段 [{current_path}]: {str(value)[:100]}")
                
                # 2. 匹配URL内容
                if isinstance(value, str) and 'http' in value:
                    if 'doubao' in value and any(target in value for target in [
                        'unwatermark', 'no_watermark', 'original', 'raw'
                    ]):
                        found_fields.append({
                            'path': current_path,
                            'key': key,
                            'value': value,
                            'type': 'unwatermark_url'
                        })
                        print(f"   💥 发现无水印URL: {value}")
                    
                    elif 'lr=' in value:
                        if 'watermark' in value:
                            print(f"   ❌ 带水印URL参数: lr={value.split('lr=')[1].split('&')[0]}")
                        else:
                            print(f"   💭 可能无水印URL: {value}")
                
                # 3. 递归扫描
                if isinstance(value, (dict, list)):
                    scan(value, current_path)
        
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                scan(item, f"{path}[{i}]")
    
    scan(data)
    
    if found_fields:
        print(f"\n📊 总共发现 {len(found_fields)} 个相关字段")
        
        # 保存到文件
        with open('unwatermark_candidates.json', 'w') as f:
            json.dump(found_fields, f, ensure_ascii=False, indent=2)
    else:
        print(f"   ❌ 未发现无水印相关字段")

def find_urls_in_text(text):
    """在文本中找URL"""
    import re
    
    urls = re.findall(r'https://[^