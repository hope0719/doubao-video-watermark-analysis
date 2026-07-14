#!/usr/bin/env python3
import re
import base64

def main():
    print("🔥🔥🔥 多层cms分析 🔥🔥🔥")
    
    # 3个hex（已base64解码）
    hexes = [
        '24794caf84ad9f49b54cd2609d691483652b268a9310e2a33a',
        '0bbc3b87bb6714eab862e5dba0562595b705096e6a54cf22c63c6319',
        '14e1e33e0398e3b92ff459acb15c0aa7d1f4622004b3'
    ]
    
    # 对应的原始字母数字
    alnums = [
        'JHlMr4Stn0m1TNJgnWkUg2UrJoqTEOKjOj',
        'C7w7h7tnFOq4YuXboFYllbcFCW5qVM8ixjxjGb',
        'FOHjPgOY47kv9FmssVwKp9H0YiAEsw'
    ]
    
    # 读取 KEY_CIPHERTEXT_PAIRS.txt
    with open('KEY_CIPHERTEXT_PAIRS.txt', 'r') as f:
        content = f.read()
    
    # 提取 Key: <key>\nCiphertext: <value>
    lines = content.split('\n')
    kv_pairs = []
    current_key = None
    for line in lines:
        if line.startswith('Key:'):
            current_key = line[4:].strip()
        elif line.startswith('Ciphertext:'):
            current_value = line[11:].strip()
            if current_key and current_value:
                kv_pairs.append((current_key, current_value))
                current_key = None
    
    print(f"🎯 {len(kv_pairs)} 个key-value对")
    
    # 检查key和密文之间关系
    print(f"\n🔍 检查Key与密文关系")
    
    for idx, (key, value) in enumerate(kv_pairs):
        print(f"\n--- 配对[{idx+1}] ---")
        print(f"   Key: {key} (长{len(key)})")
        print(f"   密文: {value[:50]}")
        print(f"   密文长: {len(value)}")
        
        # 密文是否可净化字母数字base64
        clean_value = re.sub(r'[^A-Za-z0-9]', '', value)
        print(f"   密文字母数字: {clean_value[:50]}")
        print(f"   长度: {len(clean_value)}")
        
        # 补齐
        padding = 4 - (len(clean_value) % 4) % 4
        padded = clean_value + ('=' * padding)
        
        if len(padded) % 4 == 0:
            print(f"   补齐后: {len(padded)}")
            
            # base64
            try:
                decoded = base64.b64decode(padded, validate=True)
                print(f"   ✅ base64: {len(decoded)} 字节")
                print(f"   hex: {decoded.hex()}")
                
                # 检查与三个hex是否匹配
                decoded_uppercase_hex = decoded.hex().upper()
                for h in hexes:
                    if h in decoded_uppercase_hex:
                        print(f"   🎯🎯🎯 包含hex[!]")
                        with open(f'CROSS_{idx+1}_FOUND.txt', 'w') as f:
                            f.write(f"配对[{idx+1}]\n密钥: {key}\n密文: {value}\n\n")
                            f.write(f"字母数字: {clean_value}\n")
                            f.write(f"补齐后: {padded}\n")
                            f.write(f"base64解码hex: {decoded.hex()}\n")
                        print(f"   💾 交叉保存 CROSS_{idx+1}_FOUND.txt")
            except Exception as e:
                print(f"   ❌ base64失败: {e}")
    
    print(f"\n🔍 检查3个hex之间关系")
    
    for i in range(len(hexes)):
        for j in range(i+1, len(hexes)):
            diff = abs(len(hexes[i]) - len(hexes[j]))
            print(f"   hex[{i+1}] 与 hex[{j+1}] 长度差: {diff}")
    
    # 检查是否有xor关系
    print(f"\n🔍 尝试hex间xor（转换为bytes，补短到等长）")
    
    def hex_to_bytes(h):
        return bytes.fromhex(h) if len(h) % 2 == 0 else b''
    
    def xor_bytes(a, b):
        min_len = min(len(a), len(b))
        return bytes([a[i] ^ b[i] for i in range(min_len)])
    
    for i in range(len(hexes)):
        bytes_i = hex_to_bytes(hexes[i])
        if not bytes_i:
            continue
        
        for j in range(i+1, len(hexes)):
            bytes_j = hex_to_bytes(hexes[j])
            if not bytes_j:
                continue
            
            xor_result = xor_bytes(bytes_i, bytes_j)
            print(f"   hex[{i+1}] ^ hex[{j+1}]: {xor_result.hex()}")
            
            # 检查是否可文本
            try:
                text_result = xor_result.decode('utf-8', errors='ignore')
                if len(text_result.strip()) > 10:
                    print(f"   ✅ xor文本: {text_result}")
                    with open(f'XOR_{i+1}_{j+1}.txt', 'w', encoding='utf-8') as f:
                        f.write(text_result)
                    print(f"   💾 保存 XOR_{i+1}_{j+1}.txt")
            except Exception as e:
                pass
    
    # 检查三个hex组合
    print(f"\n🔍 三个hex组合")
    
    # 两两xor后再与第三个xor
    if len(hexes) >= 3:
        b1 = hex_to_bytes(hexes[0])
        b2 = hex_to_bytes(hexes[1])
        b3 = hex_to_bytes(hexes[2])
        
        if b1 and b2 and b3:
            # ((b1 ^ b2) ^ b3)
            xor12 = xor_bytes(b1, b2)
            xor123 = xor_bytes(xor12, b3)
            print(f"   (h1^h2)^h3: {xor123.hex()}")
            
            try:
                text_123 = xor123.decode('utf-8', errors='ignore')
                if len(text_123.strip()) > 10:
                    print(f"   ✅ 三重xor文本: {text_123}")
                    with open('TRIPLE_XOR.txt', 'w', encoding='utf-8') as f:
                        f.write(text_123)
                    print(f"   💾 三重xor保存")
            except Exception as e:
                pass

if __name__ == "__main__":
    main()