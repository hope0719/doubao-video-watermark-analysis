#!/usr/bin/env python3
import gzip
import zlib

# 加载修复后的数据
with open('RECONSTRUCTED_RAW_BYTES.bin', 'rb') as f:
    data = f.read()

print(f'修复后数据: {len(data):,} 字节')

# 跳过文件头找到实际数据块
header_size = 0
for i in range(len(data)):
    if data[i:i+3] == b'\xaf\xbf\xbd':
        header_size = i
        break

print(f'数据块起始位置: {header_size:,}')

# 提取实际数据块
compressed_data = data[header_size:]
print(f'压缩数据: {len(compressed_data):,} 字节')
print(f'前30字节hex: {compressed_data[:30].hex()}')

# 尝试gzip解压整个块
try:
    decompressed = gzip.decompress(compressed_data)
    print(f' ✅ Gzip解压成功: {len(decompressed):,} 字节')
    
    # 尝试解码为文本
    try:
        text = decompressed.decode('utf-8', errors='ignore')
        print(f' ✅ 文本解码成功: {len(text):,} 字符')
        
        # 查找关键词
        keywords = ['original', 'media_info', 'doubao', 'main_url', 'video', 'unwatermark']
        text_lower = text.lower()
        found = [kw for kw in keywords if kw in text_lower]
        
        if found:
            print(f' 🎯 找到关键词: {found}')
            print(f' 前800字符:')
            print(text[:800])
            
            # 保存结果  
            with open('GZIP_BREAKTHROUGH.txt', 'w', encoding='utf-8') as f:
                f.write(text)
            print(' 💾 已保存到 GZIP_BREAKTHROUGH.txt')
        else:
            print(f' ❌ 未找到媒体关键词')
            print(f' 前500字符: {text[:500]}')
    
    except Exception as e:
        print(f' ❌ 文本解码失败: {e}')
        print(f' 原始数据hex: {decompressed[:100].hex()}')

except Exception as e:
    print(f' ❌ Gzip解压失败: {e}')

    # 尝试zlib
    try:
        import zlib
        decompressed = zlib.decompress(compressed_data)
        print(f' ✅ Zlib解压成功: {len(decompressed):,} 字节')
        
        try:
            text = decompressed.decode('utf-8', errors='ignore')
            print(f' ✅ Zlib文本解码: {len(text):,} 字符')
            
            keywords = ['original', 'media_info', 'doubao', 'main_url']
            text_lower = text.lower()
            found = [kw for kw in keywords if kw in text_lower]
            
            if found:
                print(f' 🎯 找到关键词: {found}')
                with open('ZLIB_BREAKTHROUGH.txt', 'w', encoding='utf-8') as f:
                    f.write(text)
                print(' 💾 已保存到 ZLIB_BREAKTHROUGH.txt')
        except Exception as e:
            print(f' ❌ Zlib文本解码失败: {e}')
    except Exception as e:
        print(f' ❌ zlib也失败: {e}')

print('\n✅ 提取完成！')