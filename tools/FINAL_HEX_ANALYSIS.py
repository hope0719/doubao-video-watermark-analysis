#!/usr/bin/env python3

def main():
    print("🔥🔥🔥 直接分析3个Hex（字符频率统计）🔥🔥🔥")
    
    hexes = [
        '24794caf84ad9f49b54cd2609d691483652b268a9310e2a33a',
        '0bbc3b87bb6714eab862e5dba0562595b705096e6a54cf22c63c6319',
        '14e1e33e0398e3b92ff459acb15c0aa7d1f4622004b3'
    ]
    
    print(f"🎯 3个hex值")
    
    for idx, h in enumerate(hexes):
        print(f"\n--- Hex[{idx+1}] ---")
        print(f"   值: {h}")
        print(f"   长度: {len(h)}")
        
        # 检查是否为字母数字bytes
        # 转换成bytes
        if len(h) % 2 != 0:
            print(f"   ❌ 奇数")
            continue
        
        b = bytes.fromhex(h)
        print(f"   bytes长度: {len(b)}")
        
        # 频率分析
        freq = {}
        for byte_val in b:
            if byte_val not in freq:
                freq[byte_val] = 0
            freq[byte_val] += 1
        
        # 排序
        sorted_freq = sorted(freq.items(), key=lambda x: -x[1])
        print(f"   Top 10 bytes:")
        for i, (byte_val, count) in enumerate(sorted_freq[:10]):
            print(f"     {i+1}: 0x{byte_val:02x} ({byte_val}) x{count}")
        
        # 检查可打印ASCII
        printable = []
        for byte_val in b:
            if 32 <= byte_val <= 126:
                printable.append(chr(byte_val))
        
        if printable:
            print(f"   可打印ASCII: {''.join(printable)}")
            
            # 保存可打印
            if len(printable) > 10:
                with open(f'hex{idx+1}_printable.txt', 'w', encoding='utf-8') as f:
                    f.write(''.join(printable))
                print(f"   💾 可打印保存 hex{idx+1}_printable.txt")
        
        else:
            print(f"   无可见ASCII")
        
        # 检查是否有模式（按字节对分析）
        words = []
        for i in range(0, len(b), 4):
            chunk = b[i:i+4]
            if len(chunk) == 4:
                words.append(chunk.hex())
        
        if words:
            print(f"   4字节word: {words}")
            
            # 统计word频率
            word_freq = {}
            for w in words:
                if w not in word_freq:
                    word_freq[w] = 1
                else:
                    word_freq[w] += 1
            
            if len(word_freq) < len(words):
                print(f"   重复word:")
                for k, v in sorted(word_freq.items(), key=lambda x: -x[1]):
                    print(f"     {k} x{v}")

if __name__ == "__main__":
    main()