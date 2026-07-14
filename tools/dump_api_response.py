#!/usr/bin/env python3
# 专门用于dump get_play_info API完整响应数据的工具

import requests
import json
import urllib3
from urllib.parse import urlparse, parse_qs

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class APIResponseDumper:
    """专门dump API响应数据的工具"""
    
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        
    def setup_session(self):
        """配置会话"""
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://www.doubao.com/',
            'Origin': 'https://www.doubao.com',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Dest': 'empty',
            'DNT': '1'
        })
        self.session.verify = False  # 忽略SSL验证
        
    def extract_video_info_from_url(self, share_url):
        """从分享链接提取必要信息"""
        parsed_url = urlparse(share_url)
        query_params = parse_qs(parsed_url.query)
        
        video_info = {
            'video_id': query_params.get('video_id', [None])[0],
            'share_id': query_params.get('share_id', [None])[0],
            'base_url': f"{parsed_url.scheme}://{parsed_url.netloc}"
        }
        
        return video_info
    
    def dump_get_play_info_response(self, share_url):
        """获取并打印get_play_info的完整响应"""
        
        print("="*80)
        print("🔍 API响应数据Dump工具")
        print("="*80)
        
        print(f"📋 目标链接: {share_url}")
        
        # 提取视频信息
        video_info = self.extract_video_info_from_url(share_url)
        print(f"\n📊 提取的视频信息:")
        print(f"   video_id: {video_info['video_id']}")
        print(f"   share_id: {video_info['share_id']}")
        
        # 构建API请求
        api_url = "https://www.doubao.com/samantha/media/get_play_info"
        
        params = {}
        if video_info['video_id']:
            params['video_id'] = video_info['video_id']
        
        print(f"\n🔍 请求API: {api_url}")
        print(f"   参数: {params}")
        
        # 发送请求并捕获完整响应
        try:
            print(f"\n🚀 发送请求...")
            response = self.session.get(api_url, params=params, timeout=30)
            
            print(f"📊 响应状态: HTTP {response.status_code}")
            print(f"📋 响应头信息:")
            for key, value in response.headers.items():
                print(f"   {key}: {value}")
            
            print(f"\n" + "="*80)
            print("📄 完整响应内容:")
            print("="*80)
            
            # 尝试解析JSON
            try:
                json_data = response.json()
                print(json.dumps(json_data, indent=2, ensure_ascii=False))
                
                # 保存到文件
                self.save_response_to_file(json_data, 'get_play_info_response')
                
            except json.JSONDecodeError:
                print("⚠️ 响应不是有效的JSON格式")
                print(f"原始响应内容:\n{response.text}")
                
                # 保存原始响应
                self.save_response_to_file(response.text, 'get_play_info_raw_response')
            
            return response
            
        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败: {e}")
            return None
    
    def save_response_to_file(self, data, prefix):
        """保存响应数据到文件"""
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{prefix}_{timestamp}.json"
        
        try:
            with open(f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{filename}", 'w', encoding='utf-8') as f:
                if isinstance(data, dict) or isinstance(data, list):
                    json.dump(data, f, ensure_ascii=False, indent=2)
                else:
                    f.write(str(data))
            print(f"\n💾 响应已保存到: {filename}")
        except Exception as e:
            print(f"❌ 保存失败: {e}")
    
    def test_alternative_apis(self, share_url):
        """测试其他可能的API端点"""
        
        video_info = self.extract_video_info_from_url(share_url)
        
        # 其他可能的API端点
        alternative_apis = [
            {
                'name': 'get_video_share_info',
                'url': 'https://www.doubao.com/creativity/share/get_video_share_info',
                'params': {'share_id': video_info['share_id']} if video_info['share_id'] else {}
            },
            {
                'name': 'video_stream_info', 
                'url': 'https://webcast.douyin.com/webcast/video/stream',
                'params': {'video_id': video_info['video_id']} if video_info['video_id'] else {}
            }
        ]
        
        print(f"\n🔄 测试替代API端点...")
        
        for api in alternative_apis:
            if api['params']:  # 只有当参数存在时才测试
                print(f"\n📡 测试 {api['name']}...")
                try:
                    response = self.session.get(api['url'], params=api['params'], timeout=10)
                    print(f"   状态: {response.status_code}")
                    
                    if response.status_code == 200:
                        try:
                            json_data = response.json()
                            print(f"   ✅ 成功获取JSON响应")
                            print(f"   📋 响应长度: {len(str(json_data))} 字符")
                            
                            # 简短的摘要
                            self.print_response_summary(json_data, api['name'])
                            
                        except json.JSONDecodeError:
                            print(f"   ⚠️ 非JSON响应: {response.text[:200]}...")
                    else:
                        print(f"   ❌ 请求失败")
                        
                except Exception as e:
                    print(f"   ❌ 请求异常: {e}")
    
    def print_response_summary(self, data, api_name):
        """打印响应摘要信息"""
        
        print(f"   📊 {api_name}响应摘要:")
        
        def print_keys(obj, prefix=""):
            if isinstance(obj, dict):
                for key, value in list(obj.items())[:10]:  # 限制显示前10个键
                    if isinstance(value, (dict, list)):
                        print(f"     {prefix}{key}: {type(value).__name__}")
                        if isinstance(value, dict) and len(value) < 5:
                            print_keys(value, prefix + "  ")
                    else:
                        print(f"     {prefix}{key}: {str(value)[:100]}")
            elif isinstance(obj, list):
                print(f"     {prefix}列表，长度: {len(obj)}")
                if obj and len(obj) < 5:
                    print_keys(obj[0], prefix + "  ")
        
        print_keys(data)

def main():
    """主函数"""
    
    print("""
    ================================================================
    📡 API响应数据Dump工具
    专门用于获取和显示豆包API的完整响应数据
    ================================================================
    """)
    
    # 您的视频链接
    share_url = "https://www.doubao.com/video-sharing?share_id=49141126666482178&source_type=mobile&video_id=v0d69cg10004d946nuiljht2d4d2v44g&share_scene=video_viewer"
    
    dumper = APIResponseDumper()
    
    # 主要任务：dump get_play_info响应
    response = dumper.dump_get_play_info_response(share_url)
    
    # 额外测试：其他API端点
    dumper.test_alternative_apis(share_url)
    
    print(f"\n🎯 API响应dump完成！")
    
    if response:
        print(f"\n💡 分析建议:")
        print(f"   1. 查看保存的JSON文件，仔细分析所有字段")
        print(f"   2. 特别关注包含'url'、'play'、'video'的字段")
        print(f"   3. 分析不同字段的层级结构")
        print(f"   4. 寻找可能的隐藏或备用视频源")
    
    else:
        print(f"❌ 未能成功获取API响应，请检查网络连接或API状态")

if __name__ == "__main__":
    main()