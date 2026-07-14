#!/usr/bin/env python3
"""
关键Key-Value挖掘器 - 分析169个字段寻找original字段和AES特征
"""
import re
import binascii
from collections import Counter

def mine_key_value_patterns():
    """深度挖掘key-value字段"""
    
    print("💥💥💥 Key-Value矿场挖掘 💥💥💥")
    print("目标: 从169个字段中寻找original字段的可能重命名")
    
    # 加载20KB明文数据
    with open('CLEAN_EXTRACTED_DATA.txt', 'r') as f:
        text = f.read()
    
    print(f"📊 分析20,025字符数据")
    
    # 提取所有key-value模式
    kv_patterns = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*[^\s\n,;]{5,}', text)
    
    print(f"🎯 提取到 {len(kv_patterns)} 个key-value结构")
    
    if not kv_patterns:
        print(f"❌ 未找到key-value结构")
        return
    
    # 分析key和value的模式
    keys = []
    values = []
    
    for kv in kv_patterns:
        if '=' in kv:
            key, value = kv.split('=', 1)
        elif ':' in kv: 
            key, value = kv.split(':', 1)
        else:
            continue
            
        keys.append(key.strip())
        values.append(value.strip())
    
    print(f"\n🔍 Key和Value分析:")
    print(f"   Keys: {len(keys)} 个")
    print(f"   Values: {len(values)} 个")
    
    # 保存所有key-value对
    with open('ALL_KEY_VALUE_PAIRS.txt', 'w') as f:
        f.write(f"找到 {len(kv_patterns)} 个key-value对\n\n")
        for kv in kv_patterns:
            f.write(kv + "\n")
    
    print(f"💾 已保存到 ALL_KEY_VALUE_PAIRS.txt")
    
    # 分析key的模式
    analyze_key_patterns(keys)
    
    # 分析value的模式  
    analyze_value_patterns(values)
    
    # 寻找可能的original字段重命名
    search_original_candidates(keys, values)
    
    # 寻找AES加密特征
    search_aes_patterns(text, values)

def analyze_key_patterns(keys):
    """分析key的模式"""
    
    print(f"\n🔍 Key模式分析:")
    
    # 长度分布
    key_lengths = [len(key) for key in keys]
    length_counter = Counter(key_lengths)
    
    print(f"   Key长度分布:")
    for length, count in sorted(length_counter.items()):
        print(f"      {length}字符: {count} 个")
    
    # 关键词搜索
    original_like_keys = []
    media_like_keys = []
    url_like_keys = [] 
    
    for key in keys:
        key_lower = key.lower()
        
        # original相关
        if any(word in key_lower for word in ['orig', 'ori', 'org', 'og', 'main', 'primary', 'source']):
            original_like_keys.append(key)
            
        # media相关
        elif any(word in key_lower for word in ['media', 'video', 'vid', 'file', 'data', 'info']):
            media_like_keys.append(key)
            
        # url相关
        elif any(word in key_lower for word in ['url', 'link', 'src', 'path']):
            url_like_keys.append(key)
    
    if original_like_keys:
        print(f"   🎯 Original类似keys ({len(original_like_keys)}):")
        for key in original_like_keys:
            print(f"      {key}")
    
    if media_like_keys:
        print(f"   🎯 Media类似keys ({len(media_like_keys)}):")
        for key in media_like_keys:
            print(f"      {key}")
            
    if url_like_keys:
        print(f"   🎯 URL类似keys ({len(url_like_keys)}):")
        for key in url_like_keys:
            print(f"      {key}")
    
    # 异常key搜索 (长且乱码风格)
    obfuscated_keys = [key for key in keys if len(key) > 10 and not key.isalnum()]
    if obfuscated_keys:
        print(f"   🎯 可能Obfuscated keys ({len(obfuscated_keys)}):")
        for key in obfuscated_keys[:10]:
            print(f"      {key}")

