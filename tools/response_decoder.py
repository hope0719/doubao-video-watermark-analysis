#!/usr/bin/env python3
# 响应数据解码工具

import gzip
import zlib
import binascii
from urllib.parse import unquote

class ResponseDecoder:
    """响应数据解码工具"""
    
    def __init__(self):
        self.decoding_results = []
    
    def decode_response(self, filename):
        """尝试多种解码方式"""
        
        print("="*80)
        print("🔓 响应数据解码工具")
        print("="*80)
        
        with open(filename, 'rb') as f:
            original_data = f.read()
        
        print(f"📊 原始数据: {len(original_data):,} 字节")
        print(f"   头部16字节: {binascii.hexlify(original_data[:16]).decode()}")
        
        # 尝试多种解码方法
        decoding_methods = [
            {
                'name': 'gzip解压',
                'method': self.try_gzip_decompress,
                'description': '使用gzip解压'
            },
            {
                'name': 'zlib解压',
                'method': self.try_zlib_decompress,
                'description': '使用deflate/zlib解压'
            },
# 移除了Brotli支持以减少依赖
            {
                'name': 'URL解码',
                'method': self.try_url_decode,
                'description': 'URL百分比解码'
            },
            {
                'name': 'Unicode解码',
                'method': self.try_unicode_decode,
                'description': 'Unicode转义解码'
            },
            {
                'name': 'Base64解码',
                'method': self.try_base64_decode,
                'description': 'Base64解码'
            },
            {
                'name': '字符替换', 
                'method': self.try_character_replacement,
                'description': '尝试修复损坏字符'
            }
        ]
        
        successful_decodings = []
        
        for method_info in decoding_methods:
            print(f"\n🔍 尝试 {method_info['name']}...")
            
            try:
                result = method_info['method'](original_data)
                
                if result and len(result.strip()) > 100:
                    print(f"   ✅ {method_info['name']} 成功")
                    print(f"   📊 解码后大小: {len(result)} 字符")
                    
                    successful_decodings.append({
                        'method': method_info['name'],
                        'description': method_info['description'],
                        'result': result,
                        'size': len(result)
                    })
                    
                    # 分析解码结果
                    self.analyze_decoded_content(result, method_info['name'])
                    
                else:
                    print(f"   ⚠️ {method_info['name']} 结果为空")
                    
            except Exception as e:
                print(f"   ❌ {method_info['name']} 失败: {e}")
        
        # 保存成功的解码结果
        if successful_decodings:
            self.save_decoding_results(successful_decodings)
        
        return successful_decodings
    
    def try_gzip_decompress(self, data):
        """尝试gzip解压"""
        try:
            # 检查gzip头部
            if data.startswith(b'\x1f\x8b\x08'):
                return gzip.decompress(data).decode('utf-8', errors='ignore')
            
            # 尝试直接解压
            return gzip.decompress(data).decode('utf-8', errors='ignore')
        
        except:
            return None
    
    def try_zlib_decompress(self, data):
        """尝试zlib解压"""
        try:
            return zlib.decompress(data).decode('utf-8', errors='ignore')
        except:
            return None
    
