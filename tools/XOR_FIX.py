#!/usr/bin/env python3
"""
修复掩盖层 - 分析并移除afbfbd掩盖
"""
def fix_mask_layer():
    """修复掩盖层"""
    
    print("💥 掩盖层修复攻击")
    print("分析方案: afbfbd+明文 推测掩盖key")
    
    # 加载修复后的数据
    with open('RECONSTRUCTED_RAW_BYTES.bin', 'rb') as f:
        data = f.read()
    
    print(f'数据大小: {len(data):,} 字节')
    
    # 跳过文件头
    start_pos = 170
    compressed_data = data[start_pos:]
    
    print(f'掩盖数据: {len(compressed_data):,} 字节')
    print(f'前80字节hex: {compressed_data[:80].hex()}')
    
    # 分析掩盖模式
    # 从hex来看:
    # afbfbd515245 = 掩盖了的 " QRE" 
    # 515245 是 "QRE"
    # 所以推测掩king模式是: af, bf, bd 掩盖实际字节
    
    # 尝试XOR掩盖
    # 假设明文以 space 或 字母开始
    # " " = 0x20, "Q" = 0x51, "R" = 0x52, "E" = 0x45
    
    # 分析可能的key
    first_bytes = compressed_data[:20]
    print(f'第一个20字节: {first_bytes.hex()}')
    
    # 模式推测
    # 如果明文是 " original media info" 开头
    # 则有：0x20(space) ^ key = 0xaf 或 0xbf 或 0xbd
    
    possible_keys = []
    
    for i, byte in enumerate(first_bytes[:10]):
        # 猜测常见明文字符
        for plain_char in [0x20, 0x6f, 0x72, 0x69, 0x67, 0x61, 0x6e, 0x6c, 0x6d, 0x65]:
            key = byte ^ plain_char
            possible_keys.append(key)
    
    print(f'可能的key数量: {len(possible_keys)}')
    
    # 统计出现频率
    from collections import Counter
    key_count = Counter(possible_keys)
    print(f'Top 10可能的keys:')
    for key, count in key_count.most_common(10):
        print(f'   0x{key:02x} (十进制{key}): {count} 次')
    
    # 尝试最频繁的key
    if key_count:
        top_key = key_count.most_common(1)[0][0]
        print(f'\\n🔥 尝试Top key: 0x{top_key:02x}')
        
        # XOR解码
        decoded_bytes = bytes(b ^ top_key for b in compressed_data)
        
        print(f'解码后前100字节hex: {decoded_bytes[:100].hex()}')
        
        # 尝试解码文本
        try:
            text = decoded_bytes.decode('utf-8', errors='ignore')
            print(f'解码为文本: {len(text):,} 字符')
            
            if len(text) > 1000:
                print(f'前500字符: {text[:500]}')
                
                # 查找关键词
                keywords = ['original', 'media', 'doubao', 'main_url', 'video']
                text_lower = text.lower()
                found = [kw for kw in keywords if kw in text_lower]
                
                if found:
                    print(f' 🎯 找到关键词: {found}')
                    
                    # 再次尝试gzip解压
                    try:
                        import gzip
                        gzip_decompressed = gzip.decompress(decoded_bytes)
                        print(f' 🎯🎯🎯 Gzip解压成功: {len(gzip_decompressed):,} 字节')
                        
                        try:
                            final_text = gzip_decompressed.decode('utf-8', errors='ignore')
                            print(f' ✅ 最终文本: {len(final_text):,} 字符')
                            
                            # 查找媒体信息
                            final_keywords = ['original', 'media_info', 'doubao', 'main_url']
                            final_found = [kw for kw in final_keywords if kw in final_text.lower()]
                            
                            if final_found:
                                print(f' 🎉🎉🎉 找到original字段: {final_found}')
                                print(f' 前1000字符:\\n{final_text[:1000]}')
                                
                                # 保存最终成功结果
                                with open('FINAL_DECRYPTION_SUCCESS.txt', 'w', encoding='utf-8') as f:
                                    f.write(final_text)
                                print(f' 🎯🎯🎯 已保存到 FINAL_DECRYPTION_SUCCESS.txt')
                                
                                # 提取视频URL
                                import re
                                urls = re.findall(r'https?://[^\\s]+', final_text)
                                
                                if urls:
                                    print(f' 🎯 发现 {len(urls)} 个URL:')
                                    for url in urls[:5]:
                                        print(f'    🔗 {url}')
                                        
                                        if 'doubao' in url.lower():
                                            if 'unwatermark' in url.lower():
                                                print(f'      🎉🎉🎉 无水印确认!')
                                                with open('UNWATERMARKED_URL.txt', 'w') as f:
                                                    f.write(url)
                                                print(f'      🎯 无水印URL已保存')
                            
                        except Exception as e:
                            print(f' ❌ 最终文本解码失败: {e}')
                    
                    except Exception as e:
                        print(f' ❌ Gzip解压失败: {e}')
                        
                        # 直接分析文本
                        with open(f'XOR_RESULT_KEY_{top_key:02x}.txt', 'w', encoding='utf-8') as f:
                            f.write(text)
                        print(f' 💾 已保存到 XOR_RESULT_KEY_{top_key:02x}.txt')
        
        except Exception as e:
            print(f' ❌ 文本解码失败: {e}')
    
    # 如果Top key不行，尝试其他key
    tried_keys = 0
    for key, count in key_count.most_common(20):
        if tried_keys >= 5:  # 最多尝试5个
            break
            
        if key == top_key:  # 已尝试过
            continue
            
        print(f'\\n尝试key {tried_keys+2}: 0x{key:02x} (频率: {count})')
        tried_keys += 1
        
        # XOR解码
        decoded_bytes = bytes(b ^ key for b in compressed_data)
        
        try:
            text = decoded_bytes.decode('utf-8', errors='ignore')
            
            if len(text) > 5000:  # 足够长
                print(f'  文本长度: {len(text):,} 字符')
                
                # 查找关键词
                keywords = ['original', 'media', 'doubao']
                text_lower = text.lower()
                found = [kw for kw in keywords if kw in text_lower]
                
                if found:
                    print(f'  🎉 找到关键词: {found}')
                    
                    # 保存
                    with open(f'ALTERNATIVE_RESULT_KEY_{key:02x}.txt', 'w', encoding='utf-8') as f:
                        f.write(text)
                    print(f'  💾 已保存到 ALTERNATIVE_RESULT_KEY_{key:02x}.txt')
        
        except Exception as e:
            pass

if __name__ == "__main__":
    fix_mask_layer()
    print(f'\\n🎯 掩盖层修复完成！')