#!/usr/bin/env python3
"""
最终毁灭者 - 将序列化的字节数组还原
观察pattern: ABCBD 是连续字节值（65,66,67,66,68）的stringified版本！
"""
import re
import struct

def final_destruction():
    """终极毁灭模式"""
    
    print("" + "=" * 80)
    print("💥💥💥💥 LAYER4 最终STRIKE 💥💥💥💥")
    print("发现：ABCBD 模式是字节的stringified版本")
    print("=" * 80)
    
    # 加载结果
    with open("GOOD_RESULT_字符重映射_1967.txt", 'r', errors='ignore') as f:
        text_data = f.read()
    
    print(f"📊 数据长度: {len(text_data):,} 字符")
    print(f"🔍 确认pattern:")
    
    # 统计连续字母序列
    letter_sequences = re.findall(r'[A-Za-z]{3,}', text_data)
    print(f"   找到 {len(letter_sequences)} 个连续字母序列")
    
    if letter_sequences:
        # 显示最长的一段
        longest = max(letter_sequences, key=len)
        print(f"   最长序列 ({len(longest)}): {longest[:100]}")
        
        # 这是关键！把连续字母序列当作ASCII消息的字节表示！
        actual_data = bytearray()
        
        for char in longest:
            # 直接取字符的ASCII值
            actual_data.append(ord(char))
        
        print(f"   转换为字节数组: {len(actual_data)} 字节")
        
        # 尝试不同的解码方式
        decode_attempts = [
            ('UTF-8', 'utf-8'),
            ('Latin-1', 'latin-1'),
            ('CP1252', 'cp1252'),
            ('Raw Bytes', 'raw')
        ]
        
        best_result = None
        best_score = 0
        
        for name, encoding in decode_attempts:
            print(f"\n🔥 尝试解码: {name}")
            
            try:
                if encoding == 'raw':
                    # 保持为字节
                    result = actual_data
                    print(f"   原始字节: {result[:100]}")
                else:
                    # 尝试解码为文本
                    result = actual_data.decode(encoding, errors='ignore')
                    print(f"   解码后文本长度: {len(result)}")
                    
                    # 显示前100字符
                    preview = result[:200]
                    print(f"   文本预览: {preview}")
                    
                    # 评估
                    score = evaluate_recovery(result)
                    print(f"   解码评分: {score:.1f}")
                    
                    if score > best_score:
                        best_score = score
                        best_result = result
                        print(f"   🎯 新Best!")
                
                print(f"   ✅ {name} 解码成功")
            
            except Exception as e:
                print(f"   ❌ {name} 失败: {e}")
        
        # 如果找到好的结果
        if best_result:
            print(f"\n🏆 找到最佳解码: {best_score:.1f}!")
            save_and_analyze(best_result, best_score)
            
            # 继续尝试**url解码**
            if isinstance(best_result, str):
                print(f"\n🔓 进一步尝试URL解码...")
                try:
                    import urllib.parse
                    url_decoded = urllib.parse.unquote(best_result)
                    if url_decoded != best_result:
                        print(f"   🎉 URL解码成功！")
                        print(f"   解码前后差异，说明成功")
                        save_and_analyze(url_decoded, best_score * 1.2)
                except Exception as e:
                    print(f"   URL解码跳过: {e}")
        
        else:
            print(f"\n❌ 未能有效解码，尝试其他策略")
            
            # Plan B：分析其他序列代替
            # 先找到几个长的连续序列
            long_sequences = [seq for seq in letter_sequences if len(seq) > 100]
            
            print(f"   找到 {len(long_sequences)} 个长的字母序列")
            
            if long_sequences:
                # 取前3个尝试
                for i, seq in enumerate(long_sequences[:3]):
                    print(f"\n🔥 再次尝试序列 [{i+1}]: {len(seq)} 字符")
                    
                    bytes_from_seq = bytearray(ord(c) for c in seq)
                    
                    try:
                        result = bytes_from_seq.decode('latin-1', errors='ignore')
                        score = evaluate_recovery(result)
                        print(f"   分数: {score:.1f}")
                        
                        if score > 500:
                            save_and_analyze(result, score)
                    
                    except Exception as e:
                        print(f"   失败: {e}")

