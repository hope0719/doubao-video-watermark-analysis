#!/usr/bin/env python3
# 浏览器环境数据抓取工具
# 在真实浏览器环境中捕获解密后的视频数据

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import json
import re

class BrowserCaptureTool:
    """
    浏览器环境视频数据抓取工具
    在真实Web环境中捕获页面解密后的视频信息
    """
    
    def __init__(self):
        self.driver = None
        self.setup_browser()
    
    def setup_browser(self):
        """配置浏览器环境"""
        
        chrome_options = Options()
        # chrome_options.add_argument('--headless')  # 首先不使用headless模式调试
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        # 启用性能日志来捕获网络请求
        chrome_options.set_capability('goog:loggingPrefs', {
            'performance': 'ALL',
            'browser': 'ALL'
        })
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            print("✅ 浏览器环境设置成功")
        except Exception as e:
            print(f"❌ 浏览器设置失败: {e}")
            print("请确保已安装Chrome和ChromeDriver")
    
    def capture_page_data(self, share_url):
        """在浏览器中捕获页面数据"""
        
        if not self.driver:
            print("❌ 浏览器未成功初始化")
            return None
        
        print(f"🌐 访问页面: {share_url}")
        
        try:
            # 打开页面
            self.driver.get(share_url)
            print(f"⏳ 等待页面加载...")
            
            # 等待页面稳定 (可根据实际情况调整)
            time.sleep(5)
            
            # 捕获多种类型的数据
            results = {
                'page_source': self.driver.page_source,
                'video_elements': self.capture_video_elements(),
                'network_logs': self.capture_network_logs(),
                'js_variables': self.capture_js_variables(),
                'cookies': self.capture_cookies(),
                'local_storage': self.capture_local_storage()
            }
            
            print(f"✅ 数据捕获完成")
            return results
            
        except Exception as e:
            print(f"❌ 页面捕获失败: {e}")
            return None
    
    def capture_video_elements(self):
        """捕获页面中的视频元素"""
        
        video_data = []
        
        try:
            # 等待可能存在的视频元素加载
            wait = WebDriverWait(self.driver, 10)
            
            # 寻找不同类型的视频元素
            video_selectors = [
                'video',
                '[data-video]',
                '.video-player',
                '#videoContainer',
                '[class*="video"]',
                'source[type*="video"]'
            ]
            
            for selector in video_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    for element in elements:
                        video_info = {
                            'selector': selector,
                            'tag_name': element.tag_name,
                            'attributes': self.get_element_attributes(element),
                            'text': element.text,
                            'rect': element.rect
                        }
                        
                        # 尝试获取src属性
                        src = element.get_attribute('src')
                        if src:
                            video_info['src'] = src
                        
                        # 对于video标签，尝试获取source标签
                        if element.tag_name == 'video':
                            sources = element.find_elements(By.TAG_NAME, 'source')
                            video_info['sources'] = [s.get_attribute('src') for s in sources]
                        
                        video_data.append(video_info)
                        
                except Exception as e:
                    pass  # 继续尝试其他选择器
            
        except Exception as e:
            print(f"⚠️ 视频元素捕获异常: {e}")
        
        return video_data
    
    def get_element_attributes(self, element):
        """获取元素的所有属性"""
        
        try:
            # 使用JavaScript获取所有属性
            attrs = self.driver.execute_script(
                'var items = {}; for (index = 0; index < arguments[0].attributes.length; index++) { items[arguments[0].attributes[index].name] = arguments[0].attributes[index].value }; return items;',
                element
            )
            return attrs
        except:
            return {}
    
    def capture_network_logs(self):
        """捕获网络请求日志"""
        
        network_logs = []
        
        try:
            logs = self.driver.get_log('performance')
            
            for log in logs:
                message = json.loads(log['message'])
                
                # 只关注Network相关的消息
                if message['message']['method'].startswith('Network'):
                    network_logs.append(message)
            
        except Exception as e:
            print(f"⚠️ 网络日志捕获异常: {e}")
        
        return network_logs
    
    def capture_js_variables(self):
        """捕获JavaScript变量"""
        
        js_variables = {}
        
        try:
            # 尝试获取常见的视频相关全局变量
            common_vars = [
                'window.__INITIAL_STATE__',
                'window.__VIDEO_CONFIG__',
                'window.__SHARE_INFO__',
                'window.videoData',
                'window.playerConfig',
                'window.initialData'
            ]
            
            for var_name in common_vars:
                try:
                    value = self.driver.execute_script(f"return {var_name}")
                    if value:
                        js_variables[var_name] = value
                except:
                    pass
            
        except Exception as e:
            print(f"⚠️ JS变量捕获异常: {e}")
        
        return js_variables
    
    def capture_cookies(self):
        """捕获Cookie信息"""
        
        cookies = []
        
        try:
            cookies = self.driver.get_cookies()
        except Exception as e:
            print(f"⚠️ Cookie捕获异常: {e}")
        
        return cookies
    
    def capture_local_storage(self):
        """捕获LocalStorage数据"""
        
        local_storage = {}
        
        try:
            # 获取所有localStorage键值对
            local_storage = self.driver.execute_script("var items = {}; for (index = 0; index < localStorage.length; index++){ items[localStorage.key(index)] = localStorage.getItem(localStorage.key(index)) }; return items;")
        except Exception as e:
            print(f"⚠️ LocalStorage捕获异常: {e}")
        
        return local_storage
    
    def save_capture_results(self, results):
        """保存捕获结果"""
        
        if not results:
            return
        
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存主要数据
        main_data = {
            'timestamp': timestamp,
            'video_elements': results.get('video_elements', []),
            'js_variables': results.get('js_variables', {}),
            'cookies': results.get('cookies', []),
            'local_storage': results.get('local_storage', {})
        }
        
        main_file = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/browser_capture_results_{timestamp}.json"
        
        try:
            with open(main_file, 'w', encoding='utf-8') as f:
                json.dump(main_data, f, ensure_ascii=False, indent=2)
            print(f"💾 主要结果保存到: {main_file}")
        except Exception as e:
            print(f"❌ 保存主要结果失败: {e}")
        
        # 保存页面源码
        if 'page_source' in results:
            source_file = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/captured_page_source_{timestamp}.html"
            try:
                with open(source_file, 'w', encoding='utf-8') as f:
                    f.write(results['page_source'])
                print(f"💾 页面源码保存到: {source_file}")
            except Exception as e:
                print(f"❌ 保存页面源码失败: {e}")
        
        # 保存网络日志
        if 'network_logs' in results:
            network_file = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/captured_network_logs_{timestamp}.json"
            try:
                with open(network_file, 'w', encoding='utf-8') as f:
                    json.dump(results['network_logs'], f, ensure_ascii=False, indent=2)
                print(f"💾 网络日志保存到: {network_file}")
            except Exception as e:
                print(f"❌ 保存网络日志失败: {e}")
        
        return main_file
    
    def analyze_captured_data(self, results):
        """分析捕获的数据"""
        
        print("\n🔍 分析捕获的数据...")
        
        if not results:
            print("❌ 无可分析数据")
            return
        
        # 分析视频元素
        video_elements = results.get('video_elements', [])
        if video_elements:
            print(f"\n🎥 找到 {len(video_elements)} 个视频元素:")
            for i, video in enumerate(video_elements):
                print(f"   {i+1}. 选择器: {video.get('selector')}")
                
                # 显示关键属性
                attrs = video.get('attributes', {})
                if 'src' in video:
                    print(f"      SRC: {video['src'][:100]}")
                
                if 'sources' in video:
                    for j, src in enumerate(video['sources']):
                        if src:
                            print(f"      Source {j+1}: {src[:100]}")
        
        # 分析JS变量
        js_vars = results.get('js_variables', {})
        if js_vars:
            print(f"\n📊 找到 {len(js_vars)} 个JS变量:")
            for key, value in js_vars.items():
                if isinstance(value, (dict, list)):
                    print(f"   {key}: {type(value).__name__} ({len(str(value))} 字符)")
                else:
                    val_str = str(value)
                    print(f"   {key}: {val_str[:100]}")
        
        # 分析Cookie
        cookies = results.get('cookies', [])
        if cookies:
            print(f"\n🍪 找到 {len(cookies)} 个Cookie:")
            for cookie in cookies:
                print(f"   {cookie.get('name')}: {cookie.get('value')[:50]}")
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            print("🔚 浏览器已关闭")

def main():
    """主函数"""
    
    print("""
    ================================================================
    🕷️ 豆包视频浏览器环境数据抓取工具
    在真实Web环境中捕获页面的视频数据和配置信息
    ================================================================
    """)
    
    capture_tool = BrowserCaptureTool()
    
    if not capture_tool.driver:
        print("❌ 无法启动浏览器，请检查Chrome和ChromeDriver安装")
        return
    
    # 捕获数据
    share_url = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"
    
    results = capture_tool.capture_page_data(share_url)
    
    if results:
        # 分析数据
        capture_tool.analyze_captured_data(results)
        
        # 保存数据
        capture_tool.save_capture_results(results)
        
        print("\n🎯 数据捕获和分析完成！")
        
        print("\n💡 分析建议:")
        print("   1. 查看保存的JSON文件，重点分析video_elements")
        print("   2. 检查JS变量中是否有视频配置")
        print("   3. 分析Network日志找到视频相关请求")
        print("   4. 如有视频URL，与APK结果进行对比")
    
    else:
        print("❌ 数据捕获失败")
    
    # 关闭浏览器
    capture_tool.close()

if __name__ == "__main__":
    main()