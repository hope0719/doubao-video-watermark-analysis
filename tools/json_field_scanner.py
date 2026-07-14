#!/usr/bin/env python3
import re
import json
import glob
from pathlib import Path

def scan_all_json_content():
    """深度扫描所有API返回，寻找被忽略的无水印字段"""
    
    print("\n🔍 === 深度JSON字段挖掘 === \n")
    
    # 收集所有包含JSON的文件
    json_patterns = [
        "*dump*.txt", "*response*.txt", 
        "*output*.log", "*api*.log",
        "**/*.json", "**/logs/**"
    ]
    
    found_files = []
    
    # 在当前目录搜索JSON文件 
    for pattern in json_patterns:
        found_files.extend(glob.glob(pattern, recursive=True))
    
    # 如果没找到文件，从输出目录搜索
    if not found_files:
        for pattern in json_patterns:
            found_files.extend(glob.glob(f"output/**/{pattern}", recursive=True))
    
    # 手动添加特定的result文件
    specific_files = [
        "../content_analysis_results.json",
        "../binary_analysis_results.json", 
        "../decoding_summary_*.json"
    ]
    for pattern in specific_files:
        found_files.extend(glob.glob(pattern, recursive=True))
    
    print(f"📁 发现 {len(found_files)} 个潜在JSON文件")
    
    # 无水印相关字段列表
    watermark_fields = [
        'no_watermark', 'unwatermark', 'unwatermarked', 
        'original', 'original_url', 'original_media', 
        'raw', 'raw_url', 'raw_media',
        'clean', 'clean_url',
        'download_url', 'source_url',
        'video_gen_no_watermark', 'watermark_free'
    ]
    
    found_watermark_data = []
    
    for file_path in found_files:
        print(f"\n📋 扫描文件: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 1. 直接JSON解析
            try:
                data = json.loads(content)
                scan_json_object(data, file_path, watermark_fields, found_watermark_data)
            except json.JSONDecodeError:
                # 2. 从文本中提取JSON
                json_matches = re.findall(r'\{.*?\}', content, re.DOTALL)
                for json_str in json_matches[:3]:  # 限制数量 
                    try:
                        data = json.loads(json_str)
                        scan_json_object(data, file_path, watermark_fields, found_watermark_data)
                    except:
                        continue
            
            # 3. 正则搜索关键词
            for field in watermark_fields:
                if field in content.lower():
                    matches = re.findall(f'"({field}[^"]*)":\s*"([^"]+)"', content, re.IGNORECASE)
                    for match in matches:
                        found_watermark_data.append({
                            'file': file_path,
                            'field': match[0],
                            'value': match[1]
                        })
                        
        except Exception as e:
            print(f"  ❌ 读取失败: {e}")
    
    # 打印结果
    print(f"\n\n📊 === 扫描结果汇总 ===")
    print(f"总共发现 {len(found_watermark_data)} 个无水印相关字段\n")
    
    if found_watermark_data:
        print("🎯 发现的无水印字段:")
        for i, item in enumerate(found_watermark_data, 1):
            print(f"  [{i}] {item['file']}")
            print(f"      📝 {item['field']}: {item['value']}")
            
            # 检查是否包含无水印URL
            value = item['value']
            if 'lr=unwatermark' in value or 'doubao' in value:
                print(f"      💡 可能是无水印URL！")
                
                # 保存到文件
                with open('possible_unwatermarked.txt', 'a') as f:
                    f.write(f"// 来自 {item['file']}\n")
                    f.write(f"{item['field']}: {item['value']}\n\n")
    else:
        print("❌ 未找到无水印相关字段")
        
    return found_watermark_data

def scan_json_object(data, file_path, fields, found_list, path=""):
    """递归扫描JSON对象"""
    
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            
            # 检查关键字段名
            if any(field in key.lower() for field in fields):
                found_list.append({
                    'file': file_path,
                    'field': key,
                    'value': str(value),
                    'path': current_path
                })
                
            # 递归扫描嵌套
            if isinstance(value, (dict, list)):
                scan_json_object(value, file_path, fields, found_list, current_path)
            
            # 检查值是否包含无水印URL  
            elif isinstance(value, str) and ('doubao.com' in value) and any(field in value for field in ['unwatermark', 'no_watermark']):
                found_list.append({
                    'file': file_path,
                    'field': f"{current_path} (value)",
                    'value': value,
                    'path': 'value'
                })
                
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, (dict, list)):
                scan_json_object(item, file_path, fields, found_list, f"{path}[{i}]")

if __name__ == "__main__":
    scan_all_json_content()