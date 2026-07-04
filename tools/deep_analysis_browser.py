#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
豆包视频去水印 - 深度浏览器级分析
使用Selenium模拟真实浏览器行为，捕获所有网络请求
测试日期：2026-07-04
"""

import time
import json
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

VIDEO_URL = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"
VIDEO_ID = "v0d69cg10004d946nuiljht2d4d2v44g"

def setup_driver_with_logging():
    """配置Chrome驱动，启用网络日志"""
    chrome_options = Options()
    
    # 启用性能日志来捕获网络请求
    chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    
    # 可选：无头模式
    # chrome_options.add_argument('--headless')
    
    # 禁用一些安全特性以便测试
    chrome_options.add_argument('--disable-web-security')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # 设置User-Agent
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except Exception as e:
        print(f"❌ 无法启动Chrome驱动: {e}")
        print("\n提示：需要安装ChromeDriver")
        print("安装方法：")
        print("  1. brew install chromedriver")
        print("  2. 或从 https://chromedriver.chromium.org/ 下载")
        return None


def extract_network_logs(driver):
    """从浏览器性能日志中提取网络请求"""
    logs = driver.get_log('performance')
    network_requests = []
    
    for entry in logs:
        try:
            log = json.loads(entry['message'])['message']
            
            # 只关注网络相关的日志
            if 'Network' in log['method']:
                network_requests.append(log)
        except:
            continue
    
    return network_requests


def analyze_video_requests(network_requests):
    """分析网络请求，查找视频相关的URL"""
    video_urls = []
    api_calls = []
    
    for req in network_requests:
        method = req.get('method', '')
        params = req.get('params', {})
        
        # 提取请求URL
        if method == 'Network.requestWillBeSent':
            url = params.get('request', {}).get('url', '')
            request_method = params.get('request', {}).get('method', '')
            
            # 视频文件请求
            if '.mp4' in url or '.m3u8' in url:
                video_urls.append({
                    'url': url,
                    'method': request_method,
                    'type': 'video'
                })
                print(f"\n🎬 发现视频URL:")
                print(f"   {url[:150]}...")
                
                # 分析URL参数
                if 'lr=' in url:
                    lr_match = re.search(r'lr=([^&]+)', url)
                    if lr_match:
                        print(f"   lr参数: {lr_match.group(1)}")
            
            # API调用
            elif 'doubao.com' in url and any(keyword in url for keyword in ['media', 'video', 'play', 'samantha']):
                api_calls.append({
                    'url': url,
                    'method': request_method,
                    'type': 'api'
                })
                print(f"\n📡 API调用: {request_method} {url[:100]}...")
        
        # 提取响应
        elif method == 'Network.responseReceived':
            response = params.get('response', {})
            url = response.get('url', '')
            status = response.get('status', 0)
            headers = response.get('headers', {})
            
            if '.mp4' in url:
                etag = headers.get('etag', headers.get('ETag', 'N/A'))
                content_length = headers.get('content-length', headers.get('Content-Length', 'N/A'))
                print(f"\n📦 视频响应:")
                print(f"   状态: {status}")
                print(f"   ETag: {etag}")
                print(f"   大小: {content_length}")
    
    return video_urls, api_calls


def inject_js_interceptor(driver):
    """注入JavaScript拦截器，hook fetch和XHR"""
    interceptor_js = """
    // 存储捕获的请求
    window.capturedRequests = [];
    
    // Hook fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        window.capturedRequests.push({
            type: 'fetch',
            url: url,
            timestamp: Date.now()
        });
        
        return originalFetch.apply(this, args).then(response => {
            // 克隆响应以便读取
            const clonedResponse = response.clone();
            
            // 尝试读取JSON响应
            clonedResponse.json().then(data => {
                if (data && typeof data === 'object') {
                    // 查找视频URL
                    const jsonStr = JSON.stringify(data);
                    const videoUrls = jsonStr.match(/https:\\/\\/[^"]+\\.mp4[^"]*/g);
                    if (videoUrls) {
                        window.capturedRequests.push({
                            type: 'fetch_response',
                            url: url,
                            videoUrls: videoUrls,
                            timestamp: Date.now()
                        });
                    }
                }
            }).catch(() => {});
            
            return response;
        });
    };
    
    // Hook XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        this._method = method;
        return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
            try {
                const data = JSON.parse(this.responseText);
                const jsonStr = JSON.stringify(data);
                const videoUrls = jsonStr.match(/https:\\/\\/[^"]+\\.mp4[^"]*/g);
                
                if (videoUrls) {
                    window.capturedRequests.push({
                        type: 'xhr_response',
                        url: this._url,
                        method: this._method,
                        videoUrls: videoUrls,
                        timestamp: Date.now()
                    });
                }
            } catch(e) {}
        });
        
        window.capturedRequests.push({
            type: 'xhr',
            url: this._url,
            method: this._method,
            timestamp: Date.now()
        });
        
        return originalSend.apply(this, args);
    };
    
    console.log('🔍 拦截器已注入');
    """
    
    driver.execute_script(interceptor_js)
    print("✅ JavaScript拦截器已注入")


def get_captured_requests(driver):
    """获取JavaScript拦截器捕获的请求"""
    try:
        requests = driver.execute_script("return window.capturedRequests || [];")
        return requests
    except:
        return []


def test_local_storage_and_cookies(driver):
    """检查LocalStorage和Cookie中是否有特殊数据"""
    print("\n\n=== 📦 检查浏览器存储 ===")
    
    # 检查LocalStorage
    try:
        local_storage = driver.execute_script("""
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                items[key] = localStorage.getItem(key);
            }
            return items;
        """)
        
        print("\n📂 LocalStorage内容:")
        for key, value in local_storage.items():
            if len(value) > 200:
                value = value[:200] + '...'
            print(f"  {key}: {value}")
    except Exception as e:
        print(f"  无法读取LocalStorage: {e}")
    
    # 检查Cookies
    try:
        cookies = driver.get_cookies()
        print(f"\n🍪 找到 {len(cookies)} 个Cookies:")
        for cookie in cookies:
            print(f"  {cookie['name']}: {cookie['value'][:50]}...")
    except Exception as e:
        print(f"  无法读取Cookies: {e}")


def main():
    """主函数"""
    print("=" * 70)
    print("豆包视频去水印 - 深度浏览器级分析")
    print("=" * 70)
    print(f"目标URL: {VIDEO_URL}")
    print(f"视频ID: {VIDEO_ID}")
    print("=" * 70)
    
    # 启动浏览器
    driver = setup_driver_with_logging()
    if not driver:
        return
    
    try:
        print("\n🌐 正在访问页面...")
        driver.get(VIDEO_URL)
        
        # 注入拦截器（在页面加载前）
        inject_js_interceptor(driver)
        
        # 等待页面加载
        print("⏳ 等待页面加载...")
        time.sleep(5)
        
        # 尝试查找视频元素
        print("\n\n=== 🎥 查找页面视频元素 ===")
        try:
            video_elements = driver.find_elements(By.TAG_NAME, 'video')
            print(f"找到 {len(video_elements)} 个video元素")
            
            for i, video in enumerate(video_elements):
                src = video.get_attribute('src')
                poster = video.get_attribute('poster')
                print(f"\nVideo {i+1}:")
                print(f"  src: {src}")
                print(f"  poster: {poster}")
        except Exception as e:
            print(f"无法查找video元素: {e}")
        
        # 检查浏览器存储
        test_local_storage_and_cookies(driver)
        
        # 提取网络日志
        print("\n\n=== 📊 分析网络请求 ===")
        network_requests = extract_network_logs(driver)
        print(f"捕获到 {len(network_requests)} 个网络事件")
        
        video_urls, api_calls = analyze_video_requests(network_requests)
        
        # 获取JavaScript拦截的请求
        print("\n\n=== 🔍 JavaScript拦截器结果 ===")
        js_requests = get_captured_requests(driver)
        print(f"拦截到 {len(js_requests)} 个请求")
        
        video_urls_from_js = set()
        for req in js_requests:
            if 'videoUrls' in req:
                for url in req['videoUrls']:
                    video_urls_from_js.add(url)
                    print(f"\n🎬 从API响应中提取的视频URL:")
                    print(f"   {url[:150]}...")
        
        # 尝试点击下载按钮（如果存在）
        print("\n\n=== 🔘 尝试查找下载按钮 ===")
        try:
            download_buttons = driver.find_elements(By.XPATH, "//*[contains(text(), '下载') or contains(text(), 'download')]")
            print(f"找到 {len(download_buttons)} 个可能的下载按钮")
            
            for i, btn in enumerate(download_buttons):
                print(f"\n按钮 {i+1}:")
                print(f"  文本: {btn.text}")
                print(f"  标签: {btn.tag_name}")
                # 注意：不实际点击，以免触发下载
        except Exception as e:
            print(f"无法查找下载按钮: {e}")
        
        # 总结发现
        print("\n\n" + "=" * 70)
        print("📋 分析总结")
        print("=" * 70)
        print(f"✅ 捕获的视频URL总数: {len(video_urls)}")
        print(f"✅ 捕获的API调用数: {len(api_calls)}")
        print(f"✅ JS拦截的视频URL: {len(video_urls_from_js)}")
        
        # 去重并显示所有唯一的视频URL
        all_urls = set()
        for v in video_urls:
            all_urls.add(v['url'])
        all_urls.update(video_urls_from_js)
        
        if all_urls:
            print(f"\n🎯 发现 {len(all_urls)} 个唯一的视频URL:")
            for url in all_urls:
                print(f"\n  {url}")
                
                # 检查lr参数
                if 'lr=' in url:
                    lr_match = re.search(r'lr=([^&]+)', url)
                    if lr_match:
                        lr_value = lr_match.group(1)
                        print(f"    ➜ lr参数: {lr_value}")
                        
                        if lr_value != 'video_gen_watermark_dyn':
                            print(f"    ⚠️ 注意：lr参数不是 video_gen_watermark_dyn!")
        else:
            print("\n❌ 未发现任何视频URL")
        
        # 保持浏览器打开以便手动检查
        print("\n💡 浏览器将保持打开30秒，您可以手动检查...")
        print("   按Ctrl+C可提前结束")
        time.sleep(30)
        
    except KeyboardInterrupt:
        print("\n\n⚠️ 用户中断")
    except Exception as e:
        print(f"\n\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n🔚 关闭浏览器...")
        driver.quit()


if __name__ == "__main__":
    print("\n⚠️ 注意事项:")
    print("1. 需要安装 selenium: pip install selenium")
    print("2. 需要安装 ChromeDriver: brew install chromedriver")
    print("3. 首次运行可能需要在系统设置中允许ChromeDriver运行")
    print("4. 如果需要测试登录用户，请手动登录后再次运行")
    print("\n按Enter继续...")
    input()
    
    main()
