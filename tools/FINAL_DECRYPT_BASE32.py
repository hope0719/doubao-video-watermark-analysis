#!/usr/bin/env python3

from Crypto.Cipher import AES
import base64

def try_aes_all_modes(keys, block_bytes):
    print(f"  🎯 尝试AES，{len(block_bytes)} 字节")
    
    for key_idx, key in enumerate(keys):
        try:
            key_bytes = key.encode('utf-8')
            
            # ECB
            try:
                cipher = AES.new(key_bytes, AES.MODE_ECB)
                decrypted = cipher.decrypt(block_bytes)
                
                try:
                    text_val = decrypted.decode('utf-8', errors='ignore')
                    if len(text_val.strip()) > 30 and any(c.isalpha() for c in text_val):
                        print(f"  ✅ ECB KEY[{key_idx+1}]: {text_val[:120]}...")
                        with open(f'BASE32_AES_ECB_k{key_idx+1}.txt', 'w', encoding='utf-8') as f:
                            f.write(f"密钥: {key}\n\n{text_val}")
                        print(f"  💾 ECB保存")
                        
                        # 检查media
                        low = text_val.lower()
                        if any(kw in low for kw in ['original', 'media_info', 'url', 'video']):
                            print(f"  🎯🎯🎯 ECB MEDIA")
                            with open(f'BASE32_MEDIA_ECB_k{key_idx+1}.txt', 'w', encoding='utf-8') as f:
                                f.write(f"🎯 ECB MEDIA\n密钥: {key}\n\n{text_val}")
                except Exception as e:
                    # 保存二进制
                    with open(f'BASE32_AES_ECB_k{key_idx+1}_bin.bin', 'wb') as f:
                        f.write(decrypted)
                    print(f"  💾 ECB二进制保存")
            except Exception as e:
                print(f"  ❌ ECB KEY[{key_idx+1}]失败: {e}")
            
            # CBC
            try:
                iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
                cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
                decrypted = cipher.decrypt(block_bytes)
                
                try:
                    text_val = decrypted.decode('utf-8', errors='ignore')
                    if len(text_val.strip()) > 30 and any(c.isalpha() for c in text_val):
                        print(f"  ✅ CBC KEY[{key_idx+1}]: {text_val[:120]}...")
                        with open(f'BASE32_AES_CBC_k{key_idx+1}.txt', 'w', encoding='utf-8') as f:
                            f.write(f"密钥: {key}\n\n{text_val}")
                        print(f"  💾 CBC保存")
                        
                        # 检查media
                        low = text_val.lower()
                        if any(kw in low for kw in ['original', 'media_info', 'url', 'video']):
                            print(f"  🎯🎯🎯 CBC MEDIA")
                            with open(f'BASE32_MEDIA_CBC_k{key_idx+1}.txt', 'w', encoding='utf-8') as f:
                                f.write(f"🎯 CBC MEDIA\n密钥: {key}\n\n{text_val}")
                except Exception as e:
                    # 保存二进制
                    with open(f'BASE32_AES_CBC_k{key_idx+1}_bin.bin', 'wb') as f:
                        f.write(decrypted)
                    print(f"  💾 CBC二进制保存")
            except Exception as e:
                print(f"  ❌ CBC KEY[{key_idx+1}]失败: {e}")
        except Exception as e:
            print(f"  ❌ AES KEY[{key_idx+1}]失败: {e}")

def main():
    print("🔥🔥🔥 尝试AES解密 base32 23字节结果 🔥🔥🔥")
    
    # 3个key
    keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    # base32结果hex
    base32_hex = '17edf3fe6d2ba1cc52e17170b5844515bb0ab1174dd260'
    print(f"  base32 hex: {base32_hex}")
    print(f"  长度: {len(base32_hex)}")
    
    if len(base32_hex) % 2 != 0:
        print(f"  ❌ 奇数")
        return
    
    bin_bytes = bytes.fromhex(base32_hex)
    print(f"  ✅ 字节: {len(bin_bytes)}")
    
    # 不是16倍数，尝试pad
    if len(bin_bytes) % 16 != 0:
        print(f"  ❌ 不符合块 补")
        pad_len = 16 - (len(bin_bytes) % 16)
        block_bytes = bin_bytes + bytes([pad_len] * pad_len)
        print(f"  ✅ pad到: {len(block_bytes)}")
    else:
        block_bytes = bin_bytes
    
    try_aes_all_modes(keys, block_bytes)

if __name__ == "__main__":
    main()