#!/usr/bin/env python3

# 加载修复后的数据
with open('RECONSTRUCTED_RAW_BYTES.bin', 'rb') as f:
    data = f.read()

# 跳过文件头并跳过掩盖字节
start_pos = 170
compressed_data = data[start_pos:]

print(f'掩盖数据: {len(compressed_data):,} 字节')
print(f'原始hex: {compressed_data[:80].hex()}')

# 提取掩盖字节之间的内容 (每4字节取1字节)
result_bytes = bytearray()

i = 0
while i < len(compressed_data):
    if i+3 < len(compressed_data) and compressed_data[i:i+3] == b'\xaf\xbf\xbd':
        # 跳过掩盖，取下一个字节
        if i+3 < len(compressed_data):
            result_bytes.append(compressed_data[i+3])
            i += 4  # 跳过4字节
        else:
            break
    else:
        # 没有掩盖模式，取当前字节
        result_bytes.append(compressed_data[i])
        i += 1

print(f'提取后: {len(result_bytes):,} 字节')
print(f'提取hex: {result_bytes[:80].hex()}')

# 尝试解码为文本
try:
    text = result_bytes.decode('utf-8', errors='ignore')
    print(f' ✅ 文本解码成功: {len(text):,} 字符')
    
    # 查找original关键词
    keywords = ['original', 'media', 'doubao', 'main_url', 'video', 'unwatermark']
    text_lower = text.lower()
    found = [kw for kw in keywords if kw in text_lower]
    
    if found:
        print(f' 🎯 找到关键词: {found}')
        print(f' 前1000字符:')
        print(text[:1000])
        
        # 保存结果
        with open('MASK_REMOVED_SUCCESS.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print(' 💾 已保存到 MASK_REMOVED_SUCCESS.txt')
    
    else:
        print(f' ❌ 未找到media关键词，但找到了: {text[:500]}')
        
        # 尝试查找其他关键词
        other_keywords = ['http', 'json', '{', '"']  
        other_found = [kw for kw in other_keywords if kw in text]
        if other_found:
            print(f' 其他发现: {other_found}')
            
            # 再尝试gzip
            try:
                import gzip
                decompressed = gzip.decompress(result_bytes)
                print(f' 🎯 Gzip成功: {len(decompressed):,} 字节')
                
                try:
                    final_text = decompressed.decode('utf-8', errors='ignore')
                    print(f' ✅ 最终文本: {len(final_text):,} 字符')
                    
                    final_found = [kw for kw in keywords if kw in final_text.lower()]
                    if final_found:
                        print(f' 🎉 找到final关键词: {final_found}')
                        print(final_text[:800])
                        
                        with open('FINAL_GZIP_SUCCESS.txt', 'w', encoding='utf-8') as f:
                            f.write(final_text)
                        print(' 🎯 已保存到 FINAL_GZIP_SUCCESS.txt')
                
                except Exception as e:
                    print(f' ❌ 无最终文本: {e}') 
            
            except Exception as e:
                print(f' ❌ Gzip失败: {e}')
        
        with open('MASK_REMOVED_INTERMEDIATE.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print(' 💾 中间结果已保存')

except Exception as e:
    print(f' ❌ 文本解码失败: {e}')
    print(f' 原始hex: {result_bytes[:100].hex()}')

print('\n✅ 掩盖移除完成！')