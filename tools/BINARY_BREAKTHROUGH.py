#!/usr/bin/env python3
"""
二进制突破 - 直接处理原始响应hex数据
"""
import binascii
import gzip
import zlib
import base64
import re

def binary_breakthrough():
    """直接二进制攻击"""
    
    print("" + "=" * 80)
    print("💥💥💥 二进制突破攻击 💥💥💥")
    print("策略：直接解码原始响应hex字节")
    print("=" * 80)
    
    # 加载原始响应
    with open("../get_play_info_raw_response_20260706_101726.json", 'rb') as f:
        raw_response = f.read()
    
    print(f"📊 原始响应: {len(raw_response):,} 字节")
    print(f"   前50字节hex: {raw_response[:50].hex()}")
    
    # 步骤1：inspection十六进制
    print(f"\n🔍 分析前100字节的hex:")
    preview_hex = raw_response[:100].hex()
    
    # 显示为可格式化的hex
    formatted = ' '.join(preview_hex[i:i+2] for i in range(0, len(preview_hex), 2))
    print(f"   {formatted}")
    
    # 步骤2：直接尝试解码整个响应
    print(f"\n🔥 初级解码尝试:")
    
    # 尝试常见encoding
    encodings = [
        'utf-8', 
        'latin-1',
        'cp1252',
        'iso-8859-1'
    ]
    
    best_text = None
    best_score = 0
    
    for encoding in encodings:
        try:
            text = raw_response.decode(encoding, errors='ignore')
            print(f"   ✅ {encoding}: 得到 {len(text)} 字符")
            score = score_text(text)
            print(f"      评分: {score:.1f}")
            
            if score > best_score:
                best_score = score
                best_text = text
                
                if score > 5000:
                    print(f"      🎯 显著突破！")
                    break
        
        except Exception as e:
            print(f"   ❌ {encoding} 失败: {e}")
    
    # 步骤3：识别二进制格式
    print(f"\n🔥 二进制格式识别:")
    
    # 检查gzip
    if raw_response[:2] == b'\x1f\x8b':
        print(f"   🎯 检测到gzip magic number")
        try:
            decompressed = gzip.decompress(raw_response)
            print(f"   ✅ Gzip解压: {len(decompressed)} 字节")
            
            text_result = decompressed.decode('utf-8', errors='ignore')
            score = score_text(text_result)
            print(f"   评分: {score:.1f}")
            
            if score > best_score:
                best_score = score
                best_text = text_result
                save_result(text_result, 'gzip_decompress', score)
        
        except Exception as e:
            print(f"   Gzip解压失败: {e}")
    
    # 检查zlib
    if raw_response[:2] == b'\x78\x9c':
        print(f"   🎯 检测到zlib magic number")
        try:
            decompressed = zlib.decompress(raw_response)
            print(f"   ✅ Zlib解压: {len(decompressed)} 字节")
            
            text_result = decompressed.decode('utf-8', errors='ignore')
            score = score_text(text_result)
            print(f"   评分: {score:.1f}")
            
            if score > best_score:
                best_score = score
                best_text = text_result
                save_result(text_result, 'zlib_decompress', score)
        
        except Exception as e:
            print(f"   Zlib解压失败: {e}")
    
    # 步骤4：处理JSON响应
    print(f"\n🔥 JSON响应处理:")
    
    try:
        # 尝试解析JSON
        import json
        json_data = json.loads(raw_response)
        
        print(f"   ✅ JSON解析成功")
        
        # 查找original字段
        original_data = find_original_media_info(json_data)
        
        if original_data:
            print(f"   🎯 找到original_media_info字段！")
            print(f"   数据: {original_data}")
            
            # 尝试提取URL
            url = extract_video_url(original_data)
            if url:
                print(f"   🎉 视频URL: {url}")
                
                # 检查水印
                is_unwatermarked = check_unwatermarked(url)
                if is_unwatermarked:
                    print(f"   🎯🎯🎯 无水印确认！")
                    save_result(url, 'original_url', 10000)
                else:
                    print(f"   💭 URL需要进一步分析")
        
        else:
            print(f"   ❌ JSON中未找到original字段")
    
    except Exception as e:
        print(f"   ❌ JSON解析失败: {e}")
    
    # 步骤5：二进制模式分析
    if not best_text or best_score < 1000:
        print(f"\n🔥 二进制模式攻击:")
        
        # 分析字节频率
        analyze_byte_frequency(raw_response)
        
        # 寻找可能的加密块
        find_encrypted_blocks(raw_response)
        
        # 尝试XOR解码
        xor_results = try_xor_decryption(raw_response)
        
        if xor_results and xor_results[1] > best_score:
            best_text = xor_results[0]
            best_score = xor_results[1]
            print(f"   🎯 XOR解码突破！")
            save_result(best_text, 'xor_break', best_score)
    
    # 最终结果
    print(f"\n" + "=" * 80)
    print(f"🏆 最终结果: 评分 {best_score:.1f}")
    
    if best_text and best_score > 100:
        print(f"   🎯 成功获取有意义数据！")
        analyze_content(best_text)
    
    else:
        print(f"   ❌ 未能获取有效数据")
        print(f"   💡 建议：检查原始响应文件")
    
    print(f"=" * 80)