# 移除了Brotli解压方法
    
    def try_url_decode(self, data):
        """尝试URL解码"""
        try:
            # 先转换为字符串
            text_data = data.decode('latin-1')
            # URL解码
            return unquote(text_data)
        except:
            return None
    
    def try_unicode_decode(self, data):
        """尝试Unicode解码"""
        try:
            # 转换字节为字符串，处理Unicode转义
            text_data = data.decode('utf-8', errors='replace')
            
            # 处理 \u 转义
            import re
            def unicode_replacer(match):
                try:
                    return chr(int(match.group(1), 16))
                except:
                    return match.group(0)
            
            text_data = re.sub(r'\\u([0-9a-fA-F]{4})', unicode_replacer, text_data)
            
            return text_data
        except:
            return None
    
    def try_base64_decode(self, data):
        """尝试Base64解码"""
        try:
            import base64
            # 转换为字符串后尝试base64解码
            text_data = data.decode('latin-1')
            decoded = base64.b64decode(text_data)
            return decoded.decode('utf-8', errors='ignore')
        except:
            return None
    
    def try_character_replacement(self, data):
        """尝试字符替换解码"""
        try:
            # 将损坏的Unicode字符替换为可能的内容
            text_data = data.decode('utf-8', errors='replace')
            
            # 修复 \xef\xbf\xbd (Unicode替换字符)
            # 这是一个复杂的任务，需要推测原始内容
            # 这里做基本的清理
            cleaned = text_data.replace('\ufffd', '')  # 移除Unicode替换字符
            cleaned = cleaned.replace('\\x', '')      # 移除可能的字节转义
            
            return cleaned
        except:
            return None
    
    def analyze_decoded_content(self, content, method_name):
        """分析解码后的内容"""
        
        print(f"   🔍 分析 {method_name} 解码结果:")
        
        # 基本统计
        newline_count = content.count('\n')
        print(f"      内容长度: {len(content)} 字符")
        print(f"      行数: {newline_count + 1}")
        
        # 查找HTML结构
        if '<html' in content or '<body' in content:
            print(f"      ✅ 包含HTML结构")
        
        # 查找JSON数据
        if '{' in content and '}' in content:
            print(f"      ✅ 包含JSON类结构")
        
        # 查找视频相关关键词
        video_keywords = ['video', 'mp4', 'play', 'url', 'src']
        found_keywords = []
        
        for keyword in video_keywords:
            if keyword in content.lower():
                found_keywords.append(keyword)
        
        if found_keywords:
            print(f"      ✅ 找到视频关键词: {', '.join(found_keywords)}")
        
        # 显示内容预览
        lines = content.split('\n')[:5]
        print(f"      内容预览:")
        for i, line in enumerate(lines):
            if line.strip():
                preview = line[:100] + ('...' if len(line) > 100 else '')
                print(f"         {i+1}. {preview}")
    
    def save_decoding_results(self, results):
        """保存解码结果"""
        
        import json
        import datetime
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存每个成功的解码结果
        for i, result in enumerate(results):
            filename = f"decoded_content_{result['method']}_{timestamp}.txt"
            filepath = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{filename}"
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(f"=== Decoding Method: {result['method']} ===\n")
                    f.write(f"Description: {result['description']}\n")
                    f.write(f"Size: {result['size']} characters\n")
                    f.write(f"Timestamp: {timestamp}\n")
                    f.write("="*50 + "\n\n")
                    f.write(result['result'])
                
                print(f"   💾 保存到: {filename}")
                
            except Exception as e:
                print(f"   ❌ 保存失败: {e}")
        
        # 保存解码摘要
        summary = {
            'timestamp': timestamp,
            'total_methods': len(results),
            'successful_decodings': [
                {
                    'method': r['method'],
                    'size': r['size'],
                    'description': r['description']
                } for r in results
            ]
        }
        
        summary_filepath = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/decoding_summary_{timestamp}.json"
        
        with open(summary_filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        print(f"   📊 解码摘要已保存")

def main():
    """主函数"""
    
    print("""
    ================================================================
    🔓 豆包响应数据解码工具
    尝试多种解码方法来解析二进制响应
    ================================================================
    """)
    
    decoder = ResponseDecoder()
    
    # 解码响应文件
    filename = "/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/doubao_page_content.html"
    
    results = decoder.decode_response(filename)
    
    print("\n🎯 解码完成！")
    
    if results:
        print(f"📊 成功实现 {len(results)} 种解码方法")
        
        print("\n💡 分析建议:")
        print("   1. 查看解码后的文件，寻找视频信息")
        print("   2. 搜索URL、video、mp4等关键词")
        print("   3. 分析数据结构，寻找隐藏的视频配置")
        print("   4. 比较不同解码方法的结果差异")
        
        # 推荐最佳结果
        best_result = max(results, key=lambda x: x['size'])
        print(f"   🏆 最佳结果: {best_result['method']} ({best_result['size']}字符)")
        
    else:
        print("❌ 所有解码尝试均失败")
        print("💡 建议: 数据可能需要更特殊的解码方式")

if __name__ == "__main__":
    main()