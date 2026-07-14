#!/usr/bin/env python3
"""
110个加密JSON结构的模式分析工具
专门针对original_media_info加密特征
"""
import re
import json
from collections import Counter

def analyze_encryption_patterns():
    """分析加密模式的深层特征"""
    
    print("🔬 110个加密JSON结构的深度模式分析\n")
    
    # 读取项目数据
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    
    try:
        with open(target_file, 'rb') as f:
            raw_data = f.read()
        
        print(f"📊 原始数据: {len(raw_data):,} 字节")
        
        # 转换为可分析的文本
        try:
            content = raw_data.decode('utf-8', errors='replace')
        except:
            content = str(raw_data)
        
        # 查找所有加密的JSON结构（之前发现的110个）
        encrypted_jsons = find_encrypted_jsons(content)
        
        if not encrypted_jsons:
            print("❌ 未找到加密JSON结构")
            return
        
        print(f"🎯 分析 {len(encrypted_jsons)} 个加密JSON结构\n")
        
        # 深度分析
        analyze_jsons_features(encrypted_jsons)
        
    except Exception as e:
        print(f"❌ 分析失败: {e}")

def find_encrypted_jsons(content):
    """查找加密的JSON结构""" 
    
    # 匹配包含二进制数据的JSON结构
    patterns = [
        r'\{[^}]*?[\x00-\x1f\x7f-\xff]+[^}]*?\}',  # JSON中包含二进制
        r'\{[^{}]*?\ufffd[^{}]*?\}',  # JSON中包含Unicode替换符
        r'["{][0-9a-f]{20,}[}"]',     # 长16进制串
        r'["{][A-Za-z0-9+/]{20,}[}"]'   # 可能Base64的长串
    ]
    
    found_jsons = []
    
    for pattern in patterns:
        matches = re.findall(pattern, content)
        for match in matches:
            if len(match) > 20 and match not in found_jsons:
                found_jsons.append(match)
    
    print(f"🔍 使用多种模式找到 {len(found_jsons)} 个候选结构")
    
    # 进一步过滤，只保留最有可能是加密original_media_info的
    filtered_jsons = []
    for js in found_jsons[:120]:  # 限制分析数量
        if is_likely_media_info(js):
            filtered_jsons.append(js)
    
    return filtered_jsons

def is_likely_media_info(text):
    """判断是否可能是media_info相关"""
    
    # 长度检查
    if len(text) < 50 or len(text) > 2000:
        return False
    
    # 结构检查
    if '{' not in text or '}' not in text:
        return False
    
    # 特征检查
    features = [
        r'[Oo]riginal', 
        r'[Mm]edia', 
        r'[Uu]rl', 
        r'[Vv]ideo',
        r'main',
        r'src',
        r'data'
    ]
    
    feature_count = 0
    for feature in features:
        if re.search(feature, text):
            feature_count += 1
    
    return feature_count >= 1

def analyze_jsons_features(encrypted_jsons):
    """深度分析JSON特征"""
    
    print(f"🔬 开始深度特征分析...")
    
    # 1. 长度分布分析
    lengths = [len(js) for js in encrypted_jsons]
    print(f"\n📊 长度分布:")
    print(f"   最小: {min(lengths)} 字符")
    print(f"   最大: {max(lengths)} 字符")
    print(f"   平均: {sum(lengths) / len(lengths):.1f} 字符")
    
    # 长度分组
    length_groups = {'small': [], 'medium': [], 'large': []}
    for js in encrypted_jsons:
        if len(js) < 100:
            length_groups['small'].append(js)
        elif len(js) < 300:
            length_groups['medium'].append(js)  
        else:
            length_groups['large'].append(js)
    
    for size, group in length_groups.items():
        print(f"   {size.capitalize()}: {len(group)} 个")
    
    # 2. 字符频率分析
    all_chars = ''.join(encrypted_jsons)                    
    print(f"\n🔤 字符总览:")
    print(f"   总字符数: {len(all_chars)}")
    print(f"   唯一字符数: {len(set(all_chars))}")
    
    # 3. 二进制/特殊字符分析
    binary_patterns = analyze_binary_patterns(encrypted_jsons)
    
    # 4. 结构分析
    analyze_json_structures(encrypted_jsons)
    
    # 5. 显示最佳候选者
    print(f"\n🎯 最有希望的候选者分析:")
    
    # 排序标准：长度适中(50-500)，包含特征字符
    candidates = []
    for js in encrypted_jsons:
        if 50 <= len(js) <= 500:
            score = 0
            
            # 特征词评分
            features = ['original', 'media', 'url', 'video', 'main']
            for feat in features:
                if feat in js.lower():
                    score += 2
            
            # 加密程度评分
            if '\ufffd' in js or re.search(r'[\x00-\x1f\x7f-\xff]{10,}', js):
                score += 3
            
            # 长度适当性评分  
            if 100 <= len(js) <= 300:
                score += 1
            
            if score >= 3:
                candidates.append((js, score))
    
    # 按分数排序
    candidates.sort(key=lambda x: x[1], reverse=True)
    
    print(f"   找到 {len(candidates)} 个高分候选者:")
    
    for i, (js, score) in enumerate(candidates[:5]):
        print(f"\n   🏆 候选者 {i+1} (分数: {score}):")
        print(f"      长度: {len(js)} 字符")
        
        # 显示clean version（去除不可见字符后的）
        clean_js = ''.join(char if 32 <= ord(char) <= 126 else '•' for char in js)
        print(f"      内容: {clean_js[:100]}...")
        
        # 分析这个具体结构
        analyze_specific_json(js, f"candidate_{i+1}")

