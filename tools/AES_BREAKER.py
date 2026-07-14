#!/usr/bin/env python3
"""
AES破解器 - 针对发现的15个加密值进行AES特征分析
"""
import re
import base64
import binascii
from collections import Counter

def break_aes_encryption():
    """破解AES加密的original字段"""
    
    print("💥💥💥 AES破解攻击 💥💥💥")
    print("目标: 针对15个High_Entropy加密值寻找AES解密")
    
    # 加载20KB明文数据
    with open('CLEAN_EXTRACTED_DATA.txt', 'r') as f:
        text = f.read()
    
    print(f"📊 分析20,025字符数据")
    
    # 提取所有高熵值 (从之前分析中的长字段)
    high_entropy_candidates = re.findall(r'[^\s\n]{50,}', text)
    
    print(f"🎯 找到 {len(high_entropy_candidates)} 个长字符串候选")
    
    # 过滤高熵候选
    aes_like_candidates = []
    
    for candidate in high_entropy_candidates:
        # 计算熵值 (字符多样性)
        unique_chars = len(set(candidate))
        total_chars = len(candidate)
        entropy_ratio = unique_chars / total_chars if total_chars > 0 else 0
        
        # 高熵条件
        if (entropy_ratio > 0.6 and total_chars > 40 and 
            not re.match(r'^[a-zA-Z0-9]+$', candidate) and  # 不是纯字母数字
            not re.match(r'^[0-9]+$', candidate)):  # 不是纯数字
            
            aes_like_candidates.append((candidate, entropy_ratio))
    
    print(f"✅ AES-like高熵候选: {len(aes_like_candidates)}")
    
    # 按熵值排序
    aes_like_candidates.sort(key=lambda x: x[1], reverse=True)
    
    # 分析前10个最高熵值
    for i, (candidate, entropy) in enumerate(aes_like_candidates[:10]):
        print(f"\n🎯 AES候选[{i+1}]: (熵值: {entropy:.3f})")
        print(f"   值: {candidate[:100]}...")
        
        # 尝试Base64解码
        try:
            if len(candidate) % 4 == 0:  # Base64长度条件
                padding = '=' * (4 - len(candidate) % 4) % 4
                padded_candidate = candidate + padding
                
                # 只尝试纯base64字符
                if re.match(r'^[A-Za-z0-9+/=]*$', padded_candidate):
                    decoded = base64.b64decode(padded_candidate, validate=False)
                    print(f"   ✅ Base64解码: {len(decoded)} 字节")
                    
                    # 检查AES块大小 (16字节倍数)
                    if len(decoded) % 16 == 0:
                        print(f"   🎯 符合AES块大小!")
                        
                        # 检查是否为有效文本解密
                        try:
                            text_result = decoded.decode('utf-8', errors='ignore')
                            if len(text_result) > 50 and any(c.isalpha() for c in text_result):
                                print(f"   🎯🎯🎯 发现可读文本!")
                                print(f"   文本: {text_result[:200]}")
                                
                                # 搜索media关键词
                                if any(kw in text_result.lower() for kw in ['original', 'media', 'url', 'video']):
                                    print(f"   🎉🎉🎉 找到media关键词!")
                                    save_candidate(text_result, f"aes_candidate_{i+1}", "media_found")
                        except:
                            pass
                    
                    # 保存Base64解码结果
                    save_candidate(decoded, f"aes_candidate_{i+1}", "base64_decoded")
        
        except Exception as e:
            print(f"   ❌ Base64解码失败: {e}")
        
        # 尝试Hex解码
        try:
            if re.match(r'^[0-9a-fA-F]+$', candidate) and len(candidate) > 32:
                hex_bytes = bytes.fromhex(candidate)
                print(f"   ✅ Hex解码: {len(hex_bytes)} 字节")
                
                # 检查AES块大小
                if len(hex_bytes) % 16 == 0:
                    print(f"   🎯 符合AES块大小!")
                    
                    save_candidate(hex_bytes, f"aes_candidate_{i+1}", "hex_decoded")
        
        except Exception as e:
            print(f"   ❌ Hex解码失败: {e}")
    
    # 寻找可能的key/iv模式
    search_key_patterns(text)
    
    # 尝试常见AES解密方法
    try_common_aes_methods(text, aes_like_candidates)

