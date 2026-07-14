#!/usr/bin/env python3

import re
import base64
import time
from Crypto.Cipher import AES

def main():
    print("🔥🔥🔥 执行最终AES暴力破解 🔥🔥🔥")
    
    # 读取KEY_CIPHERTEXT_PAIRS.txt
    with open('KEY_CIPHERTEXT_PAIRS.txt', 'r') as f:
        content = f.read()
    
    # 提取所有 Ciphertext 行
    ctext_list = re.findall(r'Ciphertext: ([^\n]+)', content)
    print(f"🎯 找到 {len(ctext_list)} 个密文")
    
    keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    success_count = 0
    total_tested__count = 0
    
    print(f"🚀🚀🚀 开始暴力破解 🚀🚀🚀")
    print(f"最多测试 {len(ctext_list)} 个长密文，3个key，ECB+CBC，120秒内全力")
    
    start_time = time.time()
    
    for idx, value in enumerate(ctext_list):
        print(f"\n🎯 测试密文[{idx+1}]: {value[:80]}...")
        print(f"   长度: {len(value)} 字符")
        
        if len(value) <= 1:
            print(f"   ❌ 跳过 (太短)")
            continue
        
        total_tested__count += 1
        
        # 解码: 超集base64（多种字符替换尝试）
        decode_bytes = None
        
        alt_values = [
            value,  # 原始
            re.sub(r'[^A-Za-z0-9+/=]', '+', value),  # 特殊字符变+
            re.sub(r'[^A-Za-z0-9]', '', value),  # 只留字母数字
            value.replace(' ', '+'),  # 空格变+
        ]
        
        for alt_idx, alt_value in enumerate(alt_values):
            if not alt_value:
                continue
            
            # 补齐到4的倍数
            padding = 4 - (len(alt_value) % 4) % 4
            padded_value = alt_value + ('=' * padding)
            
            # 检查base64
            if len(padded_value) % 4 == 0:
                try:
                    decoded = base64.b64decode(padded_value, validate=True)
                    print(f"   ✅ base64变体{alt_idx+1}成功: {len(decoded)} 字节")
                    decode_bytes = decoded
                    break
                except Exception as e:
                    print(f"   ❌ base64变体{alt_idx+1}失败: {e}")
                    continue
        
        if not decode_bytes:
            continue
        
        # 检查block
        if len(decode_bytes) % 16 != 0:
            print(f"   ❌ 不是16倍数")
            continue
        
        print(f"   🎯 符合AES块: {decode_bytes[:16].hex()}")
        
        # 尝试3个key
        for key_idx, key in enumerate(keys):
            try:
                key_bytes = key.encode('utf-8')
                
                mode1 = 'ECB'
                try:
                    cipher = AES.new(key_bytes, AES.MODE_ECB)
                    decrypted_bytes = cipher.decrypt(decode_bytes)
                    
                    print(f"   ✅ AES-{mode1}[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                    
                    # 尝试解码文本
                    try:
                        text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                        if len(text_result.strip()) > 30 and any(c.isalpha() for c in text_result):
                            print(f"   🎯 {mode1}文本: {text_result[:120]}...")
                            
                            success_count += 1
                            
                            # 保存
                            success_filename = f"AES_{mode1}_k{key_idx+1}_idx{idx+1}.txt"
                            with open(success_filename, 'w', encoding='utf-8') as f:
                                f.write(f"AES密钥: {key}\n\n")
                                f.write(text_result)
                            
                            print(f"   💾 {mode1}保存 {success_filename}")
                            
                            # 检查media
                            text_lower = text_result.lower()
                            if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                print(f"   🎉🎉🎉 {mode1} MEDIA发现！")
                                
                                with open(f"MEDIA_{mode1}_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                    f.write(f"🎯 {mode1} MEDIA\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   🎯🎯🎯 {mode1} MEDIA保存")
                    except Exception as e:
                        print(f"   ❌ {mode1}文本解码失败: {e}")
                        # 保存二进制
                        with open(f"aes_{mode1.lower()}_k{key_idx+1}_{idx+1}.bin", 'wb') as f:
                            f.write(decrypted_bytes)
                        print(f"   💾 {mode1}二进制保存")
                except Exception as e:
                    print(f"   ❌ AES-{mode1}[{key_idx+1}]失败: {e}")
                    
                mode2 = 'CBC'
                try:
                    iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
                    cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
                    decrypted_bytes = cipher.decrypt(decode_bytes)
                    
                    print(f"   ✅ AES-{mode2}[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                    
                    # 尝试解码
                    try:
                        text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                        if len(text_result.strip()) > 30 and any(c.isalpha() for c in text_result):
                            print(f"   🎯 {mode2}文本: {text_result[:120]}...")
                            
                            success_count += 1
                            
                            # 保存
                            success_filename = f"AES_{mode2}_k{key_idx+1}_idx{idx+1}.txt"
                            with open(success_filename, 'w', encoding='utf-8') as f:
                                f.write(f"AES密钥: {key}\n\n")
                                f.write(text_result)
                            
                            print(f"   💾 {mode2}保存 {success_filename}")
                            
                            # 检查media
                            text_lower = text_result.lower()
                            if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                print(f"   🎉🎉🎉 {mode2} MEDIA发现！")
                                
                                with open(f"MEDIA_{mode2}_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                    f.write(f"🎯 {mode2} MEDIA\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   🎯🎯🎯 {mode2} MEDIA保存")
                    except Exception as e:
                        print(f"   ❌ {mode2}文本解码失败: {e}")
                        # 保存二进制
                        with open(f"aes_{mode2.lower()}_k{key_idx+1}_{idx+1}.bin", 'wb') as f:
                            f.write(decrypted_bytes)
                        print(f"   💾 {mode2}二进制保存")
                except Exception as e:
                    print(f"   ❌ AES-{mode2}[{key_idx+1}]失败: {e}")
            
            except Exception as e:
                print(f"   ❌ AES总体[{key_idx+1}]失败: {e}")
        
        # 检查时间
        elapsed = time.time() - start_time
        if elapsed > 110:  # 110秒
            print(f"\n⏰ 时间到，停止")
            break
    
    print(f"\n📊 完成: {total_tested__count} 个密文，{success_count} 次成功解密")

if __name__ == "__main__":
    main()