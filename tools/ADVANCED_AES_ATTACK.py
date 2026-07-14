#!/usr/bin/env python3
"""
高级AES攻击 - 直接针对高熵值和密钥名称进行模式识别
"""
import re
import base64
from collections import Counter

def advanced_aes_attack():
    """高级AES攻击"""
    
    print("" + "=" * 80)
    print("🔥🔥🔥 高级AES攻击 🔥🔥🔥")
    print("直接攻击高熵值和密钥名称")
    print("=" * 80)
    
    # 加载20KB明文数据
    with open('CLEAN_EXTRACTED_DATA.txt', 'r') as f:
        text = f.read()
    
    print(f"📊 攻击20,025字符数据")
    
    # 提取所有可能的密钥值
    key_patterns = [
        r'[a-zA-Z0-9_]{4,16}',  # 常规key名
        r'[0-9a-f]{32,}',       # Hex格式key
        r'[A-Za-z0-9+/=]{24,}',  # Base64格式key
    ]
    
    all_keys = []
    for pattern in key_patterns:
        matches = re.findall(pattern, text)
        all_keys.extend(matches)
    
    print(f"🔍 提取到 {len(all_keys)} 个可能key")
    
    # 频率分析 - 寻找重复key
    key_counter = Counter(all_keys)
    print(f"\n🎯 高频Key分析:")
    for key, count in key_counter.most_common(10):
        if count > 5 and len(key) > 3:
            print(f"   {key} (出现{count}次)")
    
    # 提取所有高熵字符串 (AES候选)
    high_entropy_strings = []
    
    # 多字符分隔符处理
    segments = re.split(r'[ \n\t\":;\'\',\[\]{}()<>|=+\-*/]', text)
    
    for segment in segments:
        if len(segment) < 30:  # 重点在长字符串
            continue
            
        # 计算熵值
        unique_chars = len(set(segment))
        total_chars = len(segment)
        entropy = unique_chars / total_chars if total_chars > 0 else 0
        
        if entropy > 0.75:  # 高熵阈值
            high_entropy_strings.append((segment, entropy))
    
    # 按熵值排序
    high_entropy_strings.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n🎯 发现 {len(high_entropy_strings)} 个高熵字符串 (>0.75)")
    
    if high_entropy_strings:
        print(f"\n🔍 Top 10高熵字符串:")
        for i, (string, entropy) in enumerate(high_entropy_strings[:10]):
            print(f"   [{i+1}] 熵值{entropy:.3f}: {string[:80]}...")
    
    # 保存高熵字符串
    with open('HIGH_ENTROPY_CANDIDATES.txt', 'w') as f:
        f.write(f"高熵字符串候选 ({len(high_entropy_strings)} 个)\n\n")
        for string, entropy in high_entropy_strings:
            f.write(f"熵值{entropy:.3f}: {string}\n\n")
    print(f"💾 高熵候选已保存")
    
    # 尝试常见AES解密模式
    try_aes_decryption_patterns(text, high_entropy_strings)
    
    # 寻找key-ciphertext配对
    find_key_ciphertext_pairs(text, high_entropy_strings)
    
    # 尝试暴力破解模式
    try_bruteforce_patterns(text, high_entropy_strings)

