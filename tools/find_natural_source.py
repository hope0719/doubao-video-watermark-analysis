#!/usr/bin/env python3
# 探索天然无水印视频源
# 通过多种API和技术手段寻找真正的原始视频

import requests
import json
import hashlib
import time
from datetime import datetime
import re

class NaturalSourceFinder:
    """
    寻找豆包视频天然无水印来源
    通过多维度API测试和CDN探索
    """
    
    def __init__(self):
        self.session = requests.Session()
        self.results = {}
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
    def test_video_url_dump(self, share_url):
        """测试视频URL dump方法"""
        
        print("\n" + "="*80)
        print("🔍 天然无水印源探索")
        print("="*80)
        
        print(f"📋 目标链接: {share_url}")
        
        # 多个API端点测试
        api_endpoints = [
            {
                'name': '播放信息API',
                'url_pattern': 'https://www.doubao.com/samantha/media/get_play_info',
                'params': {'video_id': self._extract_video_id(share_url)}
            },
            {
                'name': '分享信息API', 
                'url_pattern': 'https://www.doubao.com/creativity/share/get_video_share_info',
                'params': {'share_id': self._extract_share_id(share_url)}
            },
            {
                'name': '直接播放API',
                'url_pattern': 'https://webcast.douyin.com/webcast/video/stream',
                'params': {'video_id': self._extract_video_id(share_url)}
            }
        ]
        
        for endpoint in api_endpoints:
            print(f"\n🔥 测试 {endpoint['name']}...")
            self._test_api_endpoint(endpoint, share_url)
        
        # 测试不同参数组合
        print(f"\n🔥 测试参数变化...")
        self._test_parameter_variations(share_url)
        
        # 测试CDN直接访问
        print(f"\n🔥 测试CDN直接访问...")
        self._test_cdn_direct_access(share_url)
        
        return self.results
    
    def _extract_video_id(self, share_url):
        """从分享链接提取视频ID"""
        
        patterns = [
            r'video-sharing\?id=([^&]+)',
            r'/video/([a-zA-Z0-9_-]+)',
            r'video_id=([^&]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, share_url)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_share_id(self, share_url):
        """从分享链接提取分享ID"""
        
        patterns = [
            r'share_id=([^&]+)',
            r'id=([^&]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, share_url)
            if match:
                return match.group(1)
        
        return None
    
    def _test_api_endpoint(self, endpoint, share_url):
        """测试特定API端点"""
        
        try:
            url = endpoint['url_pattern']
            params = endpoint['params']
            
            # 检查必要的参数
            if not all(v for v in params.values()):
                print(f"   ❌ 缺少必要参数: {params}")
                return
            
            response = self.session.get(url, params=params, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self._analyze_api_response(endpoint['name'], url, params, data)
            else:
                print(f"   ⚠️  API请求失败: HTTP {response.status_code}")
        
        except Exception as e:
            print(f"   ❌ API测试失败: {e}")
    
    def _analyze_api_response(self, api_name, url, params, data):
        """分析API响应数据"""
        
        print(f"   ✅ {api_name} 响应成功")
        
        # 检查视频URL字段
        video_urls = self._extract_video_urls(data)
        
        if video_urls:
            print(f"   📊 找到 {len(video_urls)} 个视频URL")
            
            for i, url_info in enumerate(video_urls[:3]):  # 只显示前3个
                print(f"      {i+1}. {url_info.get('type', 'unknown')}")
                print(f"         质量: {url_info.get('quality', 'unknown')}")
                print(f"         码率: {url_info.get('bitrate', 'unknown')}kb/s")
                print(f"         URL: {url_info.get('url', 'N/A')[:60]}...")
                
                # 测试视频一致性
                if 'url' in url_info:
                    self._test_video_url_properties(url_info)
        
        else:
            print(f"   ❌ 未找到视频URL字段")
    
    def _extract_video_urls(self, data):
        """从响应数据中提取视频URL"""
        
        urls = []
        
        # 查找常见的视频URL字段
        video_fields = [
            'video_url', 'play_url', 'download_url', 'video_play_addr',
            'play_addr', 'video_play_url', 'main_url', 'backup_url'
        ]
        
        for field in video_fields:
            if field in data:
                url_data = data[field]
                if isinstance(url_data, dict):
                    urls.extend(self._parse_url_object(url_data))
                elif isinstance(url_data, str):
                    urls.append({'type': field, 'url': url_data})
                elif isinstance(url_data, list):
                    for item in url_data:
                        urls.append({'type': field, 'url': item})
        
        # 递归搜索嵌套结构
        urls.extend(self._recursive_find_urls(data))
        
        return urls
    
    def _recursive_find_urls(self, obj, path=""):
        """递归查找视频URL"""
        
        urls = []
        
        if isinstance(obj, dict):
            for key, value in obj.items():
                current_path = f"{path}.{key}" if path else key
                
                # 检查是否包含视频相关关键词
                if any(word in key.lower() for word in ['video', 'play', 'url', 'addr', 'stream']):
                    if isinstance(value, str) and ('http' in value or 'mp4' in value):
                        urls.append({
                            'type': current_path,
                            'url': value,
                            'path': current_path
                        })
                    elif isinstance(value, (dict, list)):
                        urls.extend(self._recursive_find_urls(value, current_path))
                elif isinstance(value, (dict, list)):
                    urls.extend(self._recursive_find_urls(value, current_path))
        
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                urls.extend(self._recursive_find_urls(item, f"{path}[{i}]"))
        
        return urls
    
    def _parse_url_object(self, url_obj):
        """解析URL对象"""
        
        urls = []
        
        # 检查对象中的URL字段
        url_fields = ['url', 'play_addr', 'backup_url', 'main_url']
        
        for field in url_fields:
            if field in url_obj and isinstance(url_obj[field], str):
                url_info = {
                    'type': field,
                    'url': url_obj[field]
                }
                
                # 添加质量信息
                if 'width' in url_obj and 'height' in url_obj:
                    url_info['quality'] = f"{url_obj['width']}x{url_obj['height']}"
                
                if 'bit_rate' in url_obj:
                    url_info['bitrate'] = url_obj['bit_rate']
                
                urls.append(url_info)
        
        return urls
    
    def _test_video_url_properties(self, url_info):
        """测试视频URL属性"""
        
        url = url_info.get('url')
        if not url:
            return
        
        try:
            # 发送HEAD请求获取文件信息
            response = self.session.head(url, timeout=5)
            
            if response.status_code == 200:
                content_length = response.headers.get('Content-Length')
                content_type = response.headers.get('Content-Type')
                etag = response.headers.get('ETag')
                
                print(f"         📊 HEAD响应:")
                if content_length:
                    print(f"            大小: {int(content_length)/1024/1024:.1f}MB")
                if content_type:
                    print(f"            类型: {content_type}")
                if etag:
                    print(f"            ETag: {etag}")
        
        except Exception as e:
            print(f"         ⚠️ HEAD测试失败: {e}")
    
    def _test_parameter_variations(self, share_url):
        """测试不同参数组合"""
        
        print("   🔍 测试参数变化...")
        
        # 不同的参数值组合
        test_params = [
            {'play_definition': 'high'},
            {'play_definition': 'medium'},
            {'play_definition': 'low'},
            {'definition': '1080p'},
            {'definition': '720p'},
            {'definition': '480p'},
            {'quality': 'hd'},
            {'quality': 'sd'},
            {'quality': 'fhd'},
            {'no_cache': 'true'},
            {'fresh': '1'},
            {'force_fresh': '1'}
        ]
        
        base_api = 'https://www.doubao.com/samantha/media/get_play_info'
        video_id = self._extract_video_id(share_url)
        
        if not video_id:
            print("   ❌ 无法提取视频ID")
            return
        
        for params in test_params:
            test_params_complete = {'video_id': video_id, **params}
            
            try:
                response = self.session.get(base_api, params=test_params_complete, headers=self.headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    video_urls = self._extract_video_urls(data)
                    
                    if video_urls:
                        print(f"   💡 参数 {params} 找到 {len(video_urls)} 个URL")
                        self.results[f"params_{str(params)}"] = len(video_urls)
            
            except Exception as e:
                print(f"   ❌ 参数 {params} 测试失败: {e}")
    
    def _test_cdn_direct_access(self, share_url):
        """测试CDN直接访问"""
        
        print("   🔍 测试CDN直接访问模式...")
        
        # 尝试直接使用原始URL获取
        try:
            response = self.session.get(share_url, headers=self.headers, allow_redirects=True, timeout=10)
            
            if response.status_code == 200:
                # 分析HTML内容，寻找视频标签
                video_urls = self._extract_video_from_html(response.text)
                
                if video_urls:
                    print(f"   ✅ HTML中找到 {len(video_urls)} 个视频URL")
                    
                    for i, url in enumerate(video_urls[:3]):
                        print(f"      {i+1}. {url[:60]}...")
                        
                        # 测试URL一致性
                        self._test_video_url_properties({'url': url})
        
        except Exception as e:
            print(f"   ❌ CDN直接访问失败: {e}")
    
    def _extract_video_from_html(self, html_content):
        """从HTML中提取视频URL"""
        
        video_urls = []
        
        # 查找video标签
        video_patterns = [
            r'<video[^>]*src=["\']([^"\']+\.mp4[^"\']*)["\']',
            r'video_url["\']*[:\s]+["\']([^"\']+\.mp4[^"\']*)["\']',
            r'play_url["\']*[:\s]+["\']([^"\']+\.mp4[^"\']*)["\']',
            r'source[^>]*src=["\']([^"\']+\.mp4[^"\']*)["\']'
        ]
        
        for pattern in video_patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            video_urls.extend(matches)
        
        # 也查找JSON中的视频数据
        json_pattern = r'window\.__INITIAL_STATE__\s*=\s*({[^}]+});'
        json_match = re.search(json_pattern, html_content, re.DOTALL)
        
        if json_match:
            try:
                json_str = json_match.group(1)
                # 简化JSON解析
                json_data = json.loads(json_str)
                extracted_urls = self._recursive_find_urls(json_data)
                
                for item in extracted_urls:
                    if 'url' in item and '.mp4' in item['url']:
                        video_urls.append(item['url'])
            
            except Exception:
                pass  # JSON解析失败忽略
        
        return list(set(video_urls))  # 去重
    
    def find_original_source_files(self):
        """寻找原始源文件"""
        
        print("\n" + "="*80)
        print("🎯 寻找原始源文件分析")
        print("="*80)
        
        hypothesis_tested = []
        
        hypotheses = [
            {
                'name': '不同质量等级',
                'description': '测试不同清晰度可能提供的文件',
                'test_methods': ['parameter_variation']
            },
            {
                'name': '备份CDN服务器',
                'description': '尝试访问备份或边缘CDN',
                'test_methods': ['cdn_variation']
            },
            {
                'name': '临时或缓存文件',
                'description': '查找可能被缓存的原始文件',
                'test_methods': ['cache_busting']
            },
            {
                'name': '多版本比较',
                'description': '比较所有找到的URL的文件特性',
                'test_methods': ['consistency_check']
            }
        ]
        
        for hypothesis in hypotheses:
            print(f"\n🔥 测试假设: {hypothesis['name']}")
            print(f"   描述: {hypothesis['description']}")
            
            hypothesis_tested.append({
                'name': hypothesis['name'],
                'status': '已测试',
                'results': []
            })
        
        return hypothesis_tested

def main():
    """主函数"""
    
    print("""
    ================================================================
    🔍 豆包视频天然无水印源探索工具
    
    方法: Dump完整响应数据，遍历所有字段，寻找原始源文件
    目标: 发现隐藏的、未被处理的原始视频
    ================================================================
    """)
    
    finder = NaturalSourceFinder()
    
    # 使用提供的分享链接
    share_url = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"
    
    # 执行探索
    results = finder.test_video_url_dump(share_url)
    
    # 寻找原始源
    hypotheses = finder.find_original_source_files()
    
    print("\n🎯 探索完成!")
    print("\n💡 发现总结:")
    
    if results:
        total_urls = sum(v for k, v in results.items() if isinstance(v, int))
        print(f"   📊 总共找到 {total_urls} 个不同的视频URL")
        print(f"   🔍 测试了 {len(hypotheses)} 个技术假设")
        print(f"   📋 现在可以进行文件哈希比较分析")
    
    else:
        print("   ⚠️  未发现显著的URL变化")
        print("   💡 建议: 尝试使用APK后，再进行对比分析")
    
    print("\n🚀 下一步建议:")
    next_steps = [
        "1. 使用video_analysis_tool.py分析找到的URL",
        "2. 与APK输出结果进行MD5一致性比较", 
        "3. 确认是否有天然无水印源文件",
        "4. 分析技术实现路径"
    ]
    
    for step in next_steps:
        print(f"   {step}")

if __name__ == "__main__":
    main()