#!/usr/bin/env python3
"""
专门解密original_media_info字段的工具
基于用户提示：字段被加密而非被关闭
"""
import re
import json
from pathlib import Path

def analyze_binary_structure():
    """分析API响应中的二进制结构"""
    
    print("🔬 深度分析API响应二进制结构\n")
    
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    print(f"🎯 目标文件: {target_file}")
    
    try:
        with open(target_file, 'rb') as f:
            raw_data = f.read()
        
        print(f"📊 文件大小: {len(raw_data):,} 字节")
        
        # 转换为可分析格式
        try:
            text_data = raw_data.decode('utf-8', errors='replace')
        except:
            text_data = str(raw_data)
        
        # 1. 查找JSON结构边界
        print(f"\n📋 分析JSON结构...")
        json_boundaries = re.finditer(r'\{', text_data)
        found_jsons = 0
        
        for i, match in enumerate(json_boundaries):
            if i > 10:  # 限制数量
                break
                
            start_pos = match.start()
            # 向后找1000字符
            search_end = min(start_pos + 1000, len(text_data))
            segment = text_data[start_pos:search_end]
            
            # 查找完整的结构
            brace_count = 0
            for j, char in enumerate(segment):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        complete_json = segment[:j+1]
                        found_jsons += 1
                        print(f"   [{found_jsons}] 找到可能的JSON结构 ({len(complete_json)} 字符)")
                        
                        # 分析这个结构
                        analyze_json_structure(complete_json)
                        break
        
        # 2. 查找加密的二进制块
        print(f"\n🔍 查找加密二进制块...")
        
        # 检查大量的Unicode占位符
        unicode_replacement_patterns = [
            r'(?:\\ufffd|efbfbd){20,}',  # 大量Unicode占位符
            r'(?:[\x00-\x1f\x7f-\xff]{10,})',  # 二进制数据
            r'\{[^\}]*?[\x00-\x1f\x7f-\xff]{10,}[^\}]*?\}'  # JSON中包含二进制
        ]
        
        for pattern in unicode_replacement_patterns:
            matches = re.findall(pattern, text_data, re.IGNORECASE | re.DOTALL)
            if matches:
                print(f"   🎯 找到模式匹配: {pattern[:50]}")
                
                for i, match in enumerate(matches[:3]):
                    print(f"      [{i+1}] {match[:200]}")
                    
                    # 进一步分析
                    analyze_encrypted_block(match)
        
        # 3. 寻找字段名的部分匹配
        print(f"\n🔤 寻找字段名的部分匹配...")
        
        field_patterns = [
            r'[^\\][Oo]riginal[^\\]',
            r'[^\\]media_info[^\\]',
            r'[^\\]main_url[^\\]',
            r'[^\\][Uu]rl[^\\]'
        ]
        
        for pattern in field_patterns:
            matches = re.findall(pattern, text_data)
            if matches:
                unique_matches = list(set(matches))  # 去重
                print(f"   💡 字段模式 {pattern}: {unique_matches}")
        
        # 4. 检查Base64编码块
        print(f"\n🔍 检查Base64编码块...")
        
        base64_patterns = [
            r'(?:[A-Za-z0-9+/]{20,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4}))',
            r'"[A-Za-z0-9+/]{16,}"',
            r'data:[a-z]+/[a-z]+;base64,[A-Za-z0-9+/]+'
        ]
        
        for pattern in base64_patterns:
            matches = re.findall(pattern, text_data)
            
            if matches:
                print(f"   🔤 Base64模式 {pattern[:30]}: 找到 {len(matches)} 个匹配")
                
                for i, match in enumerate(matches[:2]):
                    clean_match = match.strip('"\'  ')
                    print(f"      [{i+1}] {clean_match[:80]}...")
                    
                    # 尝试解码
                    try_decode_base64(clean_match)
        
        # 5. 检查压缩特征
        print(f"\n🗜️ 检查压缩数据特征...")
        
        compression_signatures = [
            r'\x1f\x8b',  # gzip
            r'\x78\x9c',  # zlib
            r'PK\x03\x04',  # zip
            r'BZh',  # bzip2
        ]
        
        for sig in compression_signatures:
            if sig in text_data:
                print(f"   💡 发现压缩特征: {sig}")
        
        return True
        
    except Exception as e:
        print(f"❌ 分析失败: {e}")
        return False