def analyze_binary_patterns(jsons):
    """分析二进制模式"""
    
    print(f"\n🔍 二进制模式分析:")
    
    all_jsons = ''.join(jsons)
    
    # 二进制字节类型统计
    binary_types = {
        'control_chars': 0,  # \x00-\x1f
        'high_bytes': 0,     # \x80-\xff
        'unicode_repl': 0,   # \ufffd
        'url_encoded': 0     # %XX
    }
    
    for char in all_jsons:
        code = ord(char) if isinstance(char, str) else char
        
        if code < 32 and code != 10 and code != 13:  # 控制字符
            binary_types['control_chars'] += 1
        elif code > 127:  # 高位字节
            binary_types['high_bytes'] += 1
        elif char == '\ufffd':
            binary_types['unicode_repl'] += 1
    
    # URL编码统计
    binary_types['url_encoded'] = len(re.findall(r'%[0-9a-fA-F]{2}', all_jsons))
    
    for pattern, count in binary_types.items():
        print(f"   {pattern}: {count}")
    
    # 判断主导加密类型   
    max_pattern = max(binary_types, key=binary_types.get)
    print(f"   主导模式: {max_pattern}")
    
    return binary_types

def analyze_json_structures(jsons):
    """分析JSON结构特征"""
    
    print(f"\n📐 JSON结构分析:")
    
    # 层数统计
    nesting_levels = []
    key_patterns = []
    
    for js in jsons:
        # 计算嵌套层数
        max_depth = 0
        current_depth = 0
        for char in js:
            if char == '{':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == '}':
                current_depth -= 1
        
        nesting_levels.append(max_depth)
        
        # 提取可能的字段名
        possible_keys = re.findall(r'"([^"]+)"\s*:', js)
        key_patterns.extend(possible_keys)
    
    print(f"   平均嵌套深度: {sum(nesting_levels) / len(nesting_levels):.1f} 层")
    print(f"   发现字段名: {list(set(key_patterns))[:10]}")
    
    # 字段频率统计
    if key_patterns:
        key_counter = Counter(key_patterns)
        common_keys = key_counter.most_common(5)
        print(f"   高频字段: {common_keys}")

def analyze_specific_json(js, name):
    """分析特定JSON加密块"""
    
    print(f"      🔬 结构分析 [{name}]:")
    
    # 整体统计
    total_len = len(js)
    binary_count = sum(1 for c in js if ord(c) > 127 or ord(c) < 32)
    printable_ratio = (total_len - binary_count) / total_len
    
    print(f"         可读比例: {printable_ratio:.3f}")
    
    # 分块检查
    chunk_size = max(10, len(js) // 4)
    for i in range(0, min(len(js), chunk_size * 4), chunk_size):
        chunk = js[i:i+chunk_size]
        readable = sum(1 for c in chunk if 32 <= ord(c) <= 126)
        readable_ratio = readable / len(chunk) if chunk else 0
        
        # 显示chunk特征
        if readable_ratio > 0.5:
            clean_chunk = ''.join(c if 32 <= ord(c) <= 126 else '?' for c in chunk)
            print(f"         [块{i//chunk_size+1}] 文本区: {clean_chunk[:30]}...")
        elif readable_ratio > 0.2:
            print(f"         [块{i//chunk_size+1}] 混合数据: {len(chunk)}字节")
        else:
            # 获取前几个字节的16进制
            hex_preview = ''.join(f'{ord(c):02x}' for c in chunk[:8])
            print(f"         [块{i//chunk_size+1}] 二进制: {hex_preview}...")

if __name__ == "__main__":
    analyze_encryption_patterns()