#!/usr/bin/env python3
"""
最终AES破解 - 直接针对3个密钥和9个配对进行解密
"""
import re
import base64
import binascii
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from collections import Counter

def final_aes_crack():
    """最终AES暴力破解"""
    
    print("" + "=" * 80)
    print("💥💥💥 最终AES暴力破解 💥💥💥")
    print("目标: 使用3个密钥解密9个配对，寻找original字段")
    print("=" * 80)
    
    # 加载20KB明文数据
    with open('CLEAN_EXTRACTED_DATA.txt', 'r') as f:
        text = f.read()
    
    print(f"📊 暴力破解20,025字符数据")
    
    # 直接提取我们发现的3个AES密钥
    aes_keys = [
        'HW2UxdAsG53CHD4_',  # 16字节
        'aDJda58xJOR_UOL6',  # 16字节  
        '5my_ycVCnHVwyjX8'   # 16字节
    ]
    print(f"🎯 使用 {len(aes_keys)} 个AES-128密钥进行暴力破解")
    
    # 提取key-ciphertext配对
    pairs = extract_key_ciphertext_pairs(text)
    print(f"🎯 找到 {len(pairs)} 个key-ciphertext配对")
    
    if not pairs:
        print(f"❌ 未找到配对")
        return
    
    # 显示前10个配对
    print(f"\n🔍 Top 10配对预览:")
    for i, (key, ciphertext, entropy) in enumerate(pairs[:10]):
        print(f"   [{i+1}] {key} (熵值{entropy:.3f}) - {ciphertext[:50]}...")
    
    # 针对每个key，尝试所有可能的解密
    for key_idx, aes_key in enumerate(aes_keys):
        print(f"\n🔥🔥🔥 尝试AES密钥[{key_idx+1}]: {aes_key} 🔥🔥🔥")
        
        success_count = 0
        
        # 尝试所有9个配对
        for pair_idx, (pair_key, ciphertext, entropy) in enumerate(pairs[:9]):
            print(f"\n🎯 尝试配对[{pair_idx+1}]: {pair_key} (熵值{entropy:.3f})")
            print(f"   密文: {ciphertext[:100]}...")
            
            # 多种解密尝试
            result = try_decrypt_with_key(aes_key, ciphertext, pair_key)
            
            if result:
                success_count += 1
                print(f"   ✅ 解密成功！")
                
                # 保存成功结果
                filename = f"AES_KEY{key_idx+1}_PAIR{pair_idx+1}_SUCCESS.txt"
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(f"AES密钥: {aes_key}\n配对Key: {pair_key}\n熵值: {entropy:.3f}\n\n")
                    f.write(result)
                
                print(f"   💾 保存到 {filename}")
                
                # 检查是否包含original/media信息
                result_lower = result.lower()
                if any(kw in result_lower for kw in ['original', 'media_info', 'main_url', 'doubao', 'video', 'unwatermark']):
                    print(f"   🎉🎉🎉 发现MEDIA关键词！")
                    
                    # 保存重大突破
                    with open(f"BREAKTHROUGH_MEDIA_{key_idx+1}_{pair_idx+1}.txt", 'w', encoding='utf-8') as f:
                        f.write(f"🎯 找到media信息！\nAES密钥: {aes_key}\n\n")
                        f.write(result)
                    
                    print(f"   🎯🎯🎯 重大发现已保存！")
        
        print(f"\n📊 AES密钥[{key_idx+1}]结果: {success_count}/{len(pairs[:9])} 成功")
    
    print(f"\n🎯 AES暴力破解已完成")
    print(f"💡 检查生成的SUCCESS文件")

