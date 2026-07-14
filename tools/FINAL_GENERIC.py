#!/usr/bin/env python3
import re
import base64
from Crypto.Cipher import AES

def hex_to_bytes(h):
    """hex字符串转bytes"""
    return bytes.fromhex(h) if len(h) % 2 == 0 else b''

def bytes_to_hex(b):
    return b.hex()

def is_base64(s):
    """检查base64"""
    try:
        if len(s) % 4 != 0:
            return False
        if not re.match(r'^[A-Za-z0-9+/=]*$', s):
            return False
        decoded = base64.b64decode(s, validate=True)
        return len(decoded) > 0
    except:
        return False

def try_base64_decode(s):
    """尝试base64"""
    try:
        decoded = base64.b64decode(s, validate=True)
        return decoded
    except:
        return None

def try_base32_decode(s):
    """尝试base32"""
    import base64
    try:
        # 补齐
        s = s.upper()
        padding = 8 - (len(s) % 8) % 8
        padded = s + ('=' * padding)
        decoded = base64.b32decode(padded, casefold=True, map01=None)
        return decoded
    except:
        return None

def try_base58_decode(s):
    """尝试base58"""
    try:
        import base58
        decoded = base58.b58decode(s)
        return decoded
    except ImportError:
        print(f"   💡 base58需要pip install base58")
        return None
    except Exception as e:
        # print(f"   ❌ base58失败: {e}")
        return None

def try_utf8_decode(b):
    """尝试utf8"""
    try:
        text = b.decode('utf-8', errors='ignore')
        if len(text.strip()) > 10 and any(c.isalpha() for c in text):
            return text
    except:
        pass
    return None

def pad_to_block(b, block=16):
    """pad到16倍数"""
    pad_len = block - (len(b) % block)
    return b + bytes([pad_len] * pad_len)

def try_aes_ec_cbc(key_bytes, block_bytes):
    """尝试AES ECB和CBC"""
    results = []
    try:
        cipher = AES.new(key_bytes, AES.MODE_ECB)
        decrypted = cipher.decrypt(block_bytes)
        results.append(('ECB', decrypted))
    except:
        pass
    
    try:
        iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
        cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(block_bytes)
        results.append(('CBC', decrypted))
    except:
        pass
    
    return results

def try_all_aes(std_keys, block_bytes):
    """尝试所有AES"""
    for key_idx, key in enumerate(std_keys):
        key_bytes = key.encode('utf-8')
        
        modes_vals = try_aes_ec_cbc(key_bytes, block_bytes)
        
        for mode, dec_val in modes_vals:
            try:
                text_val = dec_val.decode('utf-8', errors='ignore')
                if len(text_val.strip()) > 30:
                    print(f"  🎯 {mode} KEY[{key_idx+1}]: {text_val[:120]}...")
                    
                    with open(f'AES_{mode}_k{key_idx+1}_gen.txt', 'w', encoding='utf-8') as f:
                        f.write(f"密钥: {key}\n\n{text_val}")
                    print(f"  💾 {mode} KEY[{key_idx+1}]保存")
                    
                    lower_text = text_val.lower()
                    if any(kw in lower_text for kw in ['original', 'media_info', 'url', 'video']):
                        print(f"  🎯🎯🎯 {mode} KEY[{key_idx+1}] MEDIA")
                        with open(f'MEDIA_{mode}_k{key_idx+1}.txt', 'w', encoding='utf-8') as f:
                            f.write(f"🎯 {mode}\n密钥: {key}\n\n{text_val}")
            except:
                # 保存二进制
                bin_file = f"aes_{mode}_k{key_idx+1}_gen.bin"
                with open(bin_file, 'wb') as f:
                    f.write(dec_val)
                print(f"  💾 {mode} KEY[{key_idx+1}]二进账保存 {bin_file}")

def main():
    print("🔥🔥🔥 通用多base decoder + AES暴力 🔥🔥🔥")
    
    # 3个hex
    hexes = [
        '24794caf84ad9f49b54cd2609d691483652b268a9310e2a33a',
        '0bbc3b87bb6714eab862e5dba0562595b705096e6a54cf22c63c6319',
        '14e1e33e0398e3b92ff459acb15c0aa7d1f4622004b3'
    ]
    
    # 3个key
    keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    print(f"🎯 测试 {len(hexes)} 个hex")
    
    all_intermediates = []
    
    for idx, h in enumerate(hexes):
        print(f"\n--- 测试hex[{idx+1}] ---")
        print(f"  原始: {h}")
        print(f"  长度: {len(h)}")
        
        if len(h) % 2 != 0:
            print(f"  ❌ 奇数")
            continue
        
        # 转bytes
        bin_bytes = hex_to_bytes(h)
        print(f"  ✅ 字节数: {len(bin_bytes)}")
        all_intermediates.append(('hex', idx, bin_bytes))
        
        # 先尝试转回base64（因我们曾从字母数字反推过base64）
        try:
            b64 = base64.b64encode(bin_bytes).decode('utf-8')
            print(f"  🎯 再base64: {b64}")
            
            # 再base64解码
            decoded_again = try_base64_decode(b64)
            if decoded_again:
                print(f"  ✅ 再base64解码: {len(decoded_again)}")
                all_intermediates.append(('b64_again', idx, decoded_again))
        except Exception as e:
            print(f"  ❌ 再base64失败: {e}")
        
        # base32
        b32_decoded = try_base32_decode(h)
        if b32_decoded:
            print(f"  ✅ base32: {len(b32_decoded)}")
            all_intermediates.append(('b32', idx, b32_decoded))
        else:
            print(f"  ❌ base32失败")
        
        # base58
        b58_decoded = try_base58_decode(h)
        if b58_decoded:
            print(f"  ✅ base58: {len(b58_decoded)}")
            all_intermediates.append(('b58', idx, b58_decoded))
        else:
            print(f"\  base58失败")
        
        # 尝试各种xor（1~255）
        print(f"  🔍 XOR暴力")
        
        for xor_val in range(1, 256):
            try:
                xor_bytes = bytes([b ^ xor_val for b in bin_bytes])
                
                # 查看可打印比例
                printable_count = sum(1 for byte_val in xor_bytes if 32 <= byte_val <= 126)
                
                if printable_count > len(xor_bytes) * 0.6:
                    print(f"  🎯 xor {xor_val}: 可打印比例高")
                    
                    text_result = try_utf8_decode(xor_bytes)
                    if text_result:
                        print(f"  🎉 xor {xor_val} UTF8: {text_result[:100]}")
                        
                        with open(f'XOR_{xor_val}_hex{idx+1}.txt', 'w', encoding='utf-8') as f:
                            f.write(text_result)
                        print(f"  💾 保存 XOR_{xor_val}_hex{idx+1}.txt")
                    
                    all_intermediates.append((f'xor{xor_val}', idx, xor_bytes))
            except Exception as e:
                pass
    
    print(f"\n🎯 共 {len(all_intermediates)} 个中间值，尝试AES")
    
    # 对每个中间值，pad和aes
    for itype, idx, val in all_intermediates:
        print(f"\n🔍 尝试 {itype} hex{idx+1} ({len(val)} 字节)")
        
        if len(val) % 16 == 0:
            print(f"  ✅ {itype} 符合AES块")
            try_all_aes(keys, val)
        else:
            padded_val = pad_to_block(val, 16)
            print(f"  ✅ {itype} pad到 {len(padded_val)} 字节")
            try_all_aes(keys, padded_val)

if __name__ == "__main__":
    main()