#!/usr/bin/env python3

import base64
import re

def is_printable_ascii(s):
    """检查字符串是否大部分可打印ASCII"""
    printable_chars = sum(1 for c in s if 32 <= ord(c) <= 126 or c in '\r\n\t')
    ratio = printable_chars / len(s) if len(s) > 0 else 0
    return ratio > 0.7

def main():
    print("🔥🔥🔥 直接base64解码长字符串求JSON 🔥🔥🔥")
    
    # 读取 KEY_CIPHERTEXT_PAIRS.txt
    with open('KEY_CIPHERTEXT_PAIRS.txt', 'r') as f:
        content = f.read()
    
    # 提取所有 Ciphertext
    ctext_list = re.findall(r'Ciphertext: ([^\n]+)', content)
    print(f"🎯 共 {len(ctext_list)} 个密文")
    
    # 对每个密文，尝试只取字母数字再 base64
    for idx, value in enumerate(ctext_list):
        print(f"\n--- 测试[{idx+1}] ---")
        print(f"  原始值: {value}")
        print(f"  长度: {len(value)}")
        
        # 仅字母数字
        clean = re.sub(r'[^A-Za-z0-9]', '', value)
        print(f"  字母数字: {clean}")
        print(f"  长度: {len(clean)}")
        
        if len(clean) < 10:
            print(f"  ❌ 太短")
            continue
        
        # 补齐到4的倍数
        padding = 4 - (len(clean) % 4) % 4
        padded = clean + ('=' * padding)
        print(f"  补齐后: {padded}")
        
        try:
            decoded = base64.b64decode(padded, validate=True)
            print(f"  ✅ base64成功: {len(decoded)} 字节")
            print(f"  hex: {decoded.hex()}")
            
            # 尝试当作json
            try:
                json_text = decoded.decode('utf-8', errors='ignore')
                print(f"  json预览: {json_text}")
                
                # 检查是否包含原始media相关
                json_lower = json_text.lower()
                if any(kw in json_lower for kw in ['original', 'media_info', 'url', 'video']):
                    print(f"  🎯🎯🎯 MEDIA!")
                    
                    # 保存
                    with open(f'RAW_JSON_{idx+1}_MEDIA.txt', 'w', encoding='utf-8') as f:
                        f.write(json_text)
                    print(f"  💾 MEDIA保存")
                
                # 检查是否像json（有 {}、"..."）
                if ('{' in json_text and '}' in json_text) and ('"' in json_text and ':' in json_text):
                    print(f"  🎯 类似JSON")
                    
                    with open(f'LIKE_JSON_{idx+1}.txt', 'w', encoding='utf-8') as f:
                        f.write(json_text)
                    print(f"  💾 JSON保存")
                
                # 检查是否 printable比率 高
                if is_printable_ascii(json_text):
                    print(f"  ✅ 可打印ASCII比例高")
                    
                    # 保存
                    with open(f'PRINTABLE_{idx+1}.txt', 'w', encoding='utf-8') as f:
                        f.write(json_text)
                    print(f"  💾 可打印保存")
            except Exception as e:
                print(f"  ❌ json解码失败: {e}")
                
                # 保存二进制
                with open(f'decoded_{idx+1}.bin', 'wb') as f:
                    f.write(decoded)
                print(f"  💾 二进制保存")
        except Exception as e:
            print(f"  ❌ base64失败: {e}")
    
    print(f"\n🎯 完成")

if __name__ == "__main__":
    main()