def extract_key_ciphertext_pairs(text):
    """提取key-ciphertext配对"""
    
    pairs = []
    
    # 多模式提取
    patterns = [
        r'(\w+)\s*=\s*["\']([^"\']{40,})["\']',
        r'(\w+)\s*:\s*["\']([^"\']{40,})["\']',
        r'(\w+)\s*=\s*([^\s,;]{40,})',
        r'(\w+)\s*:\s*([^\s,;]{40,})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for key, value in matches:
            # 计算熵值
            if len(value) > 0:
                unique_chars = len(set(value))
                entropy = unique_chars / len(value)
                
                if entropy > 0.65:  # 高熵阈值
                    pairs.append((key, value, entropy))
    
    # 按熵值排序
    pairs.sort(key=lambda x: x[2], reverse=True)
    
    # 去重
    unique_pairs = []
    seen_keys = set()
    
    for key, value, entropy in pairs:
        pair_id = f"{key}:{value[:20]}"
        if pair_id not in seen_keys:
            seen_keys.add(pair_id)
            unique_pairs.append((key, value, entropy))
    
    return unique_pairs

def try_decrypt_with_key(aes_key, ciphertext, pair_key):
    """尝试用AES密钥解密"""
    
    try:
        # 转换key为bytes
        key_bytes = aes_key.encode('utf-8')
        
        # 多种密文解码尝试
        ciphertext_bytes = None
        
        # 尝试1: Base64解码
        try:
            if len(ciphertext) % 4 == 0 and re.match(r'^[A-Za-z0-9+/=]*$', ciphertext):
                ciphertext_bytes = base64.b64decode(ciphertext, validate=False)
        except:
            pass
        
        # 尝试2: Hex解码
        if not ciphertext_bytes:
            try:
                if re.match(r'^[0-9a-fA-F]+$', ciphertext) and len(ciphertext) % 2 == 0:
                    ciphertext_bytes = bytes.fromhex(ciphertext)
            except:
                pass
        
        # 尝试3: 清理后Base64
        if not ciphertext_bytes:
            try:
                cleaned = re.sub(r'[^A-Za-z0-9+/=]', '', ciphertext)
                if len(cleaned) > len(ciphertext) * 0.7:
                    padding = 4 - (len(cleaned) % 4) % 4
                    padded = cleaned + ('=' * padding)
                    if re.match(r'^[A-Za-z0-9+/=]*$', padded):
                        ciphertext_bytes = base64.b64decode(padded, validate=False)
            except:
                pass
        
        if not ciphertext_bytes:
            print(f"   ❌ 密文解码失败")
            return None
        
        print(f"   ✅ 密文解码: {len(ciphertext_bytes)} 字节")
        
        # 检查是否为AES块大小
        if len(ciphertext_bytes) % 16 != 0:
            print(f"   ❌ 不是AES块大小")
            return None
        
        print(f"   🎯 符合AES块大小")
        
        # 多种AES模式尝试
        aes_modes = [
            ('ECB', AES.MODE_ECB),
            ('CBC', AES.MODE_CBC),
        ]
        
        for mode_name, mode in aes_modes:
            try:
                if mode == AES.MODE_ECB:
                    cipher = AES.new(key_bytes, mode)
                    decrypted = cipher.decrypt(ciphertext_bytes)
                
                elif mode == AES.MODE_CBC:
                    # 使用key的前16字节作为IV
                    iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
                    cipher = AES.new(key_bytes, mode, iv)
                    decrypted = cipher.decrypt(ciphertext_bytes)
                
                print(f"   ✅ {mode_name}解密: {len(decrypted)} 字节")
                
                # 尝试移除填充
                try:
                    unpadded = unpad(decrypted, 16)  # PKCS7
                    print(f"   ✅ {mode_name} unpad: {len(unpadded)} 字节")
                    decrypted = unpadded
                except:
                    # 可能是无填充
                    pass
                
                # 尝试文本解码
                try:
                    text_result = decrypted.decode('utf-8', errors='ignore')
                    
                    # 检查是否为有意义文本
                    if len(text_result) > 50 and any(c.isalpha() for c in text_result):
                        print(f"   🎯🎯🎯 {mode_name}发现可读文本!")
                        print(f"   文本长度: {len(text_result)} 字符")
                        print(f"   前200字符: {text_result[:200]}")
                        
                        # 检查关键特征
                        if is_likely_media_info(text_result):
                            print(f"   🎉 {mode_name}可能是media信息!")
                        
                        return text_result
                    
                    else:
                        print(f"   ❌ {mode_name}文本太短或无意义")
                
                except Exception as e:
                    print(f"   ❌ {mode_name}文本解码失败: {e}")
                    
                    # 保存二进制结果
                    filename = f"aes_{mode_name.lower()}_binary_{pair_key[:10]}.bin"
                    with open(filename, 'wb') as f:
                        f.write(decrypted)
                    print(f"   💾 {mode_name}二进制保存到 {filename}")
            
            except Exception as e:
                print(f"   ❌ {mode_name}解密失败: {e}")
    
    except Exception as e:
        print(f"   ❌ 整体解密失败: {e}")
    
    return None

def is_likely_media_info(text):
    """检查文本是否可能是media信息"""
    
    text_lower = text.lower()
    
    # 检查media关键词
    media_keywords = ['original', 'media_info', 'main_url', 'doubao', 'video', 'unwatermark', 'watermark', 'url']
    found_keywords = [kw for kw in media_keywords if kw in text_lower]
    
    if found_keywords:
        return True
    
    # 检查URL模式
    if 'http' in text_lower:
        return True
    
    # 检查JSON结构
    if ('{' in text and '}' in text) or ('"' in text and ':' in text):
        return True
    
    return False

if __name__ == "__main__":
    final_aes_crack()