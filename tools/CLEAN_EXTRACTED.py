#!/usr/bin/env python3
"""
过滤提取的数据 - 只保留可打印内容
"""
import re

def clean_extracted():
    """清理提取的数据"""
    
    print("💥 启动清理提取数据")
    print("策略: 只保留ASCII可打印字符，移除所有乱码")
    
    # 加载原始提取字节
    with open('RECONSTRUCTED_RAW_BYTES.bin', 'rb') as f:
        data = f.read()
    
    # 跳过文件头
    start_pos = 170
    compressed_data = data[start_pos:]
    
    print(f'原始掩盖数据: {len(compressed_data):,} 字节')
    
    # 按4字节组提取数据
    extracted_bytes = bytearray()
    
    i = 0
    while i < len(compressed_data) - 3:
        if compressed_data[i:i+3] == b'\xaf\xbf\xbd':
            # 取第四个字节
            extracted_bytes.append(compressed_data[i+3])
            i += 4
        else:
            # 没有掩盖，直接取
            extracted_bytes.append(compressed_data[i])
            i += 1
    
    print(f'提取后数据: {len(extracted_bytes):,} 字节')
    print(f'前100字节hex: {extracted_bytes[:100].hex()}')
    
    # 清理：只保留0x20-0x7E范围的可打印ASCII字符，以及合理的UTF-8
    clean_bytes = bytearray()
    
    for byte in extracted_bytes:
        # 可打印ASCII
        if 0x20 <= byte <= 0x7E:
            clean_bytes.append(byte)
        # 换行符
        elif byte in [0x0A, 0x0D, 0x09]:  # \n, \r, \t
            clean_bytes.append(byte)
    
    print(f'清理后数据: {len(clean_bytes):,} 字节')
    print(f'清理丢失: {len(extracted_bytes) - len(clean_bytes):,} 字节 ({100*(len(extracted_bytes)-len(clean_bytes))/len(extracted_bytes):.1f}%)')
    
    # 转换为文本
    clean_text = clean_bytes.decode('ascii', errors='ignore')
    print(f'清理文本: {len(clean_text):,} 字符')
    
    # 显示清理后的前800字符
    print(f'\\n清理文本前800字符:')
    print(clean_text[:800])
    
    # 保存清理结果
    with open('CLEAN_EXTRACTED_DATA.txt', 'w', encoding='utf-8') as f:
        f.write(clean_text)
    
    print(f'\\n💾 已保存到 CLEAN_EXTRACTED_DATA.txt')
    
    # 分析清理后的数据
    analyze_clean_data(clean_text)
    
    return clean_text

def analyze_clean_data(text):
    """分析清理后的数据"""
    
    print(f"\\n🔍 分析清理数据:")
    
    # 查找original相关
    original_patterns = [
        r'[Oo]riginal[^\\n]{0,200}',
        r'[Oo]riginal[^\\s]{0,100}',
        r'original_media_info',
        r'media_info',
        r'main_url',
    ]
    
    found_original = []
    
    for pattern in original_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            found_original.extend(matches)
    
    if found_original:
        print(f"   🎯 找到 {len(found_original)} 个original相关:")
        for match in found_original:
            print(f"      {match[:100]}")
        
        # 保存original相关内容
        with open('ORIGINAL_FOUND_IN_CLEAN.txt', 'w', encoding='utf-8') as f:
            f.write("\\n".join(found_original))
        print(f"   💾 original相关已保存")
    
    else:
        print(f"   ❌ 未找到original相关")
        
        # 找其他关键词
        other_keywords = ['doubao', 'video', 'unwatermark', 'json']
        found_others = []
        
        for keyword in other_keywords:
            matches = re.findall(r'[^\\n\\r]{0,100}' + keyword + r'[^\\n\\r]{0,100}', text, re.IGNORECASE)
            if matches:
                found_others.extend([(keyword, match) for match in matches])
        
        if found_others:
            print(f"   🎯 找到其他关键词:")
            for keyword, match in found_others[:5]:
                print(f"      [{keyword}] {match[:100]}")
    
    # 查找JSON结构
    json_objects = re.findall(r'\\{[\\s\\S]*?\\}', text)
    
    if json_objects:
        print(f"   🎯 找到 {len(json_objects)} 个JSON对象:")
        
        media_jsons = []
        for js in json_objects:
            if any(kw in js.lower() for kw in ['original', 'media', 'url', 'video', 'doubao']):
                media_jsons.append(js)
        
        if media_jsons:
            print(f"      🎯 其中 {len(media_jsons)} 个可能media相关:")
            for i, js in enumerate(media_jsons[:3]):
                print(f"         [{i+1}] {js[:150]}")
        
        # 保存JSON
        with open('JSON_FROM_CLEAN.txt', 'w', encoding='utf-8') as f:
            f.write(f"找到 {len(json_objects)} 个JSON对象\\n\\n")
            for i, js in enumerate(json_objects):
                f.write(f"[{i+1}] {js}\\n\\n")
        
        print(f"   💾 JSON已保存到 JSON_FROM_CLEAN.txt")
    
    # 查找URL
    urls = re.findall(r'https?://\\S+', text)
    
    if urls:
        print(f"   🎯 找到 {len(urls)} 个URL:")
        
        doubao_urls = [url for url in urls if 'doubao' in url.lower()]
        video_urls = [url for url in urls if '.mp4' in url.lower() or 'video' in url.lower()]
        other_urls = [url for url in urls if url not in doubao_urls and url not in video_urls]
        
        if doubao_urls:
            print(f"      🎯 豆包URL ({len(doubao_urls)}):")
            for url in doubao_urls[:3]:
                print(f"         🔗 {url[:80]}")
                
                # 检查水印
                if 'unwatermark' in url.lower():
                    print(f"            🎉 无水印确认!")
                elif 'watermark' not in url.lower():
                    print(f"            💭 可能无水印")
        
        if video_urls:
            print(f"      🎥 视频URL ({len(video_urls)}):")
            for url in video_urls[:3]:
                print(f"         📺 {url[:80]}")
        
        if other_urls:
            print(f"      📎 其他URL ({len(other_urls)})")
            
        # 保存URLs
        with open('URLS_FROM_CLEAN.txt', 'w', encoding='utf-8') as f:
            f.write(f"找到 {len(urls)} 个URL\\n\\n")
            for url in urls:
                f.write(url + "\\n")
        
        print(f"   💾 URLs已保存到 URLS_FROM_CLEAN.txt")

if __name__ == "__main__":
    clean_extracted()
    
    print(f"\\n🎯 清理完成！")
    print(f"💡 检查CLEAN_EXTRACTED_DATA.txt查看详细结果")