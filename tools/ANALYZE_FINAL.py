#!/usr/bin/env python3
import re

# 加载最终的20KB明文数据
text = open('CLEAN_EXTRACTED_DATA.txt', 'r').read()

print(f'最终数据: {len(text):,} 字符')

# 深度搜索JSON结构
json_objects = re.findall(r'\{[^\{\}\n]{10,500}\}', text)
print(f'\n找到 {len(json_objects)} 个较短JSON对象')

if json_objects:
    # 分析JSON内容，寻找可能的media字段
    media_candidates = []
    for js in json_objects:
        # 查找可能的重命名字段
        if any(keyword in js.lower() for keyword in ['url', 'src', 'link', 'video', 'info']):
            media_candidates.append(js)
    
    if media_candidates:
        print(f'🎯 找到 {len(media_candidates)} 个可能media相关的JSON:')
        for i, candidate in enumerate(media_candidates[:5]):
            print(f'   \n{candidate}\n')
            
        # 保存所有media JSON
        with open('MEDIA_JSON_CANDIDATES.txt', 'w') as f:
            f.write(f'找到 {len(media_candidates)} 个media相关的JSON:\n\n')
            for js in media_candidates:
                f.write(js + '\n\n')
        print(f'💾 已保存到 MEDIA_JSON_CANDIDATES.txt')
    else:
        print(f'❌ 未找到media相关JSON')
        
        # 显示所有JSON看看结构
        print(f'\n所有JSON对象预览:')
        for i, js in enumerate(json_objects[:5]):
            print(f'   JSON[{i+1}]: {js[:150]}')

# 搜索长字母数字序列 (可能的video_id/token)
alpha_num_seqs = re.findall(r'[a-zA-Z0-9]{50,}', text)
if alpha_num_seqs:
    print(f'\n🎯 找到 {len(alpha_num_seqs)} 个长字母数字序列:')
    for seq in alpha_num_seqs[:5]:
        print(f'   {seq}')
        
        # 检查是否类似豆包的video_id格式
        if len(seq) > 30 and len(seq) < 60:
            print(f'   可能是video_id或加密key!')

# 搜索URL片段  
url_fragments = re.findall(r'https?://[^ \n\r]{20,}', text)
if url_fragments:
    print(f'\n🎯 找到 {len(url_fragments)} 个长URL片段:')
    for url in url_fragments[:5]:
        print(f'   {url}')
        
        if 'doubao' in url.lower() or 'bytedance' in url.lower():
            print(f'   🎯 可能豆包域名!')

# 搜索常见的媒体URL参数
param_patterns = [
    'main_url',
    'video_url', 
    'media_url',
    'unwatermark',
    'watermark',
    'video_gen',
    'lr=',
    'videoweb',
]

found_params = []
for param in param_patterns:
    if param in text.lower():
        count = text.lower().count(param)
        found_params.append((param, count))

if found_params:
    print(f'\n🎯 找到媒体参数:')
    for param, count in found_params:
        print(f'   {param}: {count} 次')

# 提取所有可能的key-value结构
key_values = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*[^\s\n,;]{5,}', text)
if key_values:
    print(f'\n🎯 找到 {len(key_values)} 个key-value结构:')
    for kv in key_values[:10]:
        print(f'   {kv}')

print('\n✅ 深度分析完成！')