def evaluate_recovery(data):
    """评估恢复的质量"""
    
    try:
        if isinstance(data, bytes):
            return 0  # 字节无法评估
        
        text = data
        length = len(text)
        
        if length < 100:
            return 0
        
        score = 0
        
        # 可读性
        readable = sum(1 for c in text if 32 <= ord(c) <= 126)
        readability = readable / length
        score += readability * 2000
        
        # 检查关键词
        keywords = ['original', 'media', 'unwatermark', 'video', 'url', 'doubao', 'json']
        text_lower = text.lower()
        
        for keyword in keywords:
            count = text_lower.count(keyword)
            score += count * 5000  # 高权重
        
        # 结构加分
        if '{' in text and '}' in text:
            score += 5000
            
        import re
        if re.search(r'https?://', text):
            url_count = len(re.findall(r'https?://\S+', text))
            score += url_count * 5000
        
        if '"' in text:
            score += 2000
        
        # 大小奖励
        if length > 10000:
            score += 1000
        
        return score
    
    except Exception:
        return 0

def save_and_analyze(data, score):
    """保存并分析结果"""
    
    try:
        filename = f"LAYER4_SUCCESS_SCORE_{int(score)}.txt"
        
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(str(data))
        
        print(f"   💾 已保存到 {filename}")
        
        # 分析媒体信息
        analyze_media_info(data)
        
    except Exception as e:
        print(f"   保存失败: {e}")

def analyze_media_info(data):
    """分析媒体信息"""
    
    print(f"   🔍 深度分析媒体信息:")
    
    text = str(data).lower()
    
    # 1. 查找original
    import re
    if 'original' in text:
        print(f"   🎯 找到: original")
        
        # 查找附近的内容
        matches = re.findall(r'[Oo]riginal[^\n]{0,100}', text)
        if matches:
            print(f"      候选:")
            for match in matches[:3]:
                print(f"         {match[:80]}")
    
    # 2. 查找media
    if 'media' in text or 'video' in text:
        print(f"   🎯 找到: media/video")
        
        # 查找相关段落
        video_blocks = re.findall(r'[\{]?[^\}\{]{0,200}(?:media|video|stream)[^\}\{]{0,200}[\}]?', text, re.IGNORECASE)
        
        if video_blocks:
            print(f"      媒体数据块:")
            for block in video_blocks[:3]:
                clean_block = block.replace('\n', ' ').replace('\r', '')
                print(f"         {clean_block[:100]}")
    
    # 3. 查找URL
    urls = re.findall(r'https?://\S+', text)
    
    if urls:
        print(f"   🎯 找到 {len(urls)} 个URL:")
        
        # 分类
        doubao_urls = [url for url in urls if 'doubao' in url.lower()]
        video_urls = [url for url in urls if '.mp4' in url or 'video' in url]
        others = [url for url in urls if url not in doubao_urls and url not in video_urls]
        
        if doubao_urls:
            print(f"      🟦 豆包 ({len(doubao_urls)}):")
            for url in doubao_urls[:3]:
                print(f"         🔗 {url[:80]}")
                
                # 检查水印
                if 'unwatermark' in url.lower():
                    print(f"            🎉 无水印确认！")
                elif 'watermark' not in url.lower():
                    print(f"            💭 可能无水印")
        
        if video_urls:
            print(f"      🎥 视频 ({len(video_urls)}):")
            for url in video_urls[:3]:
                print(f"         📺 {url[:80]}")
                
        if others:
            print(f"      📎 其他 ({len(others)})")
            
        # 保存URL列表
        with open("LAYER4_DISCOVERED_URLs.txt", 'w') as f:
            f.write(f"发现 {len(urls)} 个URL:\n\n")
            for url in urls:
                f.write(url + "\n")
        
        print(f"      💾 URLs已保存到 LAYER4_DISCOVERED_URLs.txt")
    
    # 4. JSON 分析
    json_objects = re.findall(r'\{[^\{\}]*\}', text)
    
    if json_objects:
        print(f"   🎯 找到 {len(json_objects)} 个JSON objects:")
        
        for i, js in enumerate(json_objects[:3]):
            print(f"      [{i+1}] {js[:150]}")
            
            # 检查是否包含媒体信息
            if 'media' in js.lower() or 'url' in js.lower():
                print(f"         🎯 可能包含媒体信息！")

def main():
    final_destruction()
    print(f"\n🎯 LAYER4 最终Strike 完成！")

if __name__ == "__main__":
    main()