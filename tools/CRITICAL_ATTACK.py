#!/usr/bin/env python3
"""
成败在此一举 - 使用正确的165K数据发起总攻
"""
import gzip
import zlib
import base64
import json
import re

def critical_attack():
    """成败在此一举"""
    
    print("" + "=" * 80)
    print("⚡⚡⚡ CRITICAL 总攻 ⚡⚡⚡")
    print("使用165KB解码数据直接发起最终攻击")
    print("=" * 80)
    
    # 加载165KB数据
    file_path = "tools/decoded_content_URL解码_20260706_102428.txt"
    
    with open(file_path, 'rb') as f:
        data = f.read()
    
    print(f"📊 数据大小: {len(data):,} 字节")
    print(f"   文件头40字节hex: {data[:40].hex()}")
    print(f"   文件尾40字节hex: {data[-40:].hex()}")
    
    # 攻击1：直接尝试解码整个文件
    print(f"\n🔥 攻击1: 直接解码")
    
    success_result = None
    success_score = 0
    
    # 尝试解码为文本
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    
    for encoding in encodings:
        try:
            text = data.decode(encoding, errors='ignore')
            
            print(f"   {encoding}: {len(text)} 字符")
            score = evaluate_text(text)
            print(f"      评分: {score:.1f}")
            
            if score > success_score:
                success_score = score
                success_result = text
                
                if score > 5000:
                    print(f"      🎯 突破！")
                    break
        
        except Exception as e:
            print(f"   {encoding} 失败: {e}")
    
    # 攻击2：搜索Base64编码的数据块
    if not success_result or success_score < 5000:
        print(f"\n🔥 攻击2: Base64数据块提取")
        
        text_data = data.decode('utf-8', errors='replace')
        
        # 提取base64风格的数据
        base64_candidates = re.findall(r'[A-Za-z0-9+/]{40,}', text_data)
        
        print(f"   找到 {len(base64_candidates)} 个base64候选")
        
        for i, candidate in enumerate(base64_candidates[:5]):
            if len(candidate) < 200:
                continue
                
            print(f"   候选[{i+1}]: {len(candidate)} 字符")
            
            try:
                # 补齐 base64
                padding = 4 - (len(candidate) % 4) % 4
                padded = candidate + ('=' * padding)
                
                decoded = base64.b64decode(padded, validate=False)
                print(f"      ✅ Base64解码: {len(decoded)} 字节")
                
                # 尝试解压
                try:
                    decompressed = gzip.decompress(decoded)
                    print(f"      ✅ gzip解压: {len(decompressed)} 字节")
                    decoded = decompressed
                except:
                    pass
                
                try:
                    decompressed = zlib.decompress(decoded)
                    print(f"      ✅ zlib解压: {len(decompressed)} 字节")
                    decoded = decompressed
                except:
                    pass
                
                # 尝试解码为文本
                try:
                    text_result = decoded.decode('utf-8', errors='ignore')
                    score = evaluate_text(text_result)
                    
                    print(f"      文本长度: {len(text_result)}")
                    print(f"      评分: {score:.1f}")
                    
                    if score > success_score:
                        success_score = score
                        success_result = text_result
                        
                        save_result(text_result, f"base64_block_{i+1}", score)
                        
                        if score > 5000:
                            print(f"      🎯🎯🎯 重大突破！")
                            break
                
                except Exception as e:
                    print(f"      无有效文本: {e}")
            
            except Exception as e:
                print(f"      解码失败: {e}")
    
    # 攻击3：直接解压缩尝试
    if not success_result or success_score < 5000:
        print(f"\n🔥 攻击3: 直接解压缩")
        
        # 尝试gzip
        try:
            decompressed = gzip.decompress(data)
            print(f"   ✅ Gzip成功: {len(decompressed)} 字节")
            
            text_result = decompressed.decode('utf-8', errors='ignore')
            score = evaluate_text(text_result)
            
            print(f"   文本评分: {score:.1f}")
            
            if score > success_score:
                success_score = score
                success_result = text_result
                
                save_result(text_result, 'gzip_all', score)
        
        except Exception as e:
            print(f"   ❌ gzip失败: {e}")
    
    # 攻击4：原始hex数据分析
    if not success_result or success_score < 5000:
        print(f"\n🔥 攻击4: 原始hex分析")
        
        # 转换hex
        hex_str = data.hex()
        print(f"   hex长度: {len(hex_str)}")
        
        # 查找可能的模式
        analyze_hex_patterns(hex_str)
        
        # 尝试可能的组合解码
        hex_results = try_hex_decoding(hex_str)
        
        if hex_results and hex_results[1] > success_score:
            success_result = hex_results[0]
            success_score = hex_results[1]
            print(f"   🎯 HEX解码突破！")
            save_result(success_result, 'hex_decrypt', success_score)
    
    # 显示最终结果
    print(f"\n" + "=" * 80)
    print(f"🏆 最终攻击结果: 评分 {success_score:.1f}")
    print(f"=" * 80)
    
    if success_result and success_score > 1000:
        print(f"   🎯 获取成功！")
        analyze_result(success_result)
        
        # 进一步处理
        if success_score > 5000:
            print(f"\n" + "=" * 80)
            print(f"🎉🎉🎉 重大突破！开始深度处理 🎉🎉🎉")
            
            # 提取媒体信息
            extract_media_info(success_result)
            
            # 查找视频URL
            extract_video_urls(success_result)
            
            # 查找JSON
            extract_json_objects(success_result)
    
    else:
        print(f"   ❌ 最终攻击未果")
        print(f"   🔄 建议重新审查数据")

