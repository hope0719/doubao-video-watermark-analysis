#!/usr/bin/env python3
# 解压缩和分析响应数据

import gzip
import json
import re
from urllib.parse import urlparse, parse_qs

class ResponseAnalyzer:
    """响应解压缩和分析工具"""
    
    def decompress_and_analyze(self):
        """解压缩并分析保存的HTML文件"""
        
        html_file = "/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/doubao_page_content.html"
        
        print("="*80)
        print("🔧 响应解压和分析工具")
        print("="*80)
        
        try:
            # 尝试多种方式读取
            content = self.read_content_with_multiple_methods(html_file)
            
            if content:
                print(f"✅ 成功读取内容，大小: {len(content)} 字符")
                
                # 分析内容结构
                self.analyze_content(content)
                
                return content
            
            else:
                print("❌ 无法读取文件内容")
                return None
                
        except Exception as e:
            print(f"❌ 解析失败: {e}")
            return None
    
    def read_content_with_multiple_methods(self, filepath):
        """使用多种方法读取文件内容"""
        
        methods = [
            {
                'name': 'gzip解压',
                'method': self.read_gzip
            },
            {
                'name': 'UTF-8读取',
                'method': self.read_utf8
            },
            {
                'name': '二进制转字符串',
                'method': self.read_binary
            },
            {
                'name': 'Latin-1读取',
                'method': lambda f: self.read_with_encoding(f, 'latin-1')
            }
        ]
        
        for method_info in methods:
            try:
                print(f"🔍 尝试 {method_info['name']}...")
                content = method_info['method'](filepath)
                
                if content and len(content.strip()) > 100:
                    print(f"   ✅ {method_info['name']} 成功")
                    return content
                else:
                    print(f"   ⚠️ {method_info['name']} 结果为空")
                    
            except Exception as e:
                print(f"   ❌ {method_info['name']} 失败: {e}")
        
        return None
    
    def read_gzip(self, filepath):
        """使用gzip解压"""
        with gzip.open(filepath, 'rt', encoding='utf-8') as f:
            return f.read()
    
    def read_utf8(self, filepath):
        """UTF-8读取"""
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    
    def read_binary(self, filepath):
        """二进制读取后转换"""
        with open(filepath, 'rb') as f:
            binary_data = f.read()
            # 尝试将二进制数据转换为字符串
            try:
                return binary_data.decode('utf-8', errors='ignore')
            except:
                # 尝试其他编码
                return binary_data.decode('gbk', errors='ignore')
    
    def read_with_encoding(self, filepath, encoding):
        """指定编码读取"""
        with open(filepath, 'r', encoding=encoding, errors='ignore') as f:
            return f.read()
    
    def analyze_content(self, content):
        """分析内容结构和查找关键信息"""
        
        print("\n🔍 分析内容结构...")
        
        # 保存解压缩后的内容
        self.save_content(content, 'decompressed_content', 'html')
        
        # 查找各种数据模式
        findings = {
            'urls': self.find_urls(content),
            'json_data': self.find_json_patterns(content),
            'video_info': self.find_video_info(content),
            'scripts': self.find_scripts(content),
            'initial_data': self.find_initial_data(content)
        }
        
        # 显示发现
        self.display_findings(findings)
        
        return findings
    
    def find_urls(self, content):
        """查找URL"""
        print("\n🌐 查找URL...")
        
        url_patterns = [
            r'https?://[^\s"\'>]+'  # 通用URL模式
        ]
        
        urls = []
        for pattern in url_patterns:
            matches = re.findall(pattern, content)
            urls.extend(matches)
        
        # 按类型筛选
        filtered_urls = {
            'video_urls': [u for u in urls if 'video' in u.lower() or '.mp4' in u.lower()],
            'cdn_urls': [u for u in urls if 'cdn' in u.lower()],
            'doubao_urls': [u for u in urls if 'doubao' in u.lower()]
        }
        
        print(f"   📊 找到 {len(urls)} 个URL，筛选后:")
        print(f"      Video URLs: {len(filtered_urls['video_urls'])}")
        print(f"      CDN URLs: {len(filtered_urls['cdn_urls'])}")
        print(f"      Doubao URLs: {len(filtered_urls['doubao_urls'])}")
        
        return filtered_urls
    
    def find_json_patterns(self, content):
        """查找JSON数据"""
        print("\n📊 查找JSON数据...")
        
        json_patterns = [
            r'window\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*({[\s\S]*?});',
            r'var\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*({[\s\S]*?});',
            r'({[\s\S]*?"video"[\s\S]*?})',
            r'({[\s\S]*?"url"[\s\S]*?\.mp4[\s\S]*?})',
            r'({[\s\S]*?"play"[\s\S]*?url[\s\S]*?})'
        ]
        
        json_data = []
        
        for pattern in json_patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            
            for match in matches:
                try:
                    # 清理JSON字符串
                    cleaned = self.clean_json_string(match)
                    parsed = json.loads(cleaned)
                    json_data.append(parsed)
                    
                    print(f"   ✅ 找到JSON数据块")
                    self.print_json_summary(parsed)
                    
                except Exception as e:
                    # 记录但不显示错误，继续尝试
                    pass
        
        print(f"   📊 成功解析 {len(json_data)} 个JSON对象")
        return json_data
    
    def clean_json_string(self, json_str):
        """清理JSON字符串"""
        # 移除JavaScript注释
        json_str = re.sub(r'//.*$', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)
        
        # 移除尾随分号
        if json_str.strip().endswith(';'):
            json_str = json_str[:-1]
        
        # 移除未闭合的括号等
        json_str = json_str.strip()
        
        return json_str
    
    def print_json_summary(self, data):
        """打印JSON摘要"""
        def get_keys(obj, depth=0, max_depth=3):
            if depth >= max_depth:
                return "..."
            
            if isinstance(obj, dict):
                keys = list(obj.keys())[:5]  # 显示前5个键
                summary = f"Dict({len(obj)}) with keys: {', '.join(keys)}"
                if len(obj) > 5:
                    summary += f"... and {len(obj)-5} more"
                return summary
            elif isinstance(obj, list):
                return f"List({len(obj)}) items"
            else:
                val_str = str(obj)
                if len(val_str) > 50:
                    val_str = val_str[:50] + "..."
                return f"{type(obj).__name__}: {val_str}"
        
        print(f"      {get_keys(data)}")
    
    def find_video_info(self, content):
        """查找视频信息"""
        print("\n📹 查找视频信息...")
        
        video_patterns = [
            r'video["\'][\s\S]*?url["\'][\s\S]*?[:=][\s\S]*?["\']([^"\']+)["\']',
            r'play["\'][\s\S]*?url["\'][\s\S]*?[:=][\s\S]*?["\']([^"\']+)["\']',
            r'videoUrl["\'][:\s]*["\']([^"\']+)["\']',
            r'playUrl["\'][:\s]*["\']([^"\']+)["\']',
            r'source["\'][\s\S]*?src["\'][\s\S]*?[:=][\s\S]*?["\']([^"\']+)["\']'
        ]
        
        video_info = []
        
        for pattern in video_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            video_info.extend(matches)
        
        print(f"   📊 找到 {len(video_info)} 个视频相关信息")
        
        # 显示前几个
        for i, info in enumerate(video_info[:3]):
            print(f"      {i+1}. {info[:100]}")
        
        return video_info
    
    def find_scripts(self, content):
        """查找脚本内容"""
        print("\n📜 查找脚本内容...")
        
        script_pattern = r'<script[^>]*>([\s\S]*?)</script>'
        scripts = re.findall(script_pattern, content, re.IGNORECASE)
        
        print(f"   📊 找到 {len(scripts)} 个脚本块")
        
        # 分析脚本内容
        for i, script in enumerate(scripts[:2]):
            if len(script.strip()) > 100:
                print(f"      脚本 {i+1} ({len(script)} 字符):")
                # 显示脚本的开头部分
                print(f"         {script[:200]}...")
        
        return scripts
    
    def find_initial_data(self, content):
        """查找初始化数据"""
        print("\n⚙️ 查找初始化数据...")
        
        init_patterns = [
            r'window\.__INITIAL_STATE__[\s\S]*?=([\s\S]*?});',
            r'window\.__INITIAL_DATA__[\s\S]*?=([\s\S]*?});',
            r'window\.__VIDEO_CONFIG__[\s\S]*?=([\s\S]*?});',
            r'window\.__SHARE_INFO__[\s\S]*?=([\s\S]*?});'
        ]
        
        init_data = []
        
        for pattern in init_patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            
            for match in matches:
                try:
                    # 清理和解析
                    cleaned = self.clean_json_string(match)
                    parsed = json.loads(cleaned)
                    init_data.append({
                        'type': pattern,
                        'data': parsed
                    })
                    
                    print(f"   ✅ 找到初始化数据")
                    print(f"      类型: {pattern}")
                    print(f"      大小: {len(cleaned)} 字符")
                    
                except Exception as e:
                    pass
        
        return init_data
    
    def display_findings(self, findings):
        """显示所有发现"""
        print("\n" + "="*80)
        print("📋 分析结果总结")
        print("="*80)
        
        total_findings = sum(len(v) if isinstance(v, list) else len(v.keys()) for v in findings.values())
        print(f"📊 总共发现 {total_findings} 个相关数据点")
        
        # 重要发现摘要
        if findings['video_info']:
            print(f"\n🎯 视频相关发现:")
            for info in findings['video_info'][:3]:
                print(f"   • {info[:100]}")
        
        if findings['urls']['video_urls']:
            print(f"\n🌐 视频URLs:")
            for url in findings['urls']['video_urls'][:3]:
                print(f"   • {url[:100]}")
        
        if findings['json_data']:
            print(f"\n📊 JSON数据块: {len(findings['json_data'])} 个")
            for i, data in enumerate(findings['json_data'][:2]):
                self.print_json_summary(data)
        
        # 保存分析结果
        self.save_analysis_results(findings)
    
    def save_content(self, content, filename, extension):
        """保存内容"""
        try:
            filepath = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{filename}.{extension}"
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"   💾 保存到: {filename}.{extension}")
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")
    
    def save_analysis_results(self, findings):
        """保存分析结果"""
        try:
            filepath = "/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/content_analysis_results.json"
            # 转换结果为可序列化格式
            serializable_results = {}
            
            for key, value in findings.items():
                if isinstance(value, list):
                    serializable_results[key] = value[:10]  # 只保存前10个以避免过大文件
                elif isinstance(value, dict):
                    serializable_results[key] = {k: v[:10] if isinstance(v, list) else v for k, v in value.items()}
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(serializable_results, f, ensure_ascii=False, indent=2)
            
            print(f"   💾 分析结果已保存")
            
        except Exception as e:
            print(f"   ❌ 保存分析结果失败: {e}")

def main():
    """主函数"""
    
    print("""
    ================================================================
    🔧 豆包响应数据解压和分析
    解压缩获取的网页内容，提取视频相关数据
    ================================================================
    """)
    
    analyzer = ResponseAnalyzer()
    
    # 解压和分析
    content = analyzer.decompress_and_analyze()
    
    if content:
        print("\n🎯 分析完成！")
        print("📋 保存的文件:")
        print("   📄 decompressed_content.html - 解压后的完整内容")
        print("   📊 content_analysis_results.json - 分析结果摘要")
        
        print("\n💡 下一步建议:")
        print("   1. 查看分析结果，寻找视频URL")
        print("   2. 分析JSON数据中的视频配置")
        print("   3. 检查是否有隐藏的视频源")
        print("   4. 对比APK处理结果进行验证")
    
    else:
        print("❌ 分析失败，请检查原始数据")

if __name__ == "__main__":
    main()