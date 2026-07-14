#!/usr/bin/env python3
# 二进制内容深入分析工具

import binascii
import json
import struct
from collections import Counter

class BinaryContentAnalyzer:
    """二进制内容分析工具"""
    
    def __init__(self):
        self.analysis_results = {}
    
    def hex_dump_analyze(self, filename):
        """执行hex dump分析"""
        
        print("="*80)
        print("🔬 二进制内容深入分析")
        print("="*80)
        
        with open(filename, 'rb') as f:
            binary_data = f.read()
        
        print(f"📊 文件信息:")
        print(f"   大小: {len(binary_data):,} 字节")
        print(f"   前20字节: {binascii.hexlify(binary_data[:20]).decode()}")
        
        # 分析文件头部
        self.analyze_header(binary_data)
        
        # 查找可能的文本字符串
        self.find_text_strings(binary_data)
        
        # 查找可能的URL模式
        self.find_url_patterns(binary_data)
        
        # 查找可能的JSON/视频数据
        self.find_structured_data(binary_data)
        
        return self.analysis_results
    
    def analyze_header(self, data):
        """分析文件头部"""
        
        print("\n🔍 文件头部分析:")
        
        if len(data) < 20:
            print("   ❌ 文件太小")
            return
        
        header = data[:20]
        hex_header = binascii.hexlify(header).decode()
        
        # 检查常见文件类型标识
        magic_numbers = {
            b'\x1f\x8b\x08': 'gzip compressed data',
            b'\x50\x4b\x03\x04': 'ZIP compressed archive',
            b'\x12\x34\x56\x78': 'Possible custom format'
        }
        
        file_type = 'Unknown binary format'
        for magic, desc in magic_numbers.items():
            if data.startswith(magic):
                file_type = desc
                break
        
        print(f"   类型: {file_type}")
        print(f"   头部HEX: {hex_header}")
        
        return file_type
    
    def find_text_strings(self, data):
        """查找文本字符串"""
        
        print("\n📝 查找文本字符串:")
        
        # 尝试提取ASCII字符串
        ascii_strings = self.extract_ascii_strings(data)
        
        if ascii_strings:
            print(f"   ✅ 找到 {len(ascii_strings)} 个ASCII字符串")
            
            # 显示前10个较长的字符串
            for i, s in enumerate(ascii_strings[:10]):
                if len(s) > 10:
                    print(f"      {i+1}. {s[:80]}")
                    if len(s) > 80:
                        print(f"         ... (共{len(s)}字符)")
        
        else:
            print("   ⚠️ 未找到ASCII字符串")
    
    def extract_ascii_strings(self, data, min_length=4):
        """提取ASCII字符串"""
        
        strings = []
        current_string = ""
        
        for byte in data:
            # 检查是否为可打印ASCII字符
            if 32 <= byte <= 126:
                current_string += chr(byte)
            else:
                if len(current_string) >= min_length:
                    strings.append(current_string)
                current_string = ""
        
        # 处理最后一个字符串
        if len(current_string) >= min_length:
            strings.append(current_string)
        
        # 按长度排序，取长的优先
        strings.sort(key=len, reverse=True)
        return strings
    
    def find_url_patterns(self, data):
        """查找URL类模式"""
        
        print("\n🌐 查找URL模式:")
        
        url_indicators = [
            b'http',
            b'https', 
            b'www.',
            b'cdn',
            b'mp4',
            b'video',
            b'play'
        ]
        
        found_patterns = []
        
        for indicator in url_indicators:
            positions = []
            start = 0
            
            while True:
                pos = data.find(indicator, start)
                if pos == -1:
                    break
                positions.append(pos)
                start = pos + 1
            
            if positions:
                found_patterns.append({
                    'indicator': indicator.decode(),
                    'positions': positions[:5],  # 只显示前5个位置
                    'count': len(positions)
                })
        
        if found_patterns:
            print(f"   📊 找到 {len(found_patterns)} 种URL相关模式")
            
            for pattern in found_patterns:
                print(f"      {pattern['indicator']}: {pattern['count']}次")
                if pattern['positions']:
                    for pos in pattern['positions'][:3]:
                        # 显示上下文
                        context = self.get_context_around_position(data, pos, 20)
                        print(f"         位置{pos}: {context}")
        
        else:
            print("   ⚠️ 未找到明显的URL模式")
        
        return found_patterns
    
    def get_context_around_position(self, data, position, context_size):
        """获取指定位置周围的上下文"""
        
        start = max(0, position - context_size)
        end = min(len(data), position + context_size + 10)
        
        context_data = data[start:end]
        
        # 尝试转换为可读形式
        try:
            context_hex = binascii.hexlify(context_data).decode()
            # 同时尝试ASCII转换
            context_ascii = ""
            for byte in context_data:
                if 32 <= byte <= 126:
                    context_ascii += chr(byte)
                else:
                    context_ascii += f"\\x{byte:02x}"
            
            return f"HEX: {context_hex} | ASCII片段: {context_ascii}"
        
        except:
            return binascii.hexlify(context_data).decode()
    
    def find_structured_data(self, data):
        """查找结构化数据"""
        
        print("\n🏗️ 查找结构化数据:")
        
        # 查找可能的JSON结构
        json_like_patterns = self.find_json_like_structures(data)
        
        # 查找可能的播放器配置
        player_configs = self.find_player_configs(data)
        
        # 分析字节分布
        byte_distribution = self.analyze_byte_distribution(data)
        
        return {
            'json_patterns': json_like_patterns,
            'player_configs': player_configs,
            'byte_distribution': byte_distribution
        }
    
    def find_json_like_structures(self, data):
        """查找类似JSON的结构"""
        
        print("   🔍 查找JSON类结构...")
        
        # 查找大括号
        brace_positions = []
        for i, byte in enumerate(data):
            if byte in [ord('{'), ord('}'), ord('['), ord(']')]:
                brace_positions.append((i, chr(byte)))
        
        print(f"   📊 找到 {len(brace_positions)} 个JSON类字符")
        
        # 尝试提取可能的JSON片段
        potential_json = []
        for i, byte in enumerate(data):
            if byte == ord('{'):
                # 找到一个可能的JSON开始
                end_pos = self.find_json_end(data, i)
                if end_pos > i and end_pos - i < 10000:  # 合理的长度限制
                    json_data = data[i:end_pos+1]
                    potential_json.append({
                        'start': i,
                        'end': end_pos,
                        'length': end_pos - i + 1,
                        'data': json_data
                    })
        
        if potential_json:
            print(f"   📊 找到 {len(potential_json)} 个可能JSON片段")
            
            for i, json_info in enumerate(potential_json[:3]):
                print(f"      片段{i+1}: 位置{json_info['start']}-{json_info['end']} ({json_info['length']}字节)")
                
                # 尝试解析
                try:
                    ascii_data = ""
                    for byte in json_info['data']:
                        if 32 <= byte <= 126:
                            ascii_data += chr(byte)
                        else:
                            ascii_data += f"\\x{byte:02x}"
                    
                    print(f"         内容片段: {ascii_data[:200]}")
                    
                except:
                    print(f"         (二进制数据)")
        
        return potential_json
    
    def find_json_end(self, data, start_pos):
        """找到JSON结构的结束位置"""
        
        brace_count = 0
        quote_open = False
        escape_next = False
        
        for i in range(start_pos, min(len(data), start_pos + 50000)):  # 限制搜索范围
            byte = data[i]
            
            if escape_next:
                escape_next = False
                continue
            
            if byte == ord('\\'):
                escape_next = True
                continue
            
            if byte == ord('"'):
                quote_open = not quote_open
                continue
            
            if not quote_open:
                if byte == ord('{') or byte == ord('['):
                    brace_count += 1
                elif byte == ord('}') or byte == ord(']'):
                    brace_count -= 1
                    if brace_count == 0:
                        return i
        
        return start_pos  # 未找到匹配的结束
    
    def find_player_configs(self, data):
        """查找播放器配置"""
        
        print("   🔍 查找播放器配置...")
        
        player_keywords = [
            b'video',
            b'player',
            b'source',
            b'src',
            b'url',
            b'play',
            b'doubao'
        ]
        
        found_configs = []
        
        for keyword in player_keywords:
            positions = []
            start = 0
            
            while True:
                pos = data.find(keyword, start)
                if pos == -1:
                    break
                positions.append(pos)
                start = pos + 1
            
            if positions:
                found_configs.append({
                    'keyword': keyword.decode(),
                    'count': len(positions),
                    'positions': positions[:5]
                })
        
        if found_configs:
            print(f"   📊 找到 {len(found_configs)} 种播放器相关关键词")
            
            for config in found_configs:
                print(f"      {config['keyword']}: {config['count']}次出现")
        
        return found_configs
    
    def analyze_byte_distribution(self, data):
        """分析字节分布特征"""
        
        print("   🔍 分析字节分布...")
        
        counter = Counter(data)
        total_bytes = len(data)
        
        print(f"   字节分布统计 (总字节数: {total_bytes:,}):")
        
        # 显示最常见的字节
        most_common = counter.most_common(10)
        
        for byte_val, count in most_common:
            percentage = (count / total_bytes) * 100
            ascii_char = chr(byte_val) if 32 <= byte_val <= 126 else f"\\x{byte_val:02x}"
            print(f"      {ascii_char}: {count:,} ({percentage:.1f}%)")
        
        # 分析特征
        null_bytes = counter.get(0, 0)
        printable_chars = sum(counter[i] for i in range(32, 127))
        high_bytes = sum(counter[i] for i in range(128, 256))
        
        print(f"   特征分析:")
        print(f"      空字节(00): {null_bytes:,} ({(null_bytes/total_bytes)*100:.1f}%)")
        print(f"      可打印字符: {printable_chars:,} ({(printable_chars/total_bytes)*100:.1f}%)")
        print(f"      高位字节: {high_bytes:,} ({(high_bytes/total_bytes)*100:.1f}%)")
        
        # 基于分布推测文件类型
        compression_indicators = {
            'high_null_bytes': null_bytes > total_bytes * 0.1,
            'low_printable': (printable_chars/total_bytes) < 0.3,
            'high_byte_entropy': len(counter) > 200
        }
        
        if compression_indicators['low_printable'] and compression_indicators['high_byte_entropy']:
            print(f"   💡 推测: 可能是压缩或加密数据")
        elif compression_indicators['high_null_bytes']:
            print(f"   💡 推测: 可能是结构化二进制格式")
        else:
            print(f"   💡 推测: 可能是混合编码数据")
        
        return {
            'distribution': counter,
            'indicators': compression_indicators,
            'stats': {
                'total': total_bytes,
                'null_bytes': null_bytes,
                'printable': printable_chars,
                'high_bytes': high_bytes
            }
        }

