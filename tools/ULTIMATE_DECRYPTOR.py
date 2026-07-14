#!/usr/bin/env python3
"""
终极解密工具 - 攻克original_media_info加密
"""
import re
from collections import Counter

def ultimate_attack():
    """最终攻击：暴力隙解original_media_info"""
    
    print("=" * 80)
    print("🚀🚀🚀 终极解密攻击开始 🚀🚀🚀")
    print("目标：破解豆包original_media_info加密字段")
    print("=" * 80)
    
    # 加载加密数据包
    target_file = "../decoded_content_URL解码_20260706_102428.txt"
    
    with open(target_file, 'rb') as f:
        encrypted_data = f.read()
    
    print(f"📦 加载加密数据: {len(encrypted_data):,} 字节")
    
    # 攻击力配置
    attack_modes = [
        {'name': 'XOR全范围暴力', 'function': attack_xor_bruteforce},
        {'name': '频率分析攻击', 'function': attack_frequency},
        {'name': '模式Hybrid攻击', 'function': attack_pattern}
    ]
    
    best_result = None
    best_score = 0
    best_method = ""
    
    for mode in attack_modes:
        print(f"\n🔥 启动攻击模式: {mode['name']}")
        
        try:
            result, score = mode['function'](encrypted_data)
            
            if score > best_score:
                best_score = score
                best_result = result
                best_method = mode['name']
                
                print(f"   🎯 新纪录！分数: {score:.1f}")
                
        except Exception as e:
            print(f"   ❌ 攻击模式失败: {e}")
    
    # 最终结果
    print(f"\n" + "=" * 80)
    print(f"🏆 最终攻击结果 - 方法: {best_method}")
    print(f"   最高分数: {best_score:.1f}")
    print("=" * 80)
    
    if best_result:
        # 深度分析最佳结果
        ultimate_analysis(best_result, best_method)
    else:
        print(f"❌ 攻击失败，需要更高级策略")

def attack_xor_bruteforce(data):
    """XOR全范围暴力攻击"""
    
    print(f"   🔍 XOR密钥暴力搜索 0x00-0xFF...")
    
    best_score = 0
    best_result = None
    best_key = None
    
    for key in range(256):  # 0x00 到 0xFF
        # XOR解密
        decrypted = bytes(b ^ key for b in data)
        
        # 评分
        score = score_decryption(decrypted)
        
        if score > best_score:
            best_score = score
            best_result = decrypted
            best_key = key
            
            # 显示进度
            print(f"\r   密钥: 0x{best_key:02x} 分数: {best_score:.1f}", end="", flush=True)
    
    print(f"\n   ✅ XOR攻击完成，最佳密钥: 0x{best_key:02x}")
    
    if best_result:
        # 保存XOR结果
        filename = f"XOR_DECRYPT_KEY_{best_key:02x}.txt"
        save_result(best_result, filename)
        print(f"   💾 已保存到 {filename}")
    
    return best_result, best_score

def attack_frequency(data):
    """频率分析攻击"""
    
    print(f"   📊 频率分析攻击中...")
    
    # 统计字节分布
    counter = Counter(data)
    total_bytes = len(data)
    
    print(f"   总字节数: {total_bytes:,}")
    print(f"   唯一字节数: {len(counter)}")
    
    # 查找最高频率字节
    most_common = counter.most_common(10)
    
    print(f"   高频字节:")
    for byte_val, count in most_common:
        freq = count / total_bytes * 100
        print(f"      0x{byte_val:02x}: {count:,} ({freq:.2f}%)")
    
    # 假设最频繁字节对应英文空格(0x20)或'E'(0x65)
    guess_keys = []
    for byte_val, _ in most_common[:3]:
        guess_keys.append(byte_val ^ 0x20)  # 假设对应空格
        guess_keys.append(byte_val ^ 0x65)  # 假设对应'E'
    
    guess_keys = list(set(guess_keys))  # 去重
    
    print(f"   推测 {len(guess_keys)} 个候选密钥")
    
    # 测试推测密钥
    best_score = 0
    best_result = None
    
    for key in guess_keys:
        decrypted = bytes(b ^ key for b in data)
        score = score_decryption(decrypted)
        
        if score > best_score:
            best_score = score
            best_result = decrypted
    
    if best_result:
        filename = f"FREQ_ANALYSIS_DECRYPT.txt"
        save_result(best_result, filename)
        print(f"   💾 频率分析结果已保存到 {filename}")
    
    return best_result, best_score

