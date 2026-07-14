#!/usr/bin/env python3
"""
致命LAYER3攻击 - 解码ASCII化的二进制数据
"""
import re

def layer3_super_attack():
    """超级攻击"""
    
    print("" + "=" * 80)
    print("💥💥💥 LAYER3 终极毁灭攻击 💥💥💥")
    print("目标：将ASCII化的二进制解码回正常文本")
    print("=" * 80)
    
    # 加载到第二步的结果
    with open("LAYER2_URL解码_RESULT.txt", 'r', errors='ignore') as f:
        text_data = f.read()
    
    print(f"📊 源数据: {len(text_data):,} 字符")
    
    # 分析特殊pattern
    print(f"\n🔍 分析ASCII化模式的特征:")
    
    # 1. 查找重复模式
    pattern_freq = {}
    
    # 检查短格式
    for length in range(3, 8):
        for i in range(len(text_data) - length):
            pattern = text_data[i:i+length]
            if pattern not in pattern_freq:
                pattern_freq[pattern] = 1
            else:
                pattern_freq[pattern] += 1
    
    # 显示高频模式
    high_freq_patterns = sorted(pattern_freq.items(), key=lambda x: x[1], reverse=True)[:10]
    
    print(f"   高频短模式:")
    for pattern, count in high_freq_patterns:
        if count > 100:  # 仅显示高频
            percentage = count / len(text_data) * 100
            print(f"      '{pattern}': {count:,} ({percentage:.2f}%)")
    
    # 2. 模式分析猜测编码方式
    print(f"\n💡 模式分析猜测:")
    
    # 检查是否有某种base64破损
    if re.search(r'[A-Za-z0-9+/]{5,}', text_data):
        base64_like = re.findall(r'[A-Za-z0-9+/]{8,}', text_data)
        print(f"   可能Base64损伤，找到 {len(base64_like)} 个长Base64字串")
        
        if base64_like:
            best_base64 = max(base64_like, key=len)
            print(f"   最佳Base64候选: {best_base64[:100]}")
    
    # 3. 启动**最终毁灭攻击**
    print(f"\n" + "=" * 80)
    print(f"⚡⚡⚡ 启动终极毁灭攻击 ⚡⚡⚡")
    print(f"=" * 80)
    
    # 尝试各种可能的编码转换修复
    attack_methods = [
        ('原始Base64提取', extract_base64),
        ('字符重映射', char_remapping),
        ('模式替换修复', pattern_fix),
        ('二进制重建', binary_rebuild)
    ]
    
    best_result = None
    best_score = 0
    best_method = ""
    
    for method_name, method_func in attack_methods:
        print(f"\n🔥 {method_name}:")
        
        try:
            result = method_func(text_data)
            
            if result:
                score = evaluate_final_result(result)
                print(f"   结果长度: {len(result):,}, 评分: {score:.1f}")
                
                if score > best_score and score > 1000:  # 高门槛
                    best_score = score
                    best_result = result
                    best_method = method_name
                    print(f"   🎯 新记录！")
                    
                    # 立即保存高score结果
                    save_good_result(result, method_name, score)
                    
                    # 分析是否有媒体信息
                    analyze_for_media_info(result)
        
        except Exception as e:
            print(f"   ❌ 攻击失败: {e}")
    
    # 显示最终结果
    print(f"\n" + "=" * 80)
    print(f"🏆 终极攻击结果:")
    print(f"   最佳方法: {best_method}")
    print(f"   最高分: {best_score:.1f}")
    
    if best_result:
        print(f"   🎯 成功！")
        final_analysis(best_result)
    else:
        print(f"   💡 需要人工分析高频模式")
        print(f"   建议：观察最频繁的pattern并手动修复")
    
    print(f"=" * 80)

def extract_base64(text):
    """提取Base64"""
    pattern = r'[A-Za-z0-9+/]{8,}'
    matches = re.findall(pattern, text)
    
    if matches:
        # 找到最长和最短间隔的
        longest = max(matches, key=len)
        
        print(f"      最长Base64字串: {len(longest)} 字符")
        print(f"      预览: {longest[:80]}")
        
        # 尝试解码
        import base64
        try:
            # 清洗并补齐
            cleaned = ''.join(c for c in longest if c.isalnum() or c in '+/')
            padding = 4 - (len(cleaned) % 4)
            if padding != 4:
                cleaned += '=' * padding
            
            decoded = base64.b64decode(cleaned)
            print(f"      ✅ Base64解码: {len(decoded)} 字节")
            
            # 尝试文本
            try:
                text_result = decoded.decode('utf-8', errors='ignore')
                if len(text_result) > 100:
                    return text_result
            except:
                pass
            
            return decoded
        
        except Exception as e:
            print(f"      Base64解码失败: {e}")
    
    return None

