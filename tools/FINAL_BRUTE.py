#!/usr/bin/env python3

import re
import base64
import zlib
import gzip

from Crypto.Cipher import AES

def hex_to_bytes(h):
    """hex字符串转bytes"""
    return bytes.fromhex(h)

def bytes_to_hex(b):
    return b.hex()

def save_or_print(data, filename, description):
    """保存数据或打印"""
    print(f"💾 {description} {filename}")
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(data)

def check_gzip_magic(d):
    """检查gzip magic: 1f8b"""
    return len(d) >= 2 and d[:2] == b'\x1f\x8b'

def check_zlib_magic(d):
    """检查zlib magic: 789c 或 78da"""
    return len(d) >= 2 and d[:2] in [b'\x78\x9c', b'\x78\xda']

def try_gzip_zlib(b):
    """尝试gzip或zlib解压缩"""
    try:
        if check_gzip_magic(b):
            try:
                decompressed = gzip.decompress(b)
                print(f"  ✅ gzip解压缩成功: {len(decompressed)} 字节")
                return decompressed
            except Exception as e:
                print(f"  ❌ gzip处理失败: {e}")
        
        if check_zlib_magic(b):
            try:
                decompressed = zlib.decompress(b)
                print(f"  ✅ zlib解压缩成功: {len(decompressed)} 字节")
                return decompressed
            except Exception as e:
                print(f"  ❌ zlib处理失败: {e}")
    except Exception as e:
        print(f"  ❌ 解压缩总体失败: {e}")
        pass
    return None

def pad_to_block(b, block=16):
    """pad到block的倍数"""
    pad_len = block - (len(b) % block)
    return b + bytes([pad_len] * pad_len)

def unpad_block(b):
    """移除padding"""
    if len(b) == 0:
        return b
    pad_len = b[-1]
    if pad_len < 1 or pad_len > 16 or pad_len > len(b):
        return b
    return b[:-pad_len]

def try_aes_ec_cbc(key_bytes, block_bytes):
    """尝试AES ECB和CBC解密"""
    
    results = []
    
    # ECB
    try:
        cipher = AES.new(key_bytes, AES.MODE_ECB)
        decrypted = cipher.decrypt(block_bytes)
        results.append(('ECB', decrypted))
    except Exception as e:
        # print(f"  ❌ ECB失败: {e}")
        pass
    
    # CBC
    try:
        iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
        cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(block_bytes)
        results.append(('CBC', decrypted))
    except Exception as e:
        # print(f"  ❌ CBC失败: {e}")
        pass
    
    return results

def try_aes_all_keys(key_list, block_bytes):
    """尝试所有key"""
    
    for key_idx, key in enumerate(key_list):
        key_bytes = key.encode('utf-8')
        
        modes_vals = try_aes_ec_cbc(key_bytes, block_bytes)
        
        for mode, dec_val in modes_vals:
            try:
                text_val = dec_val.decode('utf-8', errors='ignore')
                if len(text_val.strip()) > 30 and any(c.isalpha() for c in text_val):
                    print(f"  🎉 {mode} KEY[{key_idx+1}]发现文本: {text_val[:120]}...")
                    
                    # 保存
                    save_or_print(
                        f"密钥: {key}\n\n{text_val}",
                        f"AES_{mode}_k{key_idx+1}_text.txt",
                        f"{mode} KEY[{key_idx+1}]"
                    )
                    
                    # 检查media
                    text_lower = text_val.lower()
                    if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                        print(f"  🎯🎯🎯 {mode} MEDIA")
                        
                        save_or_print(
                            f"🎯 {mode} MEDIA\n密钥: {key}\n\n{text_val}",
                            f"MEDIA_{mode}_k{key_idx+1}.txt",
                            f"{mode} MEDIA"
                        )
            except Exception as e:
                # print(f"  ❌ {mode} KEY[{key_idx+1}]文本解码失败: {e}")
                
                # 保存二进制
                with open(f"AES_{mode}_k{key_idx+1}_bin.bin", 'wb') as f:
                    f.write(dec_val)
                print(f"  💾 {mode} KEY[{key_idx+1}]二进制保存")

