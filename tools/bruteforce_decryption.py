#!/usr/bin/env python3
"""
暴力破解original_media_info字段的加密密钥
基于已发现的XOR模式
"""
import re
from collections import Counter

def bruteforce_xor_keys():
    """暴力破解XOR加密密钥"""
    
    print("🔓 暴力破解XOR加密密钥\n")
    
    # 加载加密数据
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    
    try:
        with open(target_file, 'rb') as f:
            raw_bytes = f.read()
        
        print(f"📊 加载数据: {len(raw_bytes):,} 字节")
        
        # 1. 直接XOR 0x00-0xFF搜索 
        print(f"\n🚀 暴力尝试XOR密钥 0x00-0xFF...")
        
        best_results = []
        
        for key in range(256):
            print(f"\r   进度: {key}/255 ({key/255*100:.1f}%)", end="")
            
            # 对整个数据试解密
            decrypted = xor_decrypt_bytes(raw_bytes, key)
            
            # 评估结果
            score = evaluate_decryption(decrypted)
            
            if score > 0:
                best_results.append((key, score, decrypted[:200]))
        
        print("\n\n📊 暴力搜索完成！")
        
        # 显示最佳结果
        best_results.sort(key=lambda x: x[1], reverse=True)
        
        print(f"🎯 找到 {len(best_results)} 个有效解密结果")
        
        for i, (key, score, preview) in enumerate(best_results[:5]):
            print(f"\n   🏆 结果 {i+1} (密钥: 0x{key:02x}, 分数: {score:.2f}):")
            print(f"      结果预览: {preview[:100]}")
            
            # 检查是否包含媒体信息
            if has_media_keywords(preview):
                print(f"      💡 包含媒体信息关键词！")
                save_potential_result(decrypted, f"decrypt_key_{key:02x}")
                analyze_for_urls(decrypted)
        
        # 2. 尝试频率分析攻击
        print(f"\n🔍 频率分析攻击...")
        frequency_attack(raw_bytes)
        
        # 3. 模式匹配攻击
        print(f"\n🎯 模式匹配攻击...")
        pattern_attack(raw_bytes)
        
    except Exception as e:
        print(f"❌ 破解失败: {e}")

def xor_decrypt_bytes(data, key):
    """XOR解密字节数据"""
    
    try:
        return bytes(b ^ key for b in data)
    except Exception:
        return None

def evaluate_decryption(decrypted_bytes):
    """评估解密结果的质量"""
    
    if not decrypted_bytes or len(decrypted_bytes) < 100:
        return 0
    
    try:
            # 尝试解码为文本
        try:
            text = decrypted_bytes.decode('utf-8', errors='ignore')
        except Exception:
            # 如果解码失败，尝试作为str处理
            if isinstance(decrypted_bytes, str):
                text = decrypted_bytes
            else:
                return 0
        
        # 评分因子
        scores = {
            'length': 0,
            'readable_ratio': 0, 
            'structure_score': 0,
            'keyword_score': 0
        }
        
        # 1. 长度评分 (越长越好)
        if len(text) > 20000:
            scores['length'] = 1.0
        elif len(text) > 5000:
            scores['length'] = 0.5
            
        # 2. 可读字符比例
        total_chars = len(text)
        if total_chars > 0:
            readable_chars = sum(1 for c in text if 32 <= ord(c) <= 126 or c in '\n\r\t')
            scores['readable_ratio'] = readable_chars / total_chars
        
        # 3. 结构评分
        structure_patterns = [
            r'\{[^\}]*\}',      # JSON结构
            r'"[^"]*":',       # key: value
            r'https?://[^ ]+',  # URLs
            r'[a-zA-Z]:[a-zA-Z]' # 字段名模式
        ]
        
        for pattern in structure_patterns:
            matches = len(re.findall(pattern, text))
            scores['structure_score'] += matches * 0.1
        
        # 4. 关键词评分
        keywords = ['original', 'media', 'video', 'url', 'doubao', 'main']
        for keyword in keywords:
            count = text.lower().count(keyword)
            scores['keyword_score'] += count * 2.0
        
        # 总分（加权）
        total_score = (
            scores['length'] * 3 +
            scores['readable_ratio'] * 5 +
            scores['structure_score'] * 2 + 
            scores['keyword_score'] * 4
        )
        
        return total_score
        
    except Exception:
        return 0

