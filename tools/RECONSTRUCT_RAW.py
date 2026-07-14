#!/usr/bin/env python3
"""
重建原始bytes - UTF-8损坏的数据还原
"""
def reconstruct_raw():
    """重建原始字节"""
    
    print("💥💥💥 重建原始字节攻击 💥💥💥")
    print("策略: 直接从UTF-8文本中恢复原始bytes")
    
    # 加载损坏的UTF-8文本
    with open('../decoded_content_URL解码_20260706_102428.txt', 'r', errors='ignore') as f:
        corrupted_text = f.read()
    
    print(f"📊 损坏文本: {len(corrupted_text):,} 字符")
    
    # 转换为原始bytes
    # UTF-8编码保留原来的bytes
    raw_bytes = corrupted_text.encode('utf-8', errors='replace')
    
    print(f"原始bytes: {len(raw_bytes):,} 字节")
    print(f"前50字节hex: {raw_bytes[:50].hex()}")
    print(f"后50字节hex: {raw_bytes[-50:].hex()}")
    
    # 替换UTF-8错误字节
    # c2bd -> bd (189), c3af -> af (175), c3bf -> bf (191), c2bf -> bf (191)
    replacements = [
        (b'\xc2\xbd', b'\xbd'),  # ï¿½ -> 0xBD
        (b'\xc3\xaf', b'\xaf'),  # ï¿½ -> 0xAF  
        (b'\xc3\xbf', b'\xbf'),  # ï¿½ -> 0xBF
        (b'\xc2\xbf', b'\xbf'),  # ï¿½ -> 0xBF
        (b'\xc3\x92', b'\x92'),  # ï¿½ -> 0x92
        (b'\xc2\xb4', b'\xb4'),  # ï¿½ -> 0xB4
        (b'\xc3\x87', b'\x87'),  # ï¿½ -> 0x87
        (b'\xc2\x9f', b'\x9f'),  # ï¿½ -> 0x9F
    ]
    
    modified_bytes = raw_bytes
    replacement_count = 0
    
    for old_seq, new_byte in replacements:
        count = modified_bytes.count(old_seq)
        if count > 0:
            modified_bytes = modified_bytes.replace(old_seq, new_byte)
            replacement_count += count
            print(f"   替换 {count:,} 处 {old_seq.hex()} -> {new_byte.hex()}")
    
    print(f"   总共替换: {replacement_count:,} 处")
    print(f"   修复后: {len(modified_bytes):,} 字节")
    
    # 保存修复后的bytes
    with open('RECONSTRUCTED_RAW_BYTES.bin', 'wb') as f:
        f.write(modified_bytes)
    
    print(f"💾 已保存到 RECONSTRUCTED_RAW_BYTES.bin")
    
    # 分析修复后的数据
    analyze_reconstructed(modified_bytes)
    
    return modified_bytes

