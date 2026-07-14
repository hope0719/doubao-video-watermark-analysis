#!/usr/bin/env python3
import re
import json
from pathlib import Path

def scan_decoded_files():
    """直接扫描解码后的具体内容"""
    
    print("\n🔍 === 二进制流内容扫描 === \n")
    
    # 要扫描的解码文件
    decoded_files = [
        "../decoded_content_URL解码_20260706_102428.txt",
        "../decoded_content_Unicode解码_20260706_102428.txt", 
        "../decoded_content_字符替换_20260706_102428.txt"
    ]
    
    # 无水印相关的关键词
    watermark_keywords = [
        'unwatermark', 'no_watermark', 'watermark_free',
        'original', 'raw', 'clean', 
        'video_gen_no_watermark', 'video_gen_unwatermark',
        'watermark=0', 'watermark=false', 'wm=0'
    ]
    
    # API相关关键词
    api_keywords = [
        'media_info', 
        'play_info', 
        'main_url',
        'video_url',
        'original_media',
        'samantha',
        'doubao'
    ]
    
    print("📋 逐个扫描解码文件...")
    
    for file_path in decoded_files:
        print(f"\n  文件: {file_path}")
        try:
            # 使用二进制模式读取防止编码问题
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # 转换为字符串进行搜索
            try:
                text_content = content.decode('utf-8', errors='ignore')
            except:
                text_content = str(content)  # 保底
            
            print(f"    大小: {len(content):,} 字节")
            
            # 分块扫描，避免一次性处理大文本
            chunks = [text_content[i:i+10000] for i in range(0, len(text_content), 5000)]
            
            for chunk_num, chunk in enumerate(chunks[:10]):  # 限制块数
                print(f"\n    第{chunk_num+1}片段分析:")
                
                # 1. 扫描无水印关键词
                found_watermark = []
                for keyword in watermark_keywords:
                    matches = re.findall(f'[^a-zA-Z0-9_]{keyword}[^a-zA-Z0-9_]', chunk, re.IGNORECASE)
                    if matches:
                        found_watermark.extend(matches)
                
                if found_watermark:
                    print(f"      💡 找到无水印关键词: {set(found_watermark)}")
                    
                # 2. 扫描JSON结构
                json_pattern = r'\{[^\}]*?["\']' + '|'.join(api_keywords) + '["\'][^\}]*?' 
                json_structures = re.findall(r'\{[^\}]*?media_info[^\}]*?\}', chunk, re.IGNORECASE | re.DOTALL)
                json_structures.extend(re.findall(r'\{[^\}]*?original[^\}]*?\}', chunk, re.IGNORECASE | re.DOTALL))
                
                if json_structures:
                    print(f"      🔍 找到JSON结构 (显示前2个):")
                    for i, js in enumerate(json_structures[:2]):
                        lines = js.split('\n')
                        preview = '\n'.join(lines[:3])
                        print(f"        [{i+1}] {preview[:300]}...")
                        
                        # 检查是否包含无水印字段
                        for keyword in watermark_keywords:
                            if keyword in js.lower():
                                print(f"          🎯 包含无水印字段: {keyword}")
                
                # 3. 扫描URL片段
                url_pattern = r'https?://[^\s"\'>]{20,}'
                urls = re.findall(url_pattern, chunk)
                
                for url in urls[:3]:  # 显示前3个
                    url_lower = url.lower()
                    
                    if 'doubao' in url_lower:
                        print(f"      🎯 豆包URL: {url[:80]}...")
                        
                        # 检查URL参数
                        if any(wm in url_lower for wm in watermark_keywords):
                            print(f"        ✅ 包含无水印参数!")
                        
                        # 提取所有参数
                        if '?' in url:
                            params = url.split('?')[1]
                            param_pairs = params.split('&')[:5]  
                            print(f"        参数: {' & '.join(param_pairs)}")
    
    print("\n\n📊 === 文件扫描完成 ===")

if __name__ == "__main__":
    scan_decoded_files()