def try_aes_decryption_patterns(text, candidates):
    """尝试常见AES解密模式"""
    
    print(f"\n🔍 AES解密模式尝试:")
    
    # 截取前10个最高熵的候选
    top_candidates = [cand[0] for cand in candidates[:10]]
    
    success_count = 0
    for i, candidate in enumerate(top_candidates):
        print(f"\n🎯 尝试候选[{i+1}]: {candidate[:50]}...")
        
        # 模式1: 直接Base64解码
        try:
            if len(candidate) % 4 == 0 and re.match(r'^[A-Za-z0-9+/=]*$', candidate):
                decoded = base64.b64decode(candidate)
                print(f"   ✅ Base64解码: {len(decoded)} 字节")
                
                # 检查是否为AES块大小
                if len(decoded) % 16 == 0:
                    print(f"   🎯 符合AES块大小 (16字节倍数)")
                    
                    # 保存解码结果
                    filename = f"candidate_{i+1}_base64_decoded.bin"
                    with open(filename, 'wb') as f:
                        f.write(decoded)
                    print(f"   💾 保存到 {filename}")
                    
                    success_count += 1
        
        except Exception as e:
            print(f"   ❌ Base64失败: {e}")
        
        # 模式2: Hex解码
        try:
            if re.match(r'^[0-9a-fA-F]+$', candidate):
                hex_bytes = bytes.fromhex(candidate)
                print(f"   ✅ Hex解码: {len(hex_bytes)} 字节")
                
                if len(hex_bytes) % 16 == 0:
                    print(f"   🎯 符合AES块大小")
                    
                    filename = f"candidate_{i+1}_hex_decoded.bin"
                    with open(filename, 'wb') as f:
                        f.write(hex_bytes)
                    print(f"   💾 保存到 {filename}")
                    
                    success_count += 1
        
        except Exception as e:
            print(f"   ❌ Hex失败: {e}")
        
        # 模式3: 可能压缩的Base64
        try:
            # 清理Base64数据
            cleaned = re.sub(r'[^A-Za-z0-9+/=]', '', candidate)
            if len(cleaned) > len(candidate) * 0.8 and len(cleaned) > 20:  # 大部分是Base64字符
                padding = 4 - (len(cleaned) % 4) % 4
                padded = cleaned + ('=' * padding)
                
                if re.match(r'^[A-Za-z0-9+/=]*$', padded):
                    decoded = base64.b64decode(padded, validate=False)
                    print(f"   ✅ 清理Base64解码: {len(decoded)} 字节")
                    
                    # 检查是否包含可打印文本
                    try:
                        text_result = decoded.decode('utf-8', errors='ignore')
                        if len(text_result) > 50 and any(c.isalpha() for c in text_result):
                            print(f"   🎯🎯🎯 发现可读文本!")
                            print(f"   文本: {text_result[:200]}")
                            
                            # 检查media关键词
                            text_lower = text_result.lower()
                            if any(kw in text_lower for kw in ['original', 'media', 'url', 'video', 'doubao']):
                                print(f"   🎉🎉🎉 找到media关键词!")
                                
                                filename = f"CANDIDATE_{i+1}_SUCCESS.txt"
                                with open(filename, 'w', encoding='utf-8') as f:
                                    f.write(text_result)
                                print(f"   🎯 保存到 {filename}")
                    
                    except Exception as e:
                        print(f"   ❌ 文本解码失败")
                    
                    # 检查是否为压缩数据
                    try:
                        import gzip
                        import zlib
                        
                        try:
                            decompressed = gzip.decompress(decoded)
                            print(f"   ✅ 内部gzip: {len(decompressed)} 字节")
                        except:
                            try:
                                decompressed = zlib.decompress(decoded)
                                print(f"   ✅ 内部zlib: {len(decompressed)} 字节")
                            except:
                                pass
                    
                    except Exception as e:
                        print(f"   ❌ 内部解压失败")
        
        except Exception as e:
            print(f"   ❌ 清理Base64失败: {e}")
    
    print(f"\n📊 AES模式尝试: {success_count}/{len(top_candidates)} 成功")

def find_key_ciphertext_pairs(text, candidates):
    """寻找key-ciphertext配对"""
    
    print(f"\n🔍 Key-Ciphertext配对搜索:")
    
    # 搜索变量赋值模式
    assignment_patterns = [
        r'(\w+)\s*=\s*"([^"]{50,})"',
        r'(\w+)\s*=\s*\'([^\']{50,})\'',
        r'(\w+)\s*:\s*"([^"]{50,})"',
        r'(\w+)\s*:\s*([^\s,;]{50,})',
    ]
    
    pairs_found = []
    
    for pattern in assignment_patterns:
        matches = re.findall(pattern, text)
        for key, value in matches:
            # 检查value是否高熵
            unique_chars = len(set(value))
            entropy = unique_chars / len(value) if len(value) > 0 else 0
            
            if entropy > 0.7:  # 高熵值可能为密文
                pairs_found.append((key, value, entropy))
    
    print(f"   🎯 找到 {len(pairs_found)} 个key-ciphertext配对")
    
    if pairs_found:
        # 保存配对
        with open('KEY_CIPHERTEXT_PAIRS.txt', 'w') as f:
            f.write(f"Key-Ciphertext配对 ({len(pairs_found)} 个)\n\n")
            for key, ciphertext, entropy in pairs_found[:20]:  # 前20个
                f.write(f"Key: {key}\nEntropy: {entropy:.3f}\nCiphertext: {ciphertext[:100]}...\n\n")
        
        print(f"   💾 配对已保存 (前20个)")
        
        # 显示前5个可能的original候选
        print(f"   🎯 可能original字段候选:")
        for i, (key, ciphertext, entropy) in enumerate(pairs_found[:5]):
            print(f"      [{i+1}] {key} (熵值: {entropy:.3f}) - {ciphertext[:50]}...")

def try_bruteforce_patterns(text, candidates):
    """尝试暴力破解模式"""
    
    print(f"\n🔍 暴力破解模式尝试:")
    
    # 查找可能的硬编码密钥
    hardcoded_keys = re.findall(r'["\']?([a-zA-Z0-9_]{8,32})["\']?', text)
    
    # 去重并筛选
    unique_keys = list(set(hardcoded_keys))
    likely_keys = []
    
    for key in unique_keys:
        # AES密钥常见长度：16, 24, 32字符
        if len(key) in [16, 24, 32]:
            likely_keys.append((key, len(key)))
    
    if likely_keys:
        print(f"   🎯 找到 {len(likely_keys)} 个可能的AES密钥:")
        for key, length in likely_keys:
            print(f"      {key} (长度: {length})")
        
        # 保存密钥候选
        with open('AES_KEY_CANDIDATES.txt', 'w') as f:
            f.write(f"AES密钥候选 ({len(likely_keys)} 个)\n\n")
            for key, length in likely_keys:
                f.write(f"长度{length}: {key}\n")
        print(f"   💾 AES密钥已保存")
    
    else:
        print(f"   ❌ 未找到合适长度的AES密钥")

if __name__ == "__main__":
    advanced_aes_attack()
    
    print(f"\n🎯 高级AES攻击完成！")
    print(f"💡 检查生成的文件查看突破结果")