def char_remapping(text):
    """字符重新映射"""
    
    print(f"      分析字符频率...")
    
    from collections import Counter
    char_count = Counter(text)
    
    # 显示top字符
    print(f"      最高频率字符:")
    for char, count in char_count.most_common(10):
        printable = repr(char) if len(char) == 1 else char
        print(f"        {printable}: {count:,}")
    
    # 假设高频率特殊字符是编码错误
    # 尝试简单替换回正常ASCII
    special_map = {
        '廡': '', 'ﻡ': '', '仡': '', '񻡳': '', 'ް': '', 
        'B': 'A', 'C': 'B', '>': 'C', '<': 'D', 
        '.': '',
        '�': ''
    }
    
    cleaned = text
    for old, new in special_map.items():
        cleaned = cleaned.replace(old, new)
    
    print(f"      应用字符映射后: {len(cleaned)} 字符")
    
    # 如果仍然长
    if len(cleaned) > 100 and any(c.isalnum() for c in cleaned[:100]):
        print(f"      ✅ 字符重映射有意义结果")
        return cleaned
    
    return None

def pattern_fix(text):
    """基于pattern的修复"""
    
    print(f"      尝试pattern base修复...")
    
    # 查找重复的pattern如 B.C>C<
    pattern = r'(.{3,6}?)\1{3,}'  # 重复4次以上
    matches = re.findall(pattern, text)
    
    if matches:
        print(f"      找到 {len(matches)} 重复模式")
        for match in matches[:3]:
            print(f"        模式: {match[:20]}")
    
    # 简化数据
    # 很多这类模式是二进制数据的ASCII化
    lines = text.split('\n')
    
    print(f"      总行数: {len(lines)}")
    
    # 如果有多行，处理每行
    if len(lines) > 1:
        processed_lines = []
        for line in lines:
            # 去除特殊Unicode
            clean_line = re.sub(r'[^\x00-\x7F]', '', line)  # 只留下ASCII
            if len(clean_line) > 50:
                processed_lines.append(clean_line)
        
        if processed_lines:
            result = '\n'.join(processed_lines)
            print(f"      清理后的文本: {len(result)} 字符")
            return result
    
    return None

def binary_rebuild(text):
    """重建二进制再转解码"""
    
    print(f"      尝试二进制重建...")
    
    # 观察到有大量ASCII 127+字符？
    # 将文本转为bytes
    try:
        # 转换为字节序列
        byte_data = text.encode('utf-8', errors='replace')
        
        # 移除高位字节？
        cleaned_bytes = bytes(b for b in byte_data if b < 128)
        
        if len(cleaned_bytes) > len(text) * 0.5:  # 保留过半
            print(f"      重建ASCII数据: {len(cleaned_bytes)} 字节")
            
            # 尝试解码
            ascii_result = cleaned_bytes.decode('ascii', errors='ignore')
            if len(ascii_result) > 100:
                print(f"      ✅ ASCII重建成功")
                return ascii_result
                
    except Exception as e:
        print(f"      二进制重建失败: {e}")
    
    return None

def evaluate_final_result(result):
    """评估最终结果"""
    
    try:
        text = str(result)
        length = len(text)
        
        if length < 100:
            return 0
        
        score = 0
        
        # 可读性
        alpha_count = sum(c.isalpha() for c in text)
        digit_count = sum(c.isdigit() for c in text)
        alnum_ratio = (alpha_count + digit_count) / length if length > 0 else 0
        
        score += alnum_ratio * 1000
        
        # 关键词
        keywords = ['original', 'media', 'video', 'url', 'doubao']
        text_lower = text.lower()
        
        for keyword in keywords:
            count = text_lower.count(keyword)
            score += count * 10000  # 大量加分
        
        # 结构加分
        if '{' in text and '}' in text:
            score += 5000
        
        import re
        url_count = len(re.findall(r'https?://', text))
        score += url_count * 5000
        
        # 长度奖励
        if length > 10000:
            score += 1000
        
        return score
        
    except Exception:
        return 0

def save_good_result(result, method, score):
    """保存好的结果"""
    
    try:
        filename = f"GOOD_RESULT_{method.replace(' ', '_')}_{int(score)}.txt"
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(str(result))
        print(f"      💾 高评分结果已保存到 {filename}")
    except Exception as e:
        print(f"      保存失败: {e}")

def analyze_for_media_info(result):
    """分析媒体信息"""
    
    print(f"      🔍 查找媒体信息...")
    
    text = str(result).lower()
    
    found = False
    
    if 'original' in text:
        print(f"      🎯 找到'original'关键字")
        found = True
    
    if 'media' in text:
        print(f"      🎯 找到'media'关键字") 
        found = True
    
    if 'doubao' in text:
        print(f"      🎯 找到'doubao'关键字")
        found = True
    
    import re
    urls = re.findall(r'https?://', str(result))
    if urls:
        print(f"      🎯 找到 {len(urls)} 个URL")
        found = True
        
        # 额外检查无水印
        for url in urls:
            if 'doubao' in url.lower():
                if 'unwatermark' in url.lower():
                    print(f"      🎉🎉🎉 无水印URL确认！")
                elif 'watermark' not in url.lower():
                    print(f"      💭 可能无水印URL")
    
    if found:
        print(f"      🎯 发现重要媒体信息！")

def final_analysis(result):
    """最终分析"""
    
    print(f"\n🔬 最终结果深度分析...")
    
    # 保存最终成功结果
    try:
        with open("FINAL_SUCCESS_RESULT.txt", 'w', encoding='utf-8') as f:
            f.write(str(result))
        print(f"💾 最终结果已保存到 FINAL_SUCCESS_RESULT.txt")
    except:
        pass

def main():
    layer3_super_attack()

if __name__ == "__main__":
    main()