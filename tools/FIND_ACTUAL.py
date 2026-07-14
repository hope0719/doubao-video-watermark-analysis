#!/usr/bin/env python3
import re
import base64

def main():
    print("🎯🎯🎯 查找全部 base64 长候选 🎯🎯🎯")
    
    # 读取KEY_CIPHERTEXT_PAIRS.txt
    with open('KEY_CIPHERTEXT_PAIRS.txt', 'r') as f:
        content = f.read()
    
    # 提取所有 Ciphertext
    ctext_list = re.findall(r'Ciphertext: ([^\n]+)', content)
    
    all_long_possible_hex = []
    
    for idx, value in enumerate(ctext_list):
        print(f"\n--- 候选[{idx+1}] ---")
        print(f"   原始: {value}")
        print(f"   长度: {len(value)}")
        
        # 仅字母数字
        clean = re.sub(r'[^A-Za-z0-9]', '', value)
        print(f"   仅字母数字: {clean[:100]}")
        
        # 补齐到4的倍数
        padding = 4 - (len(clean) % 4) % 4
        padded = clean + ('=' * padding)
        
        print(f"   补齐后: {padded[:100]}")
        print(f"   补齐后长度: {len(padded)}")
        
        # 尝试base64
        try:
            decoded = base64.b64decode(padded, validate=True)
            print(f"   ✅ base64成功: {len(decoded)} 字节")
            print(f"   hex: {decoded.hex()}")
            
            if len(decoded) > 0:
                all_long_possible_hex.append((idx, clean, decoded))
        except Exception as e:
            print(f"   ❌ base64失败: {e}")
    
    print(f"\n🎯 找到 {len(all_long_possible_hex)} 个可base64解码的长值")
    
    # 保存所有
    with open('long_decode_hex.txt', 'w') as f:
        for idx, orig, decoded in all_long_possible_hex:
            f.write(f"--- idx[{idx}] ---\n")
            f.write(f"原始字母数字: {orig[:100]}\n")
            f.write(f"长度: {len(orig)}\n")
            f.write(f"base64解码hex: {decoded.hex()}\n")
            f.write(f"base64解码字节数: {len(decoded)}\n")
            f.write(f"是否符合AES块: {len(decoded) % 16 == 0}\n")
            f.write(f"\n")
    
    print(f"💾 保存 long_decode_hex.txt")
    
    # 检查每个hex是否有其他模式
    print(f"\n🔍 检查hex模式")
    
    for idx, orig, decoded in all_long_possible_hex:
        hex_str = decoded.hex()
        print(f"\n--- [{idx}] ---")
        print(f"   hex长度: {len(hex_str)}")
        
        if len(hex_str) % 2 == 0:
            print(f"   ✅ 偶数字符，可转bytes")
        else:
            print(f"   ❌ 奇数字符")
        
        # 查找长字母数字连续
        alnum_seqs = re.findall(r'[0-9a-f]{10,}', hex_str)
        for seq in alnum_seqs:
            print(f"   长序列: {seq}")
        
        # 查找重复
        all_sub = {hex_str[i:i+5] for i in range(0, len(hex_str)-4)}
        counts = {}
        for sub in all_sub:
            count = hex_str.count(sub)
            if count > 1:
                counts[sub] = count
        
        if counts:
            print(f"   重复模式:")
            for k, v in sorted(counts.items(), key=lambda x: -x[1])[:10]:
                print(f"     {k} x{v}")
        
        # 检查是否存在base64编码的可能（hex内出现字母数字）
        # 将hex转为bytes再base64
        try:
            if len(hex_str) % 2 == 0:
                bin_data = bytes.fromhex(hex_str)
                b64_data = base64.b64encode(bin_data).decode('utf-8')
                print(f"   二次base64: {b64_data[:100]}")
        except Exception as e:
            print(f"   ❌ 二次base64失败: {e}")

if __name__ == "__main__":
    main()