def analyze_json_structure(json_str):
    """分析找到的JSON结构"""
    
    try:
        # 清洗并尝试解析
        cleaned = json_str.strip()
        
        # 查找可能的media info
        if 'media' in cleaned.lower() or 'original' in cleaned.lower():
            print(f"      🔍 可能是相关结构，长度: {len(cleaned)}")
            
            # 尝试部分解析来校验是否有效
            try:
                parsed = json.loads(cleaned)
                print(f"      ✅ 有效JSON包含: {list(parsed.keys())[:5]}")
                
                # 查找嵌套的媒体字段
                find_nested_media_fields(parsed)
                
            except json.JSONDecodeError as e:
                # 可能包含二进制，继续分析
                print(f"      🔍 非纯JSON，包含: {cleaned[:150]}")
                
                # 手动搜索关键字段
                key_patterns = ['original', 'media', 'url', 'video']
                found_keys = []
                for pattern in key_patterns:
                    if pattern in cleaned.lower():
                        found_keys.append(pattern)
                
                if found_keys:
                    print(f"      💡 手动发现字段: {found_keys}")
    
    except Exception as e:
        pass

def analyze_encrypted_block(block_data):
    """分析二进制加密块"""
    
    # 统计特征
    features = {
        'length': len(block_data),
        'binary_bytes': 0,
        'printable_ratio': 0,
        'unicode_replaces': 0,
        'potential_encoding': 'unknown'
    }
    
    # 计算非打印字符
    for byte in block_data.encode('utf-8', errors='replace'):
        if byte < 32 or byte > 126:
            features['binary_bytes'] += 1
    
    # 计算比例
    if len(block_data) > 0:
        features['printable_ratio'] = 1 - (features['binary_bytes'] / len(block_data))
    
    # 计数Unicode替换符  
    features['unicode_replaces'] = block_data.count('\uffffd')
    
    # 推测编码类型
    if features['printable_ratio'] > 0.8:
        features['potential_encoding'] = 'mostly_text'
    elif features['printable_ratio'] > 0.5:
        features['potential_encoding'] = 'mixed'
    else:
        features['potential_encoding'] = 'likely_encrypted'
    
    print(f"      🔍 加密块分析: 长度={features['length']}, 非打印比例={1-features['printable_ratio']:.2f}, Unicode替换={features['unicode_replaces']}")
    
    return features

def try_decode_base64(data):
    """尝试解码Base64数据"""
    
    try:
        import base64
        
        decoded = base64.b64decode(data)
        print(f"         ✅ Base64解码成功，长度: {len(decoded)} 字节")
        
        # 检查解码内容
        if len(decoded) > 0:
            # 尝试作为文本
            try:
                text_content = decoded.decode('utf-8', errors='ignore')
                if len(text_content) > 10 and any(char in text_content for char in ['http', 'json', 'video', 'media']):
                    print(f"         💡 解码文本包含: {text_content[:100]}")
            except:
                pass
            
            # 检查是否JSON起始
            if decoded[0] in [123, 91]:  # '{' 或 '['
                print(f"         💡 可能是编码的JSON数据")
            
            # 检查是否压缩
            if decoded[:2] in [b'\x1f\x8b', b'\x78\x9c']:
                print(f"         💡 可能是编码的压缩数据")
        
    except Exception as e:
        print(f"         ❌ Base64解码失败: {e}")

def find_nested_media_fields(data, path=""):
    """递归查找嵌套的媒体字段"""
    
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            
            # 媒体相关字段
            if any(media_key in key.lower() for media_key in ['media', 'video', 'url', 'original']):
                print(f"         🔍 嵌套字段 [{current_path}]: {str(value)[:100]}")
                
                # 检查是否加密
                if isinstance(value, str) and len(value) > 50:
                    analyze_encrypted_block(value)
            
            # 递归扫描
            if isinstance(value, (dict, list)):
                find_nested_media_fields(value, current_path)
    
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, (dict, list)):
                find_nested_media_fields(item, f"{path}[{i}]")

def main():
    """主函数"""
    print(f"""
    ================================================================
    🔐 original_media_info字段解密工具
    专门分析被加密而非被关闭的media_info字段  
    ================================================================
    """)
    
    analyze_binary_structure()
    
    print(f"\n🎯 分析完成！")
    print(f"\n💡 下一步建议:")
    print(f"   1. 基于发现的加密特征设计解密算法")
    print(f"   2. 尝试多种编码组合 (gzip + base64 + unicode)")
    print(f"   3. 使用APK逆向工具查找实际解密算法")
    print(f"   4. 与已知的二进制数据特征对比")

if __name__ == "__main__":
    main()