def evaluate_text(text):
    """评估文本质量"""
    
    if len(text) < 100:
        return 0
    
    score = 0
    
    # 可读字符
    readable = sum(1 for c in text if 32 <= ord(c) <= 126 or c in ' \n\r\t')
    readability = readable / len(text)
    score += readability * 1500
    
    # 关键词
    keywords = [
        'original', 'media_info', 'main_url', 'doubao', 
        'video', 'unwatermark', 'watermark'
    ]
    
    text_lower = text.lower()
    for keyword in keywords:
        count = text_lower.count(keyword)
        score += count * 3000
    
    # 结构加分
    if '{' in text and '}' in text:
        score += 2000
    
    # URL加分
    import re
    url_count = len(re.findall(r'https?://', text))
    score += url_count * 3000
    
    # 长度奖励
    score += min(len(text) / 100, 2000)
    
    return score

def save_result(data, method, score):
    """保存结果"""
    
    try:
        filename = f"CRITICAL_RESULT_{method}_{int(score)}.txt"
        
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(str(data))
        
        print(f"      💾 已保存: {filename}")
    
    except Exception as e:
        print(f"      保存失败: {e}")

def analyze_result(result):
    """分析结果"""
    
    print(f"\n🔬 结果深度分析:")
    
    # 查找original
    if 'original' in result.lower():
        print(f"   🎯 找到original")
    
    # 查找URL
    import re
    urls = re.findall(r'https?://\S+', result)
    
    if urls:
        print(f"   🎯 找到 {len(urls)} 个URL")
        for url in urls[:5]:
            print(f"      🔗 {url[:80]}")
    
    # 查找JSON
    json_objects = re.findall(r'\{[^\{\}]*?\}', result)
    if json_objects:
        print(f"   🎯 找到 {len(json_objects)} 个JSON对象")

def extract_media_info(text):
    """提取媒体信息"""
    
    print(f"\n📊 媒体信息提取:")
    
    # 查找original相关的段落
    import re
    original_sections = re.findall(r'[Oo]riginal[^\n]{0,500}', text)
    
    if original_sections:
        print(f"   🎯 找到 {len(original_sections)} 个original段落:")
        for section in original_sections:
            print(f"      {section[:150]}")
    
    else:
        print(f"   ❌ 未找到original段落")

def extract_video_urls(text):
    """提取视频URLs"""
    
    print(f"\n📺 视频URL提取:")
    
    import re
    urls = re.findall(r'https?://[^ \n]+', text)
    
    if urls:
        print(f"   🎯 共找到 {len(urls)} 个URL:")
        
        for url in urls[:10]:
            print(f"      🔗 {url}")
            
            # 分析水印
            if 'doubao' in url.lower():
                if 'unwatermark' in url.lower():
                    print(f"         🎉 无水印确认！")
                elif 'watermark' not in url.lower():
                    print(f"         💭 可能无水印")

def extract_json_objects(text):
    """提取JSON对象"""
    
    print(f"\n📄 JSON对象提取:")
    
    import re
    json_objects = re.findall(r'\{[^\{\}]*?\}', text)
    
    if json_objects:
        print(f"   🎯 找到 {len(json_objects)} 个JSON对象:")
        
        for i, js in enumerate(json_objects[:5]):
            print(f"      [{i+1}] {js[:200]}")
            
            # 检查是否包含媒体信息
            if any(key in js.lower() for key in ['original', 'media', 'url']):
                print(f"         🎯 包含媒体信息！")

def analyze_hex_patterns(hex_str):
    """分析hex模式"""
    
    print(f"   分析hex模式:")
    
    # 查找重复模式
    patterns = {}
    for length in range(8, 20):
        for i in range(0, min(1000, len(hex_str) - length), 2):
            pattern = hex_str[i:i+length]
            if pattern not in patterns:
                patterns[pattern] = 1
            else:
                patterns[pattern] += 1
    
    # 显示高频模式
    frequent = sorted(patterns.items(), key=lambda x: x[1], reverse=True)[:5]
    
    for pattern, count in frequent:
        if count > 2:
            formatted = ' '.join(pattern[i:i+2] for i in range(0, len(pattern), 2))
            print(f"      {formatted} (×{count})")

def try_hex_decoding(hex_str):
    """尝试hex解码"""
    
    print(f"   尝试hex解码:")
    
    # 尝试直接hex到bytes
    try:
        byte_data = bytes.fromhex(hex_str)
        print(f"      字节数据: {len(byte_data)}")
        
        # 尝试解码
        try:
            text = byte_data.decode('utf-8', errors='ignore')
            score = evaluate_text(text)
            print(f"      评分: {score:.1f}")
            
            if score > 3000:
                return (text, score)
        
        except:
            pass
    
    except:
        pass
    
    return None

def main():
    critical_attack()
    
    print(f"\n🎯 CRITICAL总攻完成！")
    print(f"💡 检查生成的文件获取最终结果")

if __name__ == "__main__":
    main()