def has_media_keywords(text):
    """检查是否包含媒体相关关键词"""
    
    keywords = ['original', 'media', 'video', 'url', 'doubao']
    text_lower = text.lower()
    
    count = 0
    for keyword in keywords:
        if keyword in text_lower:
            count += 1
    
    return count >= 2  # 至少包含2个关键词

def save_potential_result(data, prefix):
    """保存潜在结果"""
    
    try:
        filename = f"{prefix}_potential_decrypt.txt"
        with open(filename, 'wb') as f:
            f.write(data)
        print(f"      💾 已保存到 {filename}")
    except Exception as e:
        print(f"保存失败: {e}")

def analyze_for_urls(data):
    """分析数据中的URL"""
    
    try:
        text = data.decode('utf-8', errors='ignore')
        
        # 找URL
        urls = re.findall(r'https?://[^\s"\[\]{}]+', text)
        
        if urls:
            print(f"      🎯 发现 {len(urls)} 个URL:")
            for i, url in enumerate(urls[:3]):
                print(f"         [{i+1}] {url[:100]}")
                
                # 检查是否豆包视频
                if 'doubao' in url:
                    if 'unwatermark' in url.lower():
                        print(f"            🎉 无水印URL！")
                    elif 'watermark' not in url.lower():
                        print(f"            💭 可能无水印")
    except Exception:
        pass

def frequency_attack(data):
    """频率分析攻击"""
    
    print(f"   分析字节频率...")
    
    # 统计字节频率
    counter = Counter(data)
    most_common = counter.most_common(10)
    
    print(f"   最高频率字节:")
    for byte_val, count in most_common:
        if count > 1000:  # 显著高频
            print(f"      0x{byte_val:02x}: {count} 次")
            
            # 猜测：如果最高频率字节是英文空格(0x20)，可能是密钥
            # 在XOR加密中，最频繁的明文字符是空格
            if 0xef == byte_val or 0xbf == byte_val:  # Unicode替换符
                potential_key = byte_val ^ 0x20  # 假设明文的空格
                print(f"         💡 推测XOR密钥: 0x{potential_key:02x}")
        
    # 尝试基于频率的假设
    test_keys = []
    for byte_val, count in most_common[:3]:
        if count > 5000:
            # 假设这些高频字节对应常见字符
            potential_key = byte_val ^ 0x20  # 空格
            test_keys.append(potential_key)
            
            potential_key = byte_val ^ 0x65  # 'e'
            test_keys.append(potential_key)
    
    # 测试这些推测的密钥
    test_keys = list(set(test_keys))
    print(f"   基于频率推测 {len(test_keys)} 个密钥，立即测试...")
    
    for key in test_keys:
        decrypted = xor_decrypt_bytes(data, key)
        if evaluate_decryption(decrypted) > 10:
            print(f"      🎯 推测密钥有效: 0x{key:02x}")

def pattern_attack(data):  
    """模式匹配攻击"""
    
    print(f"   搜索重复模式...")
    
    # 转换为文本找模式
    try:
        text = data.decode('utf-8', errors='replace')
        
        # 找长重复序列
        patterns = find_repeating_patterns(text, min_length=4, min_count=3)
        
        print(f"   找到 {len(patterns)} 个重复模式:")
        
        for pattern_str, count in patterns[:5]:
            print(f"      '{pattern_str}' × {count} 次")
            
            # 特别关注Unicode替换符模式
            if '\ufffd' in pattern_str or 'ï¿½' in pattern_str:
                print(f"         💡 加密特征模式")
                
                # 如果是加密模式，找到可能就是original字段加密版本
                if len(pattern_str) > 6:
                    print(f"         🎯 可能是original字段加密形式！")
    
    except Exception as e:
        print(f"   模式分析失败: {e}")

def find_repeating_patterns(text, min_length=3, min_count=2):
    """找重复模式"""
    
    patterns = {}
    text_len = len(text)
    
    # 短模式检查
    for length in range(min_length, min(10, text_len // 2)):
        for i in range(0, text_len - length):
            pattern = text[i:i+length]
            
            if text.count(pattern) >= min_count:
                patterns[pattern] = text.count(pattern)
    
    # 转换为列表并排序
    pattern_list = [(p, c) for p, c in patterns.items()]
    pattern_list.sort(key=lambda x: x[1], reverse=True)
    
    return pattern_list

if __name__ == "__main__":
    bruteforce_xor_keys()