def attack_pattern(data):
    """模式混合攻击"""
    
    print(f"   🎯 模式混合攻击中...")
    
    # 聊天数据特征
    try:
        text_content = data.decode('utf-8', errors='replace')
        
        # 查找重复模式
        patterns = find_patterns(text_content)
        
        if patterns:
            print(f"   发现 {len(patterns)} 个重复模式:")
            
            for pattern, count in patterns[:5]:
                print(f"      '{pattern[:20]}' × {count} 次")
                
                # 长短语最可能是字段名加密
                if len(pattern) > 6 and pattern.count('•') > 2:
                    print(f"         🎯 可能是字段名加密！")
        
        # 查找大规模Unicode替换
        unicode_blocks = text_content.count('\ufffd')
        print(f"   Unicode替换符块: {unicode_blocks:,} 个")
        
        # 假设Unicode已无法修复，尝试直接频率分析
        return attack_frequency(data)
        
    except Exception as e:
        print(f"   高频分析备选方案...")
        return attack_frequency(data)

def score_decryption(data):
    """评分解密结果"""
    
    try:
        # 尝试解码为文本
        if isinstance(data, bytes):
            text = data.decode('utf-8', errors='ignore')
        else:
            text = str(data)
        
        score = 0
        text_len = len(text)
        
        if text_len < 50:
            return 0
            
        # 1. 可读字符评分
        readable_chars = sum(1 for c in text if 32 <= ord(c) <= 126 or c in '\n\r\t. ')
        readability = readable_chars / text_len
        score += readability * 1000
        
        # 2. 媒体字段关键词
        keywords = [
            'original', 'original_media_info', 
            'media_info', 'main_url', 'video_url',
            'doubao', 'video', 'url', 'unwatermark',
            'no_watermark'
        ]
        
        text_lower = text.lower()
        for keyword in keywords:
            matches = text_lower.count(keyword)
            score += matches * 100
        
        # 3. 结构评分
        structures = [
            (r'\{[^\}]*?"', 'JSON字段'),
            (r'"[^"]*":', 'JSON键值'),
            (r'https?://[^ ]+', 'URLs'),
            (r'[a-zA-Z]+[a-zA-Z0-9_]*', '标识符')
        ]
        
        for pattern, name in structures:
            matches = len(re.findall(pattern, text))
            score += matches * 10
        
        # 4. 整体质量
        if readability > 0.6:
            score += 200  # 高可读性加分
            
        if 10000 < text_len < 50000:
            score += 100  # 长度适中加分
        
        return score
        
    except Exception:
        return 0

def save_result(data, filename):
    """保存结果"""
    
    try:
        with open(filename, 'wb') as f:
            if isinstance(data, bytes):
                f.write(data)
            else:
                f.write(str(data).encode('utf-8', errors='ignore'))
    except Exception as e:
        print(f"保存失败: {e}")

def find_patterns(text, min_len=4, min_count=2):
    """查找重复模式"""
    
    patterns = {}
    text_len = len(text)
    
    for length in range(min_len, 20):
        for i in range(0, text_len - length):
            pattern = text[i:i+length]
            count = text.count(pattern)
            if count >= min_count:
                patterns[pattern] = count
    
    # 转换为排序列表
    pattern_list = [(p, c) for p, c in patterns.items()]
    pattern_list.sort(key=lambda x: x[1], reverse=True)
    
    return pattern_list