def main():
    print("🔥🔥🔥 执行3个长hex的多层暴力 🔥🔥🔥")
    
    # 3个key
    aes_keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    # 3个hex
    hexes_to_try = [
        '24794caf84ad9f49b54cd2609d691483652b268a9310e2a33a',
        '0bbc3b87bb6714eab862e5dba0562595b705096e6a54cf22c63c6319',
        '14e1e33e0398e3b92ff459acb15c0aa7d1f4622004b3'
    ]
    
    print(f"🎯 测试 {len(hexes_to_try)} 个hex，3个key")
    
    for idx, h in enumerate(hexes_to_try):
        print(f"\n--- 测试hex[{idx+1}] ---")
        print(f"  原始hex: {h}")
        print(f"  长度: {len(h)}")
        
        if len(h) % 2 != 0:
            print(f"  ❌ 奇数，跳过")
            continue
        
        # 转bytes
        bin_bytes = hex_to_bytes(h)
        print(f"  ✅ bytes长度: {len(bin_bytes)}")
        
        # 尝试gzip/zlib
        decompressed = try_gzip_zlib(bin_bytes)
        
        if decompressed:
            print(f"  🎯 解压缩结果: {len(decompressed)} 字节")
            print(f"  hex: {bytes_to_hex(decompressed)}")
            
            # 检查是否是json或文本
            try:
                txt = decompressed.decode('utf-8', errors='ignore')
                if len(txt.strip()) > 50:
                    print(f"  🎯 文本: {txt[:200]}...")
                    
                    # 保存
                    save_or_print(txt, f"解压文本_{idx+1}.txt", f"hex[{idx+1}]解压文本")
                    
                    # 检查media
                    txt_lower = txt.lower()
                    if any(kw in txt_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                        print(f"  🎯🎯🎯 MEDIA发现")
                        save_or_print(txt, f"MEDIA_解压_{idx+1}.txt", f"hex[{idx+1}]MEDIA")
            except Exception as e:
                print(f"  ❌ 文本解码失败: {e}")
            
            # 检查是否是aes块
            if len(decompressed) % 16 == 0:
                print(f"  ✅ 符合AES块")
                try_aes_all_keys(aes_keys, decompressed)
            else:
                print(f"  ❌ 不符合AES块")
                
                # pad到16倍数
                padded = pad_to_block(decompressed, 16)
                print(f"  ✅ pad到 {len(padded)} 字节")
                try_aes_all_keys(aes_keys, padded)
        
        else:
            print(f"  ❌ gzip/zlib失败")
            
            # 直接尝试AES
            if len(bin_bytes) % 16 == 0:
                print(f"  ✅ 符合AES块")
                try_aes_all_keys(aes_keys, bin_bytes)
            else:
                print(f"  ❌ 不符合AES块")
                
                # pad到16倍数
                padded = pad_to_block(bin_bytes, 16)
                print(f"  ✅ pad到 {len(padded)} 字节")
                try_aes_all_keys(aes_keys, padded)
            
            # 尝试各种xor
            print(f"  🔍 尝试xor")
            
            for xor_val in range(1, 256):
                try:
                    xor_bytes = bytes([b ^ xor_val for b in bin_bytes])
                    
                    if len(xor_bytes) % 16 == 0:
                        print(f"  ✅ xor {xor_val} 符合AES块")
                        try_aes_all_keys(aes_keys, xor_bytes)
                    else:
                        padded_xor = pad_to_block(xor_bytes, 16)
                        try_aes_all_keys(aes_keys, padded_xor)
                except Exception as e:
                    # print(f"  ❌ xor {xor_val} 失败: {e}")
                    pass
            
            # 尝试zlib再次（无magic）
            try:
                try_decomp = zlib.decompress(bin_bytes)
                print(f"  ✅ zlib裸解压缩: {len(try_decomp)} 字节")
                
                if len(try_decomp) % 16 == 0:
                    try_aes_all_keys(aes_keys, try_decomp)
                else:
                    padded_zlib = pad_to_block(try_decomp, 16)
                    try_aes_all_keys(aes_keys, padded_zlib)
            except Exception as e:
                # print(f"  ❌ zlib裸失败: {e}")
                pass

if __name__ == "__main__":
    main()