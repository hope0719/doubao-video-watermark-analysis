#!/usr/bin/env python3
"""
简化加密模式搜索 - 直接查找original_media_info相关加密数据
"""
import re

def simple_pattern_search():
    """直接搜索original_media_info相关加密数据"""
    
    print("🔍 直接搜索original_media_info加密数据\n")
    
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    
    try:
        with open(target_file, 'rb') as f:
            data = f.read()
        
        print(f"📊 文件大小: {len(data):,} 字节")
        
        # 转换为字符串
        content = data.decode('utf-8', errors='replace')
        
        # 直接搜索original相关
        patterns = [
            r'[Oo]riginal[^{]*?[Mm]edia[^{]*?[Ii]nfo',  # original media info 模式
            r'[Oo]riginal[\s\S]{0,200}?\{',            # original附近200字符有{
            r'\{[^}]*?[Oo]riginal[^}]*?\}',              # {...original...}  
            r'[\"\\\']original[\"\\\'][\s]*:[\s]*',     # \"original\": 形式
        ]
        
        found_count = 0
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
            
            if matches:
                print(f"🎯 模式匹配 ({pattern[:30]}...): {len(matches)} 个")
                found_count += len(matches)
                
                # 显示前3个
                for i, match in enumerate(matches[:3]):
                    # 清理和显示
                    clean_match = match.replace('\n', ' ').replace('\r', '')
                    print(f"   [{i+1}] {clean_match[:150]}")
                    
                    # 检查是否包含URL特征
                    if 'http' in clean_match.lower():
                        print(f"         💡 包含URL")
                    
                    if 'doubao' in clean_match.lower():
                        print(f"         💡 包含doubao")
                    
                    if '\ufffd' in match or re.search(r'[\x00-\x1f\x7f-\xff]{10,}', match):
                        print(f"         🔐 包含加密特征")
                
                print()
        
        if found_count == 0:
            print("❌ 未找到original相关模式")
            
            # 试试最简单的方法 - 找binary块
            print("\n🔬 改为找大规模二进制块...")
            
            # 找大规模的Unicode替换符聚集
            unicode_blocks = re.findall(r'(?:\ufffd|ï¿½){20,}', content)
            print(f"   Unicode替换符块: {len(unicode_blocks)} 个")
            
            # 找长二进制段
            binary_blocks = re.findall(r'[\x00-\x1f\x7f-\xff]{50,}', content)
            print(f"   二进制数据块: {len(binary_blocks)} 个")
            
            # 分析这些块的结构
            if unicode_blocks or binary_blocks:
                analyze_blocks(unicode_blocks[:5], binary_blocks[:5])
        
    except Exception as e:
        print(f"❌ 搜索失败: {e}")

def analyze_blocks(unicode_blocks, binary_blocks):
    """分析找到的块"""
    
    print(f"\n🔬 分析找到的二进制块特征:")
    
    all_blocks = unicode_blocks + binary_blocks
    
    if not all_blocks:
        return
    
    # 特征统计
    features = {
        'avg_length': 0,
        'max_length': 0,
        'entropy_levels': [],
        'text_ratios': []
    }
    
    for i, block in enumerate(all_blocks[:5]):
        length = len(block)
        features['max_length'] = max(features['max_length'], length)
        
        print(f"\n   块 {i+1} (长度: {length}):")
        
        # 计算可读文本比例
        if isinstance(block, str):
            readable = sum(1 for c in block if 32 <= ord(c) <= 126)
            text_ratio = readable / length if length > 0 else 0
            features['text_ratios'].append(text_ratio)
            
            print(f"      可读文本比例: {text_ratio:.3f}")
            
            # 显示hex预览
            try:
                hex_preview = ''.join(f'{ord(c):02x}' for c in block[:20])
                print(f"      十六进制预览: {hex_preview}")
            except:
                pass
            
            # 检查特殊模式
            if re.search(r'(?:[0-9a-f]{2}){10,}', block, re.IGNORECASE):
                print(f"      💡 包含16进制模式")
            
            if len(set(block)) < length * 0.3:  # 重复度高
                print(f"      💡 可能是压缩/加密数据")
        
        # 尝试简单解码
        if length > 20:
            try_decoding(block, f"block_{i}")
    
    if features['text_ratios']:
        features['avg_length'] = sum(len(b) for b in all_blocks) / len(all_blocks)
        avg_text_ratio = sum(features['text_ratios']) / len(features['text_ratios'])
        
        print(f"\n📊 总体统计:")
        print(f"   平均长度: {features['avg_length']:.1f}")
        print(f"   最大长度: {features['max_length']}")
        print(f"   平均文本比例: {avg_text_ratio:.3f}")
        
        if avg_text_ratio < 0.2:
            print(f"   🎯 很可能是加密数据")

def try_decoding(block, name):
    """尝试简单解码"""
    
    print(f"      🔓 尝试解码:")
    
    # 1. 尝试Base64
    try:
        import base64
        # 如果是字符串，尝试编码再解码
        if isinstance(block, str):
            sample = block[:50]
            if re.match(r'^[A-Za-z0-9+/]*$', sample):
                decoded = base64.b64decode(block + '==='[:-len(block) % 4])
                if len(decoded) > 0:
                    try:
                        text = decoded.decode('utf-8', errors='ignore')
                        if len(text.strip()) > 10:
                            print(f"         Base64解码: {text[:50]}...")
                    except:
                        pass
    except Exception as e:
        print("Base64解码失败")
    
    # 2. 简单的字节操作
    try:
        if isinstance(block, str):
            # 转换为字节操作
            bytes_data = block.encode('utf-8', errors='ignore')
            
            # 尝试简单的XOR
            if len(bytes_data) > 20:
                # 尝试XOR 0xAA
                xored = bytes(b ^ 0xAA for b in bytes_data[:50])
                if any(32 <= b <= 126 for b in xored):
                    text_part = ''.join(chr(b) for b in xored if 32 <= b <= 126)
                    if len(text_part) > 10:
                        print(f"         XOR 0xAA: {text_part[:30]}...")
                        
    except Exception as e:
        print("XOR解码失败")

if __name__ == "__main__":
    simple_pattern_search()