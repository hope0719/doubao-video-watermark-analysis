#!/usr/bin/env python3
"""
多层递归解密工具
针对original_media_info字段被加密的问题
"""
import base64
import gzip
import zlib
import binascii
from urllib.parse import unquote
import re
import json

def multi_layer_decrypt():
    """多层解密"""
    print("🔓 多层递归解密工具\n")
    
    # 读取源数据
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    
    try:
        with open(target_file, 'rb') as f:
            data = f.read()
        
        print(f"📊 源数据大小: {len(data):,} 字节")
        
        # 尝试多种解密组合
        decryption_strategies = [
            {'name': 'direct_utf8_repair', 'function': decrypt_utf8_repair},
            {'name': 'base64_gzip_unquote', 'function': decrypt_base64_gzip_unquote},
            {'name': 'zlib_decompress', 'function': decrypt_zlib},
            {'name': 'hex_to_bytes', 'function': decrypt_hex_to_bytes},
            {'name': 'unicode_fix', 'function': decrypt_unicode_fix}
        ]
        
        print(f"🚀 开始多层解密...")
        
        for strategy in decryption_strategies:
            print(f"\n📋 尝试: {strategy['name']}")
            
            try:
                result = strategy['function'](data)
                if result and is_valid_media_info(result):
                    print(f"   🎯 成功！发现有效媒体信息！")
                    analyze_result(result, strategy['name'])
                elif result:
                    print(f"   💭 部分结果: {str(result)[:200]}")
                else:
                    print(f"   ❌ 无结果")
            except Exception as e:
                print(f"   ❌ 失败: {e}")
        
        # 额外尝试：找到并单独解密JSON结构
        print(f"\n🔍 特化解密：处理发现的加密JSON块...")
        
        # 找到所有看起来像加密JSON的结构
        json_pattern = r'\{[^}]*?[\x00-\x1f\x7f-\xff][^}]*?\}'
        
        if isinstance(data, bytes):
            data_str = data.decode('utf-8', errors='replace')
        else:
            data_str = str(data)
        
        encrypted_jsons = re.findall(json_pattern, data_str)
        
        if encrypted_jsons:
            print(f"   找到 {len(encrypted_jsons)} 个加密JSON结构")
            
            for i, encrypted_json in enumerate(encrypted_jsons[:3]):
                print(f"   🔓 试图解密结构 {i+1}...")
                
                try:
                    # 多种解码尝试
                    decoded = try_all_decodings(encrypted_json)
                    
                    if decoded and is_valid_media_info(decoded):
                        print(f"      🎉 成功解密！")
                        analyze_result(decoded, f"json_block_{i+1}")
                        
                except Exception as e:
                    print(f"      ❌ 解密失败: {e}")
        
    except Exception as e:
        print(f"❌ 整体失败: {e}")

def decrypt_utf8_repair(data):
    """修复UTF-8编码错误"""
    
    if isinstance(data, str):
        data_bytes = data.encode('utf-8', errors='replace')
    else:
        data_bytes = data
    
    # 尝试不同编码
    encodings = ['utf-8', 'gbk', 'latin1', 'cp1252']
    best_result = None
    best_ratio = 0
    
    for encoding in encodings:
        try:
            result = data_bytes.decode(encoding, errors='replace')
            
            # 评估文本质量
            readable_ratio = count_readable_chars(result) / len(result) if result else 0
            
            if readable_ratio > best_ratio:
                best_ratio = readable_ratio
                best_result = result
                
        except:
            pass
    
    return best_result

def decrypt_base64_gzip_unquote(data):
    """Base64 -> Gzip -> URL解码"""
    
    # 如果已经是字符串
    if isinstance(data, str):
        input_data = data
    else:
        input_data = data.decode('utf-8', errors='ignore')
    
    # 先URL decode
    try:
        url_decoded = unquote(input_data)
        if url_decoded != input_data:
            print(f"      URL解码有效")
    except:
        url_decoded = input_data
    
    # 搜索可能的Base64块
    base64_pattern = r'(?:[A-Za-z0-9+/]{20,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4}))'
    base64_matches = re.findall(base64_pattern, url_decoded)
    
    if base64_matches:
        for match in base64_matches[:2]:  # 测试前2个
            try:
                decoded = base64.b64decode(match)
                print(f"      Base64解码，长度: {len(decoded)}")
                
                # 尝试gzip解压
                try:
                    uncompressed = gzip.decompress(decoded)
                    print(f"      Gzip解压，长度: {len(uncompressed)}")
                    return uncompressed.decode('utf-8', errors='ignore')
                except:
                    # 直接返回Base64解码
                    if len(decoded) > 100:
                        return decoded.decode('utf-8', errors='ignore')
                        
            except:
                continue
    
    return url_decoded