def score_text(text):
    """评分文本"""
    
    if len(text) < 50:
        return 0
    
    score = 0
    
    # 可读性
    readable = sum(1 for c in text if 32 <= ord(c) <= 126 or c in ' \n\r\t')
    ratio = readable / len(text)
    score += ratio * 1000
    
    # 关键词
    keywords = ['original', 'media_info', 'doubao', 'url', 'video']
    text_lower = text.lower()
    
    for keyword in keywords:
        score += text_lower.count(keyword) * 1000
    
    # 结构
    if '{' in text and '}' in text:
        score += 500
    
    import re
    score += len(re.findall(r'https?://', text)) * 800
    
    return score

def find_original_media_info(json_data):
    """在JSON中查找original_media_info"""
    
    def search_recursive(data, path=""):
        if isinstance(data, dict):
            for key, value in data.items():
                current_path = f"{path}.{key}" if path else key
                
                if key.lower() == 'original_media_info':
                    return value
                
                result = search_recursive(value, current_path)
                if result:
                    return result
        
        elif isinstance(data, list):
            for i, item in enumerate(data):
                result = search_recursive(item, f"{path}[{i}]")
                if result:
                    return result
        
        return None
    
    return search_recursive(json_data)

def extract_video_url(media_info):
    """提取视频URL"""
    
    if isinstance(media_info, dict):
        # 查找main_url
        for key, value in media_info.items():
            key_lower = key.lower()
            
            if 'url' in key_lower and isinstance(value, str):
                if value.startswith('http'):
                    return value
        
        # 递归查找
        for value in media_info.values():
            if isinstance(value, (dict, list)):
                result = extract_video_url(value)
                if result:
                    return result
    
    elif isinstance(media_info, list):
        for item in media_info:
            result = extract_video_url(item)
            if result:
                return result
    
    return None

def check_unwatermarked(url):
    """检查URL是否无水印"""
    
    if not url or not isinstance(url, str):
        return False
    
    url_lower = url.lower()
    
    # 有明确无水印标记
    if any(marker in url_lower for marker in ['unwatermark', 'original', 'no_watermark']):
        return True
    
    # 无水印参数
    if 'watermark' in url_lower and 'false' in url_lower:
        return True
    
    # 有水印标记
    if 'watermark' in url_lower and 'true' in url_lower:
        return False
    
    # 无水印相关参数
    if 'lr=video_gen_no_watermark' in url:
        return True
    
    # 可能有水印
    if 'lr=video_gen_watermark_dyn' in url:
        return False
    
    # 无法判断
    return None

def analyze_byte_frequency(data):
    """分析字节频率"""
    
    from collections import Counter
    counter = Counter(data)
    
    print(f"   字节频率统计:")
    for byte_val, count in counter.most_common(10):
        percentage = count / len(data) * 100
        print(f"      0x{byte_val:02x}: {count:,} ({percentage:.2f}%)")

def find_encrypted_blocks(data):
    """寻找加密块"""
    
    print(f"   寻找重复Bytes模式:")
    
    # 查找长重复字节序列
    from collections import Counter
    
    patterns = {}
    for length in range(5, 20):
        for i in range(len(data) - length):
            pattern = data[i:i+length]
            if pattern not in patterns:
                patterns[pattern] = 1
            else:
                patterns[pattern] += 1
    
    # 显示高频Patterns
    frequent_patterns = [(p, c) for p, c in patterns.items() if c > 5]
    frequent_patterns.sort(key=lambda x: x[1], reverse=True)
    
    if frequent_patterns:
        print(f"   找到 {len(frequent_patterns)} 个频繁模式:")
        for pattern, count in frequent_patterns[:5]:
            pattern_hex = ' '.join(f"{b:02x}" for b in pattern)
            print(f"      {pattern_hex} (×{count})")
    
    else:
        print(f"   未找到频繁模式")

def try_xor_decryption(data):
    """尝试XOR解码"""
    
    print(f"   尝试XOR全字节解码:")
    
    best_score = 0
    best_result = None
    
    for key in range(256):
        if key % 32 == 0:
            print(f"\r      尝试key: 0x{key:02x}", end="")
        
        decrypted = bytes(b ^ key for b in data)
        
        # 尝试解码
        try:
            text = decrypted.decode('utf-8', errors='ignore')
            score = score_text(text)
            
            if score > best_score:
                best_score = score
                best_result = text
        
        except:
            pass
    
    print(f"\n      XOR最佳得分: {best_score:.1f}")
    
    if best_result and best_score > 1000:
        return (best_result, best_score)
    
    return None

def save_result(data, method, score):
    """保存结果"""
    
    try:
        filename = f"BINARY_BREAK_{method}_{int(score)}.txt"
        
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(str(data))
        
        print(f"   💾 已保存到 {filename}")
    
    except Exception as e:
        print(f"   保存失败: {e}")

def analyze_content(text):
    """分析内容"""
    
    print(f"\n🔬 深度分析:")
    
    # 查找original
    import re
    if 'original' in text.lower():
        print(f"   🎯 找到original")
        
        matches = re.findall(r'[Oo]riginal[^\n]{0,300}', text)
        if matches:
            for match in matches[:3]:
                print(f"      {match[:100]}")
    
    # 查找URL
    urls = re.findall(r'https?://\S+', text)
    if urls:
        print(f"   🎯 找到 {len(urls)} 个URL")
        
        for url in urls[:3]:
            print(f"      🔗 {url[:80]}")
    
    # 查找JSON
    json_objects = re.findall(r'\{[^\{\}]*?\}', text)
    if json_objects:
        print(f"   🎯 找到 {len(json_objects)} 个JSON")

def main():
    binary_breakthrough()
    
    print(f"\n🎯 二进制突破完成！")

if __name__ == "__main__":
    main()