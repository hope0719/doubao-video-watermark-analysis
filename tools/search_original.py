#!/usr/bin/env python3
text = open('CLEAN_EXTRACTED_DATA.txt', 'r').read().lower()

# 搜索可能的original字段变化体
patterns = [
    'original',
    'Original', 
    'ORIGINAL',
    '0riginal',  # 0代替o
    'origina1',  # 1代替l
    'origina|',  # |代替l
    'orignal',   # 少一个i
    'orginal',   # 少一个i
    'original_',
    '_original',
    'original_',
    'media_info',
    'main_url',
    'video_url',
    'unwatermark',
    'no_watermark'
]

found_patterns = {}

for pattern in patterns:
    if pattern in text:
        count = text.count(pattern)
        found_patterns[pattern] = count
        print(f'🎯 找到 {pattern}: {count} 次')

if found_patterns:
    print(f'\n关键词统计完成！')
else:
    print(f'❌ 未找到标准关键词')
    
    # 搜索可能base64或hex编码的形式
    import re
    base64_like = re.findall(r'[A-Za-z0-9+/]{20,}', text)
    if base64_like:
        print(f'\n找到 {len(base64_like)} 个长base64序列')
        longest = max(base64_like, key=len)
        print(f'最长Base64: {len(longest)} 字符')
        print(f'前50字符: {longest[:50]}')
        
        # 尝试解码这个长的base64
        try:
            import base64
            padding = 4 - (len(longest) % 4) % 4
            padded = longest + ('=' * padding)
            decoded = base64.b64decode(padded, validate=False)
            
            print(f' ✅ Base64解码: {len(decoded)} 字节')
            
            # 尝试文本解码
            try:
                text_result = decoded.decode('utf-8', errors='ignore')
                if len(text_result) > 100:
                    print(f' ✅ Base64文本: {len(text_result)} 字符')
                    
                    # 检查是否包含媒体信息
                    media_keywords = ['original', 'media', 'url', 'doubao', 'video']
                    found_in_decoded = [kw for kw in media_keywords if kw in text_result.lower()]
                    
                    if found_in_decoded:
                        print(f' 🎯 Base64内找到关键词: {found_in_decoded}')
                        print(f' 前300字符: {text_result[:300]}')
                    
                    # 保存Base64结果
                    with open('BASE64_DECODED_RESULT.txt', 'w', encoding='utf-8') as f:
                        f.write(text_result)
                    print(f' 💾 Base64结果已保存')
            
            except Exception as e:
                print(f' ❌ Base64无有效文本: {e}')
        
        except Exception as e:
            print(f' ❌ Base64解码失败: {e}')

print('\n✅ 搜索完成！')