def decrypt_zlib(data):
    """Zlib解压"""
    
    if isinstance(data, str):
        try:
            data_bytes = data.encode('utf-8')
        except:
            return None
    else:
        data_bytes = data
    
    try:
        decompressed = zlib.decompress(data_bytes)
        print(f"      Zlib解压，长度: {len(decompressed)}")
        return decompressed.decode('utf-8', errors='ignore')
    except:
        # 尝试部分zlib
        if len(data_bytes) > 100:
            try:
                partial = data_bytes[:500]  # 尝试前500字节
                decompressed = zlib.decompress(partial)
                return decompressed.decode('utf-8', errors='ignore')
            except:
                pass
    
    return None

def decrypt_hex_to_bytes(data):
    """尝试十六进制解码"""
    
    if isinstance(data, str):
        input_str = data
    else:
        input_str = data.decode('utf-8', errors='ignore')
    
    # 查找长16进制串
    hex_pattern = r'[0-9a-fA-F]{40,}'
    hex_matches = re.findall(hex_pattern, input_str)
    
    for hex_str in hex_matches:
        try:
            decoded = bytes.fromhex(hex_str)
            print(f"      16进制解码，长度: {len(decoded)}")
            
            # 继续解码
            try:
                text_result = decoded.decode('utf-8', errors='ignore')
                return text_result
            except:
                # 尝试更多的解码层
                if b'\x78\x9c' in decoded[:10]:  # zlib header
                    try:
                        decompressed = zlib.decompress(decoded)
                        return decompressed.decode('utf-8', errors='ignore')
                    except:
                        pass
                        
        except:
            continue
    
    return None

def decrypt_unicode_fix(data):
    """Unicode修复"""
    
    if isinstance(data, str):
        text = data
    else:
        text = data.decode('utf-8', errors='replace')
    
    # 修复常见的Unicode替换符
    replacements = [
        ('\ufffd', ''),  # Unicode replacement char
        ('ï¿½', ''),     # UTF-8 decoding error
        ('\\u0000', ''),  # NULL character
    ]
    
    cleaned = text
    for old, new in replacements:
        cleaned = cleaned.replace(old, new)
    
    # 如果清理后有显著变化
    if len(cleaned) != len(text):
        print(f"      Unicode清理: {len(text)} -> {len(cleaned)}")
        return cleaned
    
    return None

def try_all_decodings(encrypted_text):
    """尝试所有编码组合"""
    
    strategies = [decrypt_utf8_repair, decrypt_base64_gzip_unquote, 
                  decrypt_zlib, decrypt_hex_to_bytes, decrypt_unicode_fix]
    
    for strategy in strategies:
        try:
            result = strategy(encrypted_text)
            if result and len(result) > 50:
                return result
        except:
            continue
    
    return None

def count_readable_chars(text):
    """计算可读字符数"""
    count = 0
    for char in text:
        if 32 <= ord(char) <= 126:  # ASCII printable
            count += 1
    return count

def is_valid_media_info(text):
    """判断是否可能是有效的媒体信息"""
    
    if not text or len(text) < 30:
        return False
    
    # 关键关键词
    keywords = ['url', 'media', 'video', 'original', 'http', 'www']
    
    keyword_count = 0
    text_lower = text.lower()
    
    for keyword in keywords:
        if keyword in text_lower:
            keyword_count += 1
    
    return keyword_count >= 2

def analyze_result(result, source):
    """分析解密结果"""
    
    print(f"\n  🎯 分析有效结果 [来源: {source}]")
    print(f"   大小: {len(result)} 字符")
    
    # 查找URL
    import re
    urls = re.findall(r'https?://[^\s"{}\[\]{}]+', result)
    
    if urls:
        print(f"   💡 发现URLs ({len(urls)}):")
        for i, url in enumerate(urls[:3]):
            print(f"      [{i+1}] {url[:100]}")
            
            # 检查是否无水印
            if 'doubao' in url:
                if 'unwatermark' in url:
                    print(f"         🎯🎯🎯 无水印确认！")
                    save_unwatermarked_url(url, source)
                elif 'watermark' not in url:
                    print(f"         💭 可能无水印")
    
    # 检查JSON结构  
    json_pattern = r'\{[^\}]*?(?:url|media|video)[^\}]*?\}'
    json_matches = re.findall(json_pattern, result, re.IGNORECASE)
    
    if json_matches:
        print(f"   🔍 发现JSON结构:")
        for match in json_matches[:2]:
            clean_match = match.replace('\n', ' ').replace('\r', '')
            print(f"      {clean_match[:200]}")
    
    # 保存到文件
    filename = f"decrypted_result_{source}.txt"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f"   💾 已保存到 {filename}")

def save_unwatermarked_url(url, source):
    """保存找到的无水印URL"""
    
    filename = "UNWATERMARKED_FOUND_via_encryption.txt"
    with open(filename, 'a') as f:
        f.write(f"\n=== 解密发现 [{source}] ===\n")
        f.write(f"URL: {url}\n")
        f.write(f"长度: {len(url)}\n")
        f.write(f"="*80 + "\n")
    
    print(f"   🎉 无水印URL已保存到 {filename}")

if __name__ == "__main__":
    multi_layer_decrypt()