def analyze_value_patterns(values):
    """分析value的模式"""
    
    print(f"\n🔍 Value模式分析:")
    
    # 长度分布
    value_lengths = [len(value) for value in values]
    length_counter = Counter(value_lengths)
    
    print(f"   Value长度分布:")
    for length, count in sorted(length_counter.items()):
        if count > 2:  # 只显示出现多次的
            print(f"      {length}字符: {count} 个")
    
    # Base64特征
    base64_like = []
    hex_like = []
    url_like_2 = []
    json_like = []
    
    for value in values:
        # Base64检查
        if re.match(r'^[A-Za-z0-9+/=]{10,}$', value) and len(value) % 4 == 0:
            base64_like.append(value)
        
        # Hex检查
        elif re.match(r'^[0-9a-fA-F]{10,}$', value):
            hex_like.append(value)
        
        # URL检查
        elif 'http' in value or '/' in value:
            url_like_2.append(value)
        
        # JSON结构
        elif ('{' in value and '}' in value) or ('[' in value and ']' in value):
            json_like.append(value)
    
    if base64_like:
        print(f"   🎯 Base64-like values ({len(base64_like)}):")
        for val in base64_like[:5]:
            print(f"      {val[:50]}")
    
    if hex_like:
        print(f"   🎯 Hex-like values ({len(hex_like)}):")
        for val in hex_like[:5]:
            print(f"      {val[:50]}")
            
    if url_like_2:
        print(f"   🎯 URL-like values ({len(url_like_2)}):")
        for val in url_like_2[:5]:
            print(f"      {val[:50]}")
    
    if json_like:
        print(f"   🎯 JSON-like values ({len(json_like)}):")
        for val in json_like[:5]:
            print(f"      {val[:50]}")

def search_original_candidates(keys, values):
    """搜索original字段的可能重命名"""
    
    print(f"\n🔍 Original字段重命名搜索:")
    
    # 基于长度的候选 (original字段通常较长)
    long_values = [val for val in values if len(val) > 50]
    print(f"   {len(long_values)} 个长Value (>50字符):")
    
    candidate_pairs = []
    for i, kv in enumerate(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*[^\s\n,;]{50,}', 
                                    open('CLEAN_EXTRACTED_DATA.txt').read())):
        if i < 10:  # 只取前10个长的
            print(f"      [{i+1}] {kv}")
            candidate_pairs.append(kv)
    
    # 保存候选字段
    if candidate_pairs:
        with open('ORIGINAL_CANDIDATE_PAIRS.txt', 'w') as f:
            f.write(f"Original字段候选 ({len(candidate_pairs)} 个长字段)\n\n")
            for pair in candidate_pairs:
                f.write(pair + "\n\n")
        
        print(f"   💾 候选字段已保存")
    
    # 搜索doubao相关的值
    doubao_values = [val for val in values if 'doubao' in val.lower()]
    if doubao_values:
        print(f"   🎯 Doubao相关Value ({len(doubao_values)}):")
        for val in doubao_values:
            print(f"      {val[:100]}")

def search_aes_patterns(text, values):
    """搜索AES加密特征"""
    
    print(f"\n🔍 AES加密特征搜索:")
    
    # AES常见特征
    aes_patterns = []
    
    for value in values:
        # 1. Base64编码的AES密文 (通常较长)
        if len(value) > 32 and re.match(r'^[A-Za-z0-9+/=]+$', value):
            aes_patterns.append(('Base64_AES', value))
        
        # 2. Hex编码的AES密文 (32/48/64字符)
        elif re.match(r'^[0-9a-fA-F]{32,}$', value):
            if len(value) in [32, 48, 64]:  # AES块大小
                aes_patterns.append(('Hex_AES', value))
        
        # 3. 长随机字符串
        elif len(value) > 40 and len(set(value)) > 20:  # 高熵
            aes_patterns.append(('High_Entropy', value))
    
    if aes_patterns:
        print(f"   🎯 找到 {len(aes_patterns)} 个AES特征值:")
        
        for i, (pattern_type, value) in enumerate(aes_patterns[:10]):
            print(f"      [{i+1}] {pattern_type}: {value[:60]}...")
            
            # 尝试Base64解码
            if 'Base64' in pattern_type:
                try:
                    import base64
                    decoded = base64.b64decode(value, validate=True)
                    print(f"          ✅ Base64解码后: {len(decoded)} 字节")
                    
                    # 检查是否为AES密文 (16/24/32字节倍数)
                    if len(decoded) % 16 == 0:
                        print(f"          🎯 符合AES块大小!")
                except:
                    pass
    
    else:
        print(f"   ❌ 未找到明确AES特征")
    
    # 寻找AES相关key名称
    aes_keys = [key for key in re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', text) 
                if any(word in key.lower() for word in ['aes', 'encrypt', 'cipher', 'key', 'iv', 'crypto', 'secret'])]
    
    if aes_keys:
        print(f"   🎯 AES相关Key名 ({len(aes_keys)}):")
        for key in aes_keys:
            print(f"      {key}")

if __name__ == "__main__":
    mine_key_value_patterns()
    
    print(f"\n🎯 Key-Value挖掘完成！")
    print(f"💡 检查生成的txt文件查看详细分析")