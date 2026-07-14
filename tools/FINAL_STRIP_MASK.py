#!/usr/bin/env python3

def main():
    print("🔥🔥🔥 移除ABCBD掩码 🔥🔥🔥")
    
    # 读取 FINAL_SUCCESS_RESULT.txt
    with open('FINAL_SUCCESS_RESULT.txt', 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    print(f"  原始长度: {len(content)}")
    print(f"  前1000: {content[:1000]}")
    
    # 尝试移除 ABCBD、ABCBDA 模式
    # 方法1: 正则移除所有 "ABC|CB|BD|DA|BC" 子串
    # 模式太复杂，先试最简单的：每隔6个字符取前2个。
    
    # 方法2: 每7个字节，保留前2个，删后5个。
    # 根据ABCBD 5字母模式，我们每隔 5 字符取第一个。
    # 试: 每5字符，留第一个
    step5 = ''
    for i in range(0, len(content), 5):
        chunk = content[i:i+5]
        if len(chunk) > 0:
            step5 += chunk[0]
    print(f"  \n步长5第1: {step5[:200]}")
    print(f"  步长5长度: {len(step5)}")
    
    # 方法3: 每5字符留前2个
    step5_2 = ''
    for i in range(0, len(content), 5):
        chunk = content[i:i+5]
        if len(chunk) >= 2:
            step5_2 += chunk[:2]
    print(f"  \n步长5留2: {step5_2[:200]}")
    print(f"  长度: {len(step5_2)}")
    
    # 方法4: 每5字符留前3个
    step5_3 = ''
    for i in range(0, len(content), 5):
        chunk = content[i:i+5]
        if len(chunk) >= 3:
            step5_3 += chunk[:3]
    print(f"  \n步长5留3: {step5_3[:200]}")
    print(f"  长度: {len(step5_3)}")
    
    # 方法5: 每6字符留前3个
    step6_3 = ''
    for i in range(0, len(content), 6):
        chunk = content[i:i+6]
        if len(chunk) >= 3:
            step6_3 += chunk[:3]
    print(f"  \n步长6留3: {step6_3[:200]}")
    print(f"  长度: {len(step6_3)}")
    
    # 方法6: 直接用正则替换所有 "ABC|CB|BD|DA"
    cleaned1 = content
    cleaned1 = cleaned1.replace('ABC', '')
    cleaned1 = cleaned1.replace('CB', '')
    cleaned1 = cleaned1.replace('BD', '')
    cleaned1 = cleaned1.replace('DA', '')
    print(f"  \n移ABC/CB/BD/DA: {cleaned1[:200]}")
    print(f"  长度: {len(cleaned1)}")
    
    # 方法7: 移所有 "AB"、"BC"、"CD"、"DA"
    cleaned2 = content
    cleaned2 = cleaned2.replace('AB', '')
    cleaned2 = cleaned2.replace('BC', '')
    cleaned2 = cleaned2.replace('CD', '')
    cleaned2 = cleaned2.replace('DA', '')
    print(f"  \n移AB/BC/CD/DA: {cleaned2[:200]}")
    print(f"  长度: {len(cleaned2)}")
    
    # 检查是否包含original
    clean1_lower_step5 = step5.lower()
    if 'original' in clean1_lower_step5:
        print(f"  🎯🎯🎯 step5 含original")
        with open('STEP5_ORIGINAL.txt', 'w', encoding='utf-8') as f:
            f.write(step5)
        print(f"  💾 step5保存")
    
    clean1_2_lower = step5_2.lower()
    if 'original' in clean1_2_lower:
        print(f"  🎯🎯🎯 step5_2 含original")
        with open('STEP5_2_ORIGINAL.txt', 'w', encoding='utf-8') as f:
            f.write(step5_2)
        print(f"  💾 step5_2保存")
    
    clean1_3_lower = step5_3.lower()
    if 'original' in clean1_3_lower:
        print(f"  🎯🎯🎯 step5_3 含original")
        with open('STEP5_3_ORIGINAL.txt', 'w', encoding='utf-8') as f:
            f.write(step5_3)
        print(f"  💾 step5_3保存")
    
    clean6_3_lower = step6_3.lower()
    if 'original' in clean6_3_lower:
        print(f"  🎯🎯🎯 step6_3 含original")
        with open('STEP6_3_ORIGINAL.txt', 'w', encoding='utf-8') as f:
            f.write(step6_3)
        print(f"  💾 step6_3保存")

    # 保存 cleansing 后尝试
    with open('FINAL_STRIP_MASK_cleaned1.txt', 'w', encoding='utf-8') as f:
        f.write(cleaned1)
    print(f"  💾 cleaned1保存")
    
    with open('FINAL_STRIP_MASK_cleaned2.txt', 'w', encoding='utf-8') as f:
        f.write(cleaned2)
    print(f"  💾 cleaned2保存")
    
    with open('FINAL_STRIP_MASK_step5.txt', 'w', encoding='utf-8') as f:
        f.write(step5)
    print(f"  💾 step5保存")

if __name__ == "__main__":
    main()