#!/usr/bin/env python3
"""
深度扫描解码文件中的无水印字段
"""
import re

def scan_decoded_content():
    """扫描解码文件寻找被忽略的无水印字段"""
    print('\n🔍 深度扫描解码文件\n')
    
    decoded_files = [
        '../decoded_content_URL解码_20260706_102428.txt',
        '../decoded_content_Unicode解码_20260706_102428.txt',
        '../decoded_content_字符替换_20260706_102428.txt'
    ]
    
    # 关键词搜索
    fields_to_search = [
        'no_watermark', 'unwatermark', 'watermark_free',
        'original_media', 'raw_video', 'clean_video',
        'video_gen_no_watermark', 'lr=unwatermarked',
        'watermark=false', 'wm=0'
    ]
    
    found_data = []
    
    for file_path in decoded_files:
        print(f'📋 扫描 {file_path}')
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # 尝试多种编码
            for encoding in ['utf-8', 'latin-1', 'ascii']:
                try:
                    text = content.decode(encoding, errors='ignore')
                    break
                except:
                    continue
            
            print(f'   大小: {len(content):,} 字节')
            
            # 搜索关键词
            for field in fields_to_search:
                matches = re.findall(f'["\\\']{field}["\\\'].*?["\\\']([^"\\\']+)', text, re.IGNORECASE)
                if matches:
                    for match in matches[:2]:  # 限制显示
                        print(f'   💡 {field}: {match}')
                        found_data.append({'field': field, 'value': match, 'file': file_path})
            
            # 搜索JSON结构
            json_structs = re.findall(r'\{[^\}]*?media_info[^\}]*?\}', text, re.DOTALL)
            for js in json_structs[:2]:
                print(f'   🔍 media_info结构: {js[:200]}...')
                
            # 搜索豆包URL
            doubao_urls = re.findall(r'https://[^ ]*doubao[^ ]*', text, re.IGNORECASE)
            for url in doubao_urls[:2]:
                if any(f in url.lower() for f in fields_to_search):
                    print(f'   🎯 无水印豆包URL: {url[:80]}...')
                else:
                    print(f'   📝 普通豆包URL: {url[:80]}...')
        
        except Exception as e:
            print(f'   ❌ 读取失败: {e}')
    
    print('\n📊 扫描完成')
    return found_data

if __name__ == '__main__':
    scan_decoded_content()