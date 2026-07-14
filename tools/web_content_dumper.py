#!/usr/bin/env python3
# 通过网页内容解析获取视频信息

import requests
import json
import re
import urllib3
from urllib.parse import urlparse, parse_qs

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class WebContentDumper:
    """网页内容解析工具"""
    
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        
    def setup_session(self):
        """配置会话"""
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://www.doubao.com/',
            'Upgrade-Insecure-Requests': '1'
        })
        self.session.verify = False
        
    def get_page_content(self, share_url):
        """获取页面完整内容"""
        
        print("="*80)
        print("🌐 网页内容Dump工具")
        print("="*80)
        
        print(f"📋 目标链接: {share_url}")
        
        try:
            print("\n🚀 获取页面内容...")
            response = self.session.get(share_url, timeout=30)
            
            print(f"📊 响应状态: HTTP {response.status_code}")
            print(f"📋 响应大小: {len(response.text)} 字符")
            print(f"🎯 内容类型: {response.headers.get('Content-Type', 'unknown')}")
            
            if response.status_code == 200:
                self.save_and_analyze_content(response.text)
                return response.text
            else:
                print(f"❌ 获取页面内容失败")
                return None
                
        except Exception as e:
            print(f"❌ 请求失败: {e}")
            return None
    
    def save_and_analyze_content(self, html_content):
        """保存并分析页面内容"""
        
        # 保存完整页面内容
        self.save_to_file(html_content, 'doubao_page_content', 'html')
        
        print("\n🔍 分析页面结构...")
        
        # 查找视频相关数据
        video_data = self.extract_video_data(html_content)
        
        # 查找JSON数据
        json_data = self.find_json_data(html_content)
        
        # 查找脚本标签
        scripts = self.find_script_tags(html_content)
        
        return {
            'video_data': video_data,
            'json_data': json_data,
            'scripts': scripts
        }
    
    def extract_video_data(self, html_content):
        """提取视频相关数据"""
        
        print("\n📹 查找视频数据...")
        
        video_data = {}
        
        # 查找video标签
        video_pattern = r'<video[^>]*>(.*?)</video>'
        video_matches = re.findall(video_pattern, html_content, re.DOTALL | re.IGNORECASE)
        
        if video_matches:
            video_data['video_tags'] = video_matches
            print(f"   ✅ 找到 {len(video_matches)} 个video标签")
        
        # 查找视频URL
        video_url_patterns = [
            r'(https?://[^"\']*\.mp4[^"\']*)',
            r'video_url["\']*[:\s]+["\']([^"\']+)["\']',
            r'play_url["\']*[:\s]+["\']([^"\']+)["\']',
            r'source[^>]*src=["\']([^"\']+\.mp4?)["\']'
        ]
        
        video_urls = []
        for pattern in video_url_patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            video_urls.extend(matches)
        
        if video_urls:
            video_data['video_urls'] = list(set(video_urls))  # 去重
            print(f"   ✅ 找到 {len(video_urls)} 个视频URL")
            
            for i, url in enumerate(video_urls[:3]):  # 显示前3个
                print(f"      {i+1}. {url}")
        
        return video_data
    
    def find_json_data(self, html_content):
        """查找页面中的JSON数据"""
        
        print("\n📊 查找JSON数据...")
        
        json_data = {}
        
        # 查找常见的JSON数据模式
        json_patterns = [
            r'window\.__INITIAL_STATE__\s*=\s*({[^}]+});',
            r'window\.__INITIAL_DATA__\s*=\s*({[^}]+});',
            r'var\s+initialState\s*=\s*({[^}]+});',
            r'var\s+videoData\s*=\s*({[^}]+});',
            r'JSON\.parse\(["\']({[^}]+})["\']\)',
            r'\{["\']video["\'][\s\S]*?["\']url["\'][\s\S]*?\}',
            r'\{["\']play["\'][\s\S]*?["\']url["\'][\s\S]*?\}'
        ]
        
        found_count = 0
        
        for pattern in json_patterns:
            matches = re.findall(pattern, html_content, re.DOTALL)
            
            for match in matches:
                try:
                    # 尝试修复JSON字符串
                    json_str = self.fix_json_string(match)
                    data = json.loads(json_str)
                    
                    found_count += 1
                    key_name = f"json_data_{found_count}"
                    json_data[key_name] = data
                    
                    print(f"   ✅ 找到JSON数据块 {found_count}")
                    self.analyze_json_structure(data, f"  结构 {found_count}")
                    
                    # 保存找到的JSON
                    self.save_to_file(data, f'extracted_json_{found_count}', 'json')
                    
                except json.JSONDecodeError as e:
                    print(f"   ⚠️ JSON解析失败: {e}")
                    # 保存原始字符串供手动分析
                    self.save_to_file(match, f'raw_json_candidate_{found_count}', 'txt')
        
        return json_data
    
    def fix_json_string(self, json_str):
        """尝试修复可能损坏的JSON字符串"""
        
        # 修复常见的JSON问题
        fixed = json_str.strip()
        
        # 移除尾随分号
        if fixed.endswith(';'):
            fixed = fixed[:-1]
        
        # 简单的引号修复（有限修复，复杂情况需要更高级的处理）
        # 这里仅做基本的清理
        
        return fixed
    
    def analyze_json_structure(self, data, prefix=""):
        """分析JSON数据结构"""
        
        def print_structure(obj, path="", depth=0):
            if depth > 3:  # 限制递归深度
                return
                
            if isinstance(obj, dict):
                key_count = len(obj)
                print(f"{prefix}: 字典，{key_count} 个键")
                
                # 显示前10个键
                for i, key in enumerate(list(obj.keys())[:10]):
                    value = obj[key]
                    value_type = type(value).__name__
                    
                    if isinstance(value, (dict, list)):
                        print(f"{prefix}  ├─ {key}: {value_type}")
                        if isinstance(value, dict) and len(value) < 8:
                            print_structure(value, f"{prefix}  │", depth + 1)
                    else:
                        # 对于简单值，显示一部分内容
                        if isinstance(value, str):
                            if key.lower().find('url') >= 0 or key.lower().find('video') >= 0:
                                value_preview = value[:100] + "..." if len(value) > 100 else value
                                print(f"{prefix}  ├─ {key}: {value_type} = {value_preview}")
                            else:
                                print(f"{prefix}  ├─ {key}: {value_type}")
                        else:
                            print(f"{prefix}  ├─ {key}: {value_type} = {str(value)[:50]}")
                
                if key_count > 10:
                    print(f"{prefix}  └─ ...还有{key_count-10}个键")
                    
            elif isinstance(obj, list):
                item_count = len(obj)
                print(f"{prefix}: 列表，{item_count} 个项目")
                
                if item_count > 0 and len(obj) < 5:
                    print_structure(obj[0], f"{prefix}  │", depth + 1)
        
        print_structure(data)
    
    def find_script_tags(self, html_content):
        """查找脚本标签"""
        
        print("\n📜 查找脚本标签...")
        
        script_pattern = r'<script[^>]*>([\s\S]*?)</script>'
        script_matches = re.findall(script_pattern, html_content, re.IGNORECASE)
        
        print(f"   📋 找到 {len(script_matches)} 个脚本块")
        
        # 保存脚本内容
        if script_matches:
            self.save_to_file(script_matches, 'page_scripts', 'txt')
        
        return script_matches
    
    def save_to_file(self, content, filename, extension):
        """保存内容到文件"""
        
        try:
            filepath = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{filename}.{extension}"
            
            if isinstance(content, (dict, list)):
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)
            else:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(str(content))
            
            print(f"   💾 保存到: {filename}.{extension}")
            
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")

def main():
    """主函数"""
    
    print("""
    ================================================================
    🌐 豆包网页内容解析工具
    解析分享页面，提取视频数据和配置信息
    ================================================================
    """)
    
    share_url = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"
    
    dumper = WebContentDumper()
    
    # 获取页面内容
    html_content = dumper.get_page_content(share_url)
    
    if html_content:
        print("\n🎯 内容解析完成！")
        print(f"📍 保存的文件:")
        print(f"   📄 doubao_page_content.html - 完整页面内容")
        print(f"   📊 extracted_json_*.json - 提取的JSON数据")
        print(f"   📜 page_scripts.txt - 页面脚本")
        
        print("\n💡 分析建议:")
        print("   1. 查看提取的JSON数据中的video相关字段")
        print("   2. 分析脚本中的初始化逻辑")
        print("   3. 寻找视频配置和播放参数")
        print("   4. 检查是否有隐藏的视频源或参数")
    
    else:
        print("❌ 未能成功获取网页内容")

if __name__ == "__main__":
    main()