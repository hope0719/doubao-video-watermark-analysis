#!/usr/bin/env python3
"""
模拟豆包微信小程序API调用
基于analysis/FIND_MINIPROGRAM_API.md中的成功记录
"""
import requests
import json
import hashlib
import time
import urllib3

urllib3.disable_warnings()

class MiniProgramAPISimulator:
    """模拟微信小程序API调用"""
    
    def __init__(self):
        self.session = requests.Session()
        self.setup_miniprogram_headers()
        
    def setup_miniprogram_headers(self):
        """设置微信小程序的请求头"""
        # 微信小程序特有的headers
        common_headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.10(0x18000a2a) NetType/WIFI Language/zh_CN',
            'Accept': 'application/json',
            'Accept-Language': 'zh-cn',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
            'Referer': 'https://servicewechat.com/wx1234567890/123/page-frame.html',
            'X-Requested-With': 'XMLHttpRequest'
        }
        
        for key, value in common_headers.items():
            self.session.headers[key] = value
    
    def simulate_miniprogram_calls(self, video_id):
        """模拟小程序API调用"""
        
        print(f"🎯 模拟豆包微信小程序API调用\n")
        print(f"目标视频: {video_id}")
        
        # 基于报告中的成功API端点
        test_apis = [
            {
                'name': 'video_share_get_video_share_info',
                'method': 'POST',
                'url': 'https://www.doubao.com/samantha/media/video_share/get_video_share_info',
                'data': {
                    'key': video_id,
                    'watermark': False
                }
            },
            {
                'name': 'get_play_info_with_key', 
                'method': 'POST',
                'url': 'https://www.doubao.com/samantha/media/get_play_info',
                'data': {
                    'key': video_id,
                    'video_id': video_id
                }
            },
            {
                'name': 'get_video_info_from_key',
                'method': 'POST', 
                'url': 'https://www.doubao.com/api/get_video_info',
                'data': {
                    'key': video_id,
                    'from': 'miniprogram'
                }
            }
        ]
        
        results = []
        
        for api in test_apis:
            print(f"\n📡 测试小程序API: {api['name']}")
            print(f"   URL: {api['url']}")
            print(f"   Data: {json.dumps(api['data'], ensure_ascii=False)}")
            
            try:
                response = self.session.request(
                    method=api['method'],
                    url=api['url'],
                    json=api['data'],
                    timeout=15,
                    verify=False
                )
                
                print(f"   Status: {response.status_code}")
                print(f"   Content-Length: {len(response.content)} 字节")
                
                if response.content:
                    try:
                        json_data = response.json()
                        print(f"   ✅ 获取JSON响应，大小: {len(str(json_data))} 字符")
                        
                        # 分析响应中的视频字段
                        self.analyze_response(json_data, api['name'])
                        
                        results.append({
                            'api': api['name'],
                            'url': api['url'],
                            'response': json_data
                        })
                        
                        # 保存到文件
                        filename = f"miniprogram_api_{api['name']}_{int(time.time())}.json"
                        with open(filename, 'w', encoding='utf-8') as f:
                            json.dump(json_data, f, ensure_ascii=False, indent=2)
                        print(f"   💾 已保存到 {filename}")
                                                
                    except json.JSONDecodeError:
                        print(f"   ⚠️ 非JSON响应: {response.text[:500]}")
                        
                        # 检查响应中是否包含URL
                        import re
                        urls = re.findall(r'https://[^ ><\{\}\s]+', response.text)
                        for url in urls:
                            if 'doubao.com' in url:
                                print(f"   💡 发现URL: {url}")
                                
                                # 检查是否是未水印版本
                                if 'unwatermark' in url:
                                    print(f"   🎯 发现无水印URL!")
                                
                                elif 'watermark' not in url:
                                    print(f"   💭 可能无水印: {url}")
                
                else:
                    print(f"   ❌ 响应内容为空")
                    
            except Exception as e:
                print(f"   ❌ 请求失败: {e}")
        
        return results
    
    def analyze_response(self, data, api_name):
        """深度分析API响应"""
        
        def scan_for_video_info(obj, path="", depth=0):
            if depth > 10:
                return
                
            if isinstance(obj, dict):
                for key, value in obj.items():
                    current_path = f"{path}.{key}" if path else key
                    
                    # 查找视频相关字段
                    if any(video_key in key.lower() for video_key in [
                        'media', 'video', 'url', 'play', 'original', 'main'
                    ]):
                        print(f"   📋 {current_path}: {str(value)[:150]}")
                        
                        # 检查是否是无水印
                        if isinstance(value, str):
                            if 'doubao' in value:
                                if 'unwatermark' in value.lower():
                                    print(f"   🎯 🎯🎯 发现无水印URL!")
                                    self.save_unwatermarked_url(value, api_name)
                                elif 'watermark' not in value.lower():
                                    print(f"   💭 可能无水印URL")
                    
                    if isinstance(value, (dict, list)):
                        scan_for_video_info(value, current_path, depth + 1)
            
            elif isinstance(obj, list):
                for i, item in enumerate(obj[:3]):  # 限制扫描
                    if isinstance(item, (dict, list)):
                        scan_for_video_info(item, f"{path}[{i}]", depth + 1)
        
        print(f"   🔍 深度分析 {api_name}:")
        scan_for_video_info(data)
    
    def save_unwatermarked_url(self, url, api_name):
        """保存发现的无水印URL"""
        
        print(f"\n🎉 🎉🎉 发现无水印URL! 🎉🎉🎉")
        
        # 保存到独立文件
        filename = f"UNWATERMARKED_URL_FOUND.txt"
        with open(filename, 'a') as f:
            f.write(f"\n=== 发现时间: {time.ctime()} ===\n")
            f.write(f"API: {api_name}\n")
            f.write(f"URL: {url}\n")
            f.write(f"="*80+"\n")
        
        print(f"已保存到 {filename}")

def main():
    """主函数"""
    
    print(f"""
    ================================================================
    🎯 豆包微信小程序API模拟器
    模拟小程序环境调用API，寻找无水印视频源
    ================================================================
    """)
    
    # 使用与报告中相同的测试视频
    video_id = "v0d69cg10004d946nuiljht2d4d2v44g"
    
    simulator = MiniProgramAPISimulator()
    results = simulator.simulate_miniprogram_calls(video_id)
    
    print(f"\n📊 测试完成，共尝试 {len(results)} 个API")
    
    if not results:
        print(f"❌ 所有API调用均失败")
    
    else:
        print(f"\n💡 后续建议:")
        print(f"1. 分析保存的JSON文件，查找可能的隐藏字段")
        print(f"2. 尝试添加小程序特有的签名或Token") 
        print(f"3. 使用Charles或Fiddler捕获真实的小程序API调用")
        print(f"4. 分析特定User-Agent对API响应的影响")

if __name__ == "__main__":
    main()