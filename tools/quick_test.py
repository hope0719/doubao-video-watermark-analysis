#!/usr/bin/env python3
import gzip, zlib, base64, re

# 加载165K数据
with open('../decoded_content_URL解码_20260706_102428.txt', 'rb') as f:
    data = f.read()

print(f'数据大小: {len(data):,} 字节')
print(f'文件头hex: {data[:40].hex()}')
print(f'文件尾hex: {data[-40:].hex()}')

# 直接尝试utf-8解码
text = data.decode('utf-8', errors='ignore')
print(f'utf-8文本长度: {len(text):,} 字符')

# 搜索base64块
base64_candidates = re.findall(r'[A-Za-z0-9+/]{40,}', text)
print(f'找到 {len(base64_candidates)} 个base64候选')

# 取最长的base64尝试解码
if base64_candidates:
    longest = max(base64_candidates, key=len)
    print(f'最长base64候选: {len(longest)} 字符')
    print(f'前200字符: {longest[:200]}')
    
    try:
        padding = 4 - (len(longest) % 4) % 4
        padded = longest + ('=' * padding)
        
        decoded = base64.b64decode(padded, validate=False)
        print(f'Base64解码: {len(decoded)} 字节')
        print(f'解码结果hex: {decoded[:100].hex()}')
        
        # 尝试gzip解压
        try:
            decompressed = gzip.decompress(decoded)
            print(f'gzip成功: {len(decompressed)} 字节')
            
            # 尝试文本解码
            try:
                text_result = decompressed.decode('utf-8', errors='ignore')
                print(f'文本结果: {len(text_result):,} 字符')
                print(f'前500字符:')
                print(text_result[:500])
                
                # 查找关键词
                if re.search(r'original|media_info|doubao|url', text_result, re.I):
                    print('\n🎯 找到媒体信息关键词！')
                    with open('FINAL_SUCCESS.txt', 'w', encoding='utf-8') as f:
                        f.write(text_result)
                    print('💾 已保存到 FINAL_SUCCESS.txt')
            
            except Exception as e:
                print(f'无有效文本: {e}')
        
        except Exception as e:
            print(f'gzip失败: {e}')
    
    except Exception as e:
        print(f'base64解码失败: {e}')

print('\n✅ 快速探测完成！')