def ultimate_analysis(result, method):
    """最终深度分析"""
    
    print(f"\n🔬 深度分析解密结果 [{method}]...")
    
    try:
        if isinstance(result, bytes):
            text = result.decode('utf-8', errors='ignore')
        else:
            text = str(result)
        
        print(f"   文本长度: {len(text):,} 字符")
        
        # 1. 找original字段
        print(f"\n🎯 查找original字段:")
        
        original_patterns = [
            r'"?original"?\s*:?[^"<\n]{0,300}',
            r'original_media[^\n<]{0,200}',
            r'[Oo]riginal[^}]*?\}',
            r'[Oo]riginal[^\n"]*?"'
        ]
        
        found_originals = []
        for pattern in original_patterns:
            matches = re.findall(pattern, text, re.DOTALL)
            if matches:
                found_originals.extend(matches)
        
        if found_originals:
            print(f"   🔍 找到 {len(found_originals)} 个original相关片段:")
            
            # 排序并显示最佳候选
            unique_matches = list(set(found_originals))
            unique_matches.sort(key=lambda x: len(x), reverse=True)
            
            for i, match in enumerate(unique_matches[:5]):
                clean_match = match.replace('\n', ' ').replace('\r', '')
                print(f"      [{i+1}] {clean_match[:150]}")
            
            # 保存original相关
            with open("ORIGINAL_FIELD_CANDIDATES.txt", 'w', encoding='utf-8') as f:
                f.write(f"\n=== 发现original字段 [{len(unique_matches)}] ===\n\n")
                for match in unique_matches:
                    f.write(match + "\n\n")
            print(f"   💾 original字段已保存到 ORIGINAL_FIELD_CANDIDATES.txt")
        
        else:
            print(f"   ❌ 未找到明显的original字段")
        
        # 2. 找URL
        print(f"\n🎯 查找URL地址:")
        
        urls = re.findall(r'https?://[^\s"\[\]{}]+', text)
        
        if urls:
            print(f"   🔍 找到 {len(urls)} 个URL:")
            
            # 分类
            doubao_urls = [url for url in urls if 'doubao' in url.lower()]
            video_urls = [url for url in urls if 'video' in url.lower() or '.mp4' in url.lower()]
            other_urls = [url for url in urls if url not in doubao_urls and url not in video_urls]
            
            # 显示豆包URL
            if doubao_urls:
                print(f"   🎯 豆包URL ({len(doubao_urls)}):")
                for i, url in enumerate(doubao_urls[:3]):
                    print(f"      🔗 [{i+1}] {url[:80]}")
                    
                    # 水印分析
                    lower_url = url.lower()
                    if 'unwatermark' in lower_url or 'original' in lower_url:
                        print(f"         🎉🎉🎉 无水印确认！")
                        
                        # 保存无水印URL
                        with open("UNWATERMARKED_FOUND.txt", 'a') as f:
                            f.write(f"🎉 无水印URL: {url}\n")
                        
                    elif 'watermark' in lower_url:
                        print(f"         ❌ 带水印")
                    else:
                        print(f"         💭 需要进一步分析")
            
            if video_urls:
                print(f"   🎥 视频URL ({len(video_urls)}):")
                for url in video_urls[:3]:
                    print(f"      📺 {url[:80]}")
            
            if other_urls:  
                print(f"   📎 其他URL ({len(other_urls)})")
                for url in other_urls[:3]:
                    print(f"      🔗 {url[:80]}")
            
            # 保存URL列表
            with open("ALL_FOUND_URLs.txt", 'w', encoding='utf-8') as f:
                f.write(f"\n=== 发现的所有URL [{len(urls)}] ===\n\n")
                for url in urls:
                    f.write(url + "\n")
            print(f"   💾 所有URL已保存到 ALL_FOUND_URLs.txt")
        
        else:
            print(f"   ❌ 未找到URL地址")
        
        # 3. 分析JSON结构
        print(f"\n🎯 分析JSON结构:")
        
        json_structures = re.findall(r'\{[^{}]*?\}', text)
        
        if json_structures:
            print(f"   🔍 找到 {len(json_structures)} 个JSON结构:")
            
            media_jsons = []
            for js in json_structures:
                if any(keyword in js.lower() for keyword in ['original', 'media', 'video', 'url']):
                    media_jsons.append(js)
            
            if media_jsons:
                print(f"   💡 {len(media_jsons)} 个可能与媒体相关的JSON:")
                for i, js in enumerate(media_jsons[:3]):
                    clean_js = js.replace('\n', ' ').replace('\r', '')
                    print(f"      [{i+1}] {clean_js[:150]}")
        
        else:
            print(f"   ❌ 未找到JSON结构")
        
        # 4. 最终结论
        print(f"\n🎯 攻击结论:")
        print(f"   {'✅' if found_originals or urls else '❌'} 是否找到目标内容")
        
        if found_originals or urls:
            print(f"   🎯 成功！发现 {len(found_originals)} 个original字段候选")
            print(f"   🎯 发现 {len(urls)} 个URL")
            
            if any('doubao' in url.lower() for url in urls):
                doubao_count = sum('doubao' in url.lower() for url in urls)
                print(f"   🎉 找到 {doubao_count} 个豆包URL！")
        
        else:
            print(f"   ❌ 攻击未达预期，需要调整策略")
            print(f"   💡 可能原因: 需要多层解密")
    
    except Exception as e:
        print(f"❌ 分析失败: {e}")

def main():
    """主入口"""
    ultimate_attack()
    
    print(f"\n🎉 终极攻击完成！")
    print(f"💡 请查看生成的文件了解详细结果")
    print(f"🎯 如有任何发现，这就是突破性进展！")

if __name__ == "__main__":
    main()