def search_key_patterns(text):
    """搜索可能的AES密钥模式"""
    
    print(f"\n🔍 AES密钥模式搜索:")
    
    # 之前发现的AES相关key名
    aes_like_names = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', text)
    
    # 寻找可能的密钥变量
    key_candidates = []
    for name in aes_like_names:
        name_lower = name.lower()
        if any(keyword in name_lower for keyword in ['key', 'iv', 'secret', 'pass', 'crypt', 'aes', 'cipher']):
            key_candidates.append(name)
    
    if key_candidates:
        print(f"   🎯 找到 {len(key_candidates)} 个可能的密钥名称:")
        for key in key_candidates:
            print(f"      {key}")
    
    # 寻找实际的密钥值
    key_pattern_1 = r'(?:key|secret|password)\s*[=:]\s*[^\s\n]{8,}'
    key_pattern_2 = r'["\'][0-9a-fA-F]{32,}["\']'  # Hex密钥
    key_pattern_3 = r'["\'][A-Za-z0-9+/=]{24,}["\']'  # Base64密钥
    
    found_key_values = []
    for pattern in [key_pattern_1, key_pattern_2, key_pattern_3]:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            found_key_values.extend(matches)
    
    if found_key_values:
        print(f"   🎯 找到 {len(found_key_values)} 个密钥值:")
        for i, value in enumerate(found_key_values[:5]):
            print(f"      [{i+1}] {value}")
        
        # 保存密钥候选
        with open('AES_KEY_CANDIDATES.txt', 'w') as f:
            f.write(f"找到 {len(found_key_values)} 个AES密钥候选\n\n")
            for val in found_key_values:
                f.write(val + "\n")
        print(f"   💾 密钥候选已保存")

def try_common_aes_methods(text, candidates):
    """尝试常见AES解密方法"""
    
    print(f"\n🔍 常见AES解密方法尝试:")
    
    # 提取所有可能的Base64字符串
    base64_strings = re.findall(r'[A-Za-z0-9+/=]{40,}', text)
    
    print(f"   找到 {len(base64_strings)} 个长Base64字符串")
    
    if base64_strings:
        # 取前5个最长的尝试
        longest_b64 = sorted(base64_strings, key=len, reverse=True)[:5]
        
        for i, b64_str in enumerate(longest_b64):
            print(f"   Base64候选[{i+1}]: {len(b64_str)} 字符")
            
            try:
                decoded = base64.b64decode(b64_str, validate=False)
                print(f"      ✅ Base64解码: {len(decoded)} 字节")
                
                # 检查是否为压缩数据 (gzip/zlib)
                if len(decoded) > 50:
                    # 尝试gzip解压
                    try:
                        import gzip
                        decompressed = gzip.decompress(decoded)
                        print(f"      ✅ 内部gzip: {len(decompressed)} 字节")
                        
                        # 尝试文本解码
                        try:
                            text_result = decompressed.decode('utf-8', errors='ignore')
                            if len(text_result) > 100:
                                print(f"      🎯 内部文本: {len(text_result)} 字符")
                                
                                # 检查媒体信息
                                if any(kw in text_result.lower() for kw in ['original', 'media', 'doubao', 'url']):
                                    print(f"      🎉🎉🎉 发现media信息!")
                                    print(f"      {text_result[:300]}")
                                    
                                    save_candidate(text_result, f"inner_gzip_{i+1}", "media_found")
                        
                        except Exception as e:
                            print(f"      ❌ 内部文本解码失败")
                    
                    except Exception as e:
                        print(f"      ❌ 内部gzip解压失败")
                
                # 保存解码结果
                save_candidate(decoded, f"b64_candidate_{i+1}", "base64_result")
            
            except Exception as e:
                print(f"      ❌ Base64解码失败: {e}")

def save_candidate(data, name, category):
    """保存候选结果"""
    
    try:
        if isinstance(data, bytes):
            filename = f"AES_{category}_{name}.bin"
            with open(filename, 'wb') as f:
                f.write(data)
        else:
            filename = f"AES_{category}_{name}.txt"
            with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                f.write(str(data))
        
        print(f"      💾 已保存: {filename}")
    except Exception as e:
        print(f"      ❌ 保存失败: {e}")

if __name__ == "__main__":
    break_aes_encryption()
    
    print(f"\n🎯 AES破解完成！")
    print(f"💡 检查生成的AES文件查看突破结果")