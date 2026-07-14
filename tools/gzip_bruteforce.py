#!/usr/bin/env python3
import gzip
import zlib
import re

# 加载165K数据
with open('../decoded_content_URL解码_20260706_102428.txt', 'rb') as f:
    data = f.read()

print(f'数据大小: {len(data):,} 字节')

# 寻找gzip magic number (1f8b)
gzip_magic = b'\x1f\x8b'
gzip_positions = []
for match in re.finditer(gzip_magic, data):
    gzip_positions.append(match.start())

print(f'找到 {len(gzip_positions)} 个gzip起始位置')

if gzip_positions:
    # 尝试第一个gzip块
    for i, pos in enumerate(gzip_positions[:3]):  # 尝试前3个
        print(f'\n尝试gzip块 {i+1}: 位置 {pos:,}')
        
        try:
            # 提取gzip块
            gzip_data = data[pos:pos+10000]  # 取10KB
            
            # 解压
            decompressed = gzip.decompress(gzip_data)
            print(f'   ✅ 解压成功: {len(decompressed):,} 字节')
            
            # 尝试解码为文本
            try:
                text = decompressed.decode('utf-8', errors='ignore')
                print(f'   ✅ 解码为文本: {len(text):,} 字符')
                
                # 查找关键词
                keywords = ['original', 'media_info', 'doubao', 'url', 'main_url']
                found = any(kw in text.lower() for kw in keywords)
                
                if found:
                    print(f'   🎯 找到媒体关键词！')
                    print(f'   前500字符: {text[:500]}')
                    
                    # 保存结果
                    with open(f'gzip_success_{i+1}.txt', 'w', encoding='utf-8') as f:
                        f.write(text)
                    print(f'   💾 已保存到 gzip_success_{i+1}.txt')
                    break
            
            except Exception as e:
                print(f'   ❌ 无有效文本: {e}')
        
        except Exception as e:
            print(f'   ❌ gzip失败: {e}')
        
        # 最多尝试3个
        if i >= 2:
            break

# 如果没有gzip，尝试zlib
if not gzip_positions:
    print(f'\n无gzip，尝试zlib magic (789c):')
    zlib_magic = b'\x78\x9c'
    zlib_positions = []
    for match in re.finditer(zlib_magic, data):
        zlib_positions.append(match.start())
    
    print(f'找到 {len(zlib_positions)} 个zlib位置')
    
    if zlib_positions:
        for i, pos in enumerate(zlib_positions[:3]):
            print(f'尝试zlib块 {i+1}: 位置 {pos:,}')
            try:
                zlib_data = data[pos:pos+10000]
                decompressed = zlib.decompress(zlib_data)
                print(f'   ✅ zlib解压成功: {len(decompressed):,} 字节')
            except Exception as e:
                print(f'   zlib失败: {e}')

print('\n✅ gzip/zlib探测完成！')