def analyze_reconstructed(data):
    """分析重建的数据"""
    
    print(f"\n🔬 重建数据分析:")
    
    # 检查gzip magic
    if data[:2] == b'\x1f\x8b':
        print(f"   🎯 检测到gzip magic在开始处!")
        try:
            import gzip
            decompressed = gzip.decompress(data)
            print(f"   ✅ Gzip解压成功: {len(decompressed):,} 字节")
            
            # 尝试文本解码
            try:
                text = decompressed.decode('utf-8', errors='ignore')
                print(f"   ✅ 文本解码: {len(text):,} 字符")
                
                # 查找媒体信息
                analyze_text(text, 'direct_gzip')
            except Exception as e:
                print(f"   ❌ 无有效文本: {e}")
        except Exception as e:
            print(f"   ❌ Gzip失败: {e}")
    
    # 检查zlib magic  
    if data[:2] == b'\x78\x9c':
        print(f"   🎯 检测到zlib magic在开始处!")
        try:
            import zlib
            decompressed = zlib.decompress(data)
            print(f"   ✅ Zlib解压成功: {len(decompressed):,} 字节")
            
            try:
                text = decompressed.decode('utf-8', errors='ignore')
                print(f"   ✅ 文本解码: {len(text):,} 字符")
                
                analyze_text(text, 'direct_zlib')
            except Exception as e:
                print(f"   ❌ 无有效文本: {e}")
        except Exception as e:
            print(f"   ❌ Zlib失败: {e}")
    
    # 检查base64模式
    import re
    text_form = data.decode('utf-8', errors='ignore')
    base64_patterns = re.findall(r'[A-Za-z0-9+/]{50,}', text_form)
    
    if base64_patterns:
        print(f"   🎯 找到 {len(base64_patterns)} 个长Base64序列")
        
        longest = max(base64_patterns, key=len)
        print(f"   最长Base64: {len(longest)} 字符")
        
        # 尝试解码
        try:
            import base64
            padding = 4 - (len(longest) % 4) % 4
            padded = longest + ('=' * padding)
            decoded = base64.b64decode(padded, validate=False)
            
            print(f"   ✅ Base64解码: {len(decoded)} 字节")
            
            # 尝试进一步解压
            try:
                import gzip
                decompressed = gzip.decompress(decoded)
                print(f"   ✅ Base64+gzip: {len(decompressed):,} 字节")
                
                try:
                    text = decompressed.decode('utf-8', errors='ignore')
                    print(f"   ✅ 最终文本: {len(text):,} 字符")
                    
                    analyze_text(text, 'base64_gzip')
                except Exception as e:
                    print(f"   ❌ 无有效文本: {e}")
            except Exception as e:
                print(f"   Base64 gzip失败: {e}")
        except Exception as e:
            print(f"   ❌ Base64解码失败: {e}")
    
    # 检查hex pattern
    if re.match(r'^[0-9a-fA-F]{20,}$', text_form.strip()):
        print(f"   🎯 可能是hex编码")
        
        try:
            hex_bytes = bytes.fromhex(text_form.strip())
            print(f"   ✅ Hex解码: {len(hex_bytes)} 字节")
            
            try:
                text = hex_bytes.decode('utf-8', errors='ignore')
                print(f"   ✅ Hex文本: {len(text):,} 字符")
                analyze_text(text, 'from_hex')
            except Exception as e:
                print(f"   ❌ 无有效文本: {e}")
        except Exception as e:
            print(f"   ❌ Hex解码失败: {e}")

def analyze_text(text, method):
    """分析解码文本"""
    
    print(f"   🔍 分析 [{method}] 文本:")
    
    if len(text) < 100:
        print(f"      ❌ 太短")
        return
    
    # 查找关键词
    keywords = ['original', 'media_info', 'doubao', 'main_url', 'video']
    text_lower = text.lower()
    
    found_keywords = []
    for keyword in keywords:
        if keyword in text_lower:
            count = text_lower.count(keyword)
            found_keywords.append(f"{keyword}({count})")
    
    if found_keywords:
        print(f"      🎯 找到关键词: {', '.join(found_keywords)}")
        
        # 保存结果
        filename = f"SUCCESS_{method}_{len(text)}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"      💾 已保存到 {filename}")
    
    # 查找URL
    import re
    urls = re.findall(r'https?://\S+', text)
    
    if urls:
        print(f"      🎯 找到 {len(urls)} 个URL:")
        
        for url in urls[:3]:
            print(f"         🔗 {url[:80]}")
            
            if 'doubao' in url.lower():
                print(f"            🟦 Doubao URL")
                
                # 检查水印
                if 'unwatermark' in url.lower():
                    print(f"            🎉 Unwatermarked!")
                elif 'watermark' not in url.lower():
                    print(f"            💭 Possibly unwatermarked")
    
    # 查找JSON
    json_objects = re.findall(r'\{[^\{\}]*?\}', text)
    
    if json_objects:
        print(f"      🎯 找到 {len(json_objects)} 个JSON对象")
        
        for js in json_objects[:2]:
            if any(kw in js.lower() for kw in ['original', 'media', 'url']):
                print(f"         🎯 {js[:150]}")

if __name__ == "__main__":
    reconstruct_raw()
    
    print(f"\n🎯 重建完成！")
    print(f"💡 检查生成的SUCCESS文件查看突破结果")