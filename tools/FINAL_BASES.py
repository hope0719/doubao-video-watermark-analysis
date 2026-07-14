#!/usr/bin/env python3

import base64
import re

def try_all_bases():
    print("🔥🔥🔥 尝试所有base编码 (32,58,36,85) 🔥🔥🔥")
    
    # 3个字母数字seq
    seqs = [
        'JHlMr4Stn0m1TNJgnWkUg2UrJoqTEOKjOj',
        'C7w7h7tnFOq4YuXboFYllbcFCW5qVM8ixjxjGb',
        'FOHjPgOY47kv9FmssVwKp9H0YiAEsw'
    ]
    
    for idx, s in enumerate(seqs):
        print(f"\n--- 测试seq[{idx+1}] ---")
        print(f"  原始: {s}")
        
        # base32 1: 全大写，只留字母数字
        upper = s.upper()
        clean32 = re.sub(r'[^A-Z2-7]', '', upper)  # base32字母数字
        print(f"  base32字母数字: {clean32}")
        
        if len(clean32) >= 8:
            try:
                # 补到8倍数
                pad_len = 8 - (len(clean32) % 8) % 8
                padded32 = clean32 + ('=' * pad_len)
                decoded = base64.b32decode(padded32, casefold=True)
                print(f"  ✅ base32解码: {len(decoded)} 字节")
                print(f"  hex: {decoded.hex()}")
                
                # 尝试文本
                try:
                    txt = decoded.decode('utf-8', errors='ignore')
                    if len(txt.strip()) > 30:
                        print(f"  🎯 base32文本: {txt[:120]}...")
                        
                        with open(f'base32_{idx+1}_text.txt', 'w', encoding='utf-8') as f:
                            f.write(txt)
                        print(f"  💾 base32保存")
                        
                        # 检查media
                        low = txt.lower()
                        if any(kw in low for kw in ['original', 'media_info', 'url', 'video']):
                            print(f"  🎯🎯🎯 base32 MEDIA")
                            with open(f'MEDIA_base32_{idx+1}.txt', 'w', encoding='utf-8') as f:
                                f.write(txt)
                except Exception as e:
                    print(f"  ❌ base32文本失败: {e}")
            except Exception as e:
                print(f"  ❌ base32解码失败: {e}")
        
        else:
            print(f"  ❌ base32太短")
        
        # base58: 需要base58模块
        print(f"  💡 跳过base58 (需pip install base58)")
        
        # base36: 无直接decode，但可尝试判断是否纯字母数字并当作base36
        # 但由于数量小不现实，我这只尝试一小部分: 比如全部数字会包含字母，几乎不可能。
        if re.match(r'^[0-9A-Z]+$', upper):
            print(f"  💡 可能base36，但大整数")
            # 不尝试 
        
        # base85: 字符集为0-9A-Za-z!#$%&()*+-;<=>?@^_`{|}~
        # 尝试前部分
        clean85 = re.sub(r'[^0-9A-Za-z!#$%&()*+\-;<=>?@^_`{|}~]', '', s)
        print(f"  base85可能长度: {len(clean85)}")
        
        # base85解码需要固定长度倍数，但样本短，不现实。
    
    # 尝试base64后接json
    print(f"\n🎯 尝试每个seq直接base64 + json")
    
    for idx, s in enumerate(seqs):
        print(f"\n--- base64JSON seq[{idx}] ---")
        
        # 补
        pad_len = 4 - (len(s) % 4) % 4
        padded = s + ('=' * pad_len)
        
        if not re.match(r'^[A-Za-z0-9+/=]*$', padded):
            print(f"  ❌ base64非字母数字")
            continue
        
        try:
            decoded = base64.b64decode(padded, validate=True)
            print(f"  ✅ base64成功: {len(decoded)} 字节")
            print(f"  hex: {decoded.hex()}")
            
            # 尝试json
            try:
                text = decoded.decode('utf-8', errors='ignore')
                print(f"  文本: {text}")
                
                if len(text.strip()) > 30 and ('{' in text and '}' in text) and ('"' in text):
                    print(f"  🎯 类似JSON")
                    
                    with open(f'BASE64_JSON_{idx}.txt', 'w', encoding='utf-8') as f:
                        f.write(text)
                    print(f"  💾 JSON保存")
                    
                    # 检查media
                    low = text.lower()
                    if any(kw in low for kw in ['original', 'media_info', 'url', 'video']):
                        print(f"  🎯🎯🎯 JSON MEDIA")
                        with open(f'MEDIA_JSON_{idx}.txt', 'w', encoding='utf-8') as f:
                            f.write(text)
            except Exception as e:
                print(f"  ❌ JSON解码失败: {e}")
        except Exception as e:
            print(f"  ❌ base64失败: {e}")

if __name__ == "__main__":
    try_all_bases()