def main():
    """主函数"""
    
    print("""
    ================================================================
    🔬 豆包响应二进制深度分析
    深入探索二进制数据中的隐藏信息
    ================================================================
    """)
    
    analyzer = BinaryContentAnalyzer()
    
    # 分析文件
    filename = "/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/doubao_page_content.html"
    
    results = analyzer.hex_dump_analyze(filename)
    
    print("\n🎯 分析完成！")
    
    # 保存分析结果
    import json
    with open("/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/binary_analysis_results.json", 'w') as f:
        # 转换结果为可串行化格式
        saveable_results = {}
        for key, value in results.items():
            if hasattr(value, 'items'):  # 字典
                saveable_results[key] = value
            elif isinstance(value, list):
                saveable_results[key] = value[:20]  # 限制列表大小
            else:
                saveable_results[key] = str(value)  # 转换为字符串
        
        json.dump(saveable_results, f, ensure_ascii=False, indent=2, default=str)
    
    print("\n📊 分析结果已保存到: binary_analysis_results.json")
    
    print("\n💡 关键发现总结:")
    print("   • 检查字节分布是否显示压缩或加密")
    print("   • 分析找到的字符串是否包含视频信息")
    print("   • 查找可能的URL或CDN配置")
    print("   • 研究二进制结构特征")

if __name__ == "__main__":
    main()