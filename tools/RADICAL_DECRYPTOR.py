#!/usr/bin/env python3
"""
根本解密者 - 重新攻击原始base64编码的二进制数据
明确策略：直接定位并解码original_media_info的加密内容
"""
import base64
import gzip
import zlib
from urllib.parse import unquote

def radical_attack():
    """根本攻击：直接处理原始base64数据"""
    
    print("" + "=" * 80)
    print("🔥🔥🔥 RADICAL 解密攻击 🔥🔥🔥")
    print("新策略：直接解码base64加密数据块")
    print("=" * 80)
    
    # 加载原始数据
    with open("../decoded_content_URL解码_20260706_102428.txt", 'rb') as f:
        raw_data = f.read()
    
    print(f"📊 原始数据: {len(raw_data):,} 字节")
    
    # 关键发现：base64编码的数据被UTF-8错误解码为efbfbd!
    # 现在直接查找base64编码的块
    print(f"\n🔍 搜索base64编码数据块:")
    
    # 转换为字符串查找
    try:
        text_data = raw_data.decode('utf-8', errors='replace')
    except:
        text_data = raw_data
    
    # 方案1：直接base64解码整个大块
    successful_decodes = []
    
    # 查找长串的base64字符
    import re
    base64_pattern = r'[A-Za-z0-9+/\-_]{50,}'  # 至少50个字符的base64like文本
    
    matches = re.findall(base64_pattern, text_data)
    
    print(f"   找到 {len(matches)} 个长base64like字符串")
    
    for i, match in enumerate(matches[:10]):  # 取前10个长的尝试
        print(f"\n🔥 尝试Base64块 [{i+1}]: {len(match)} 字符")
        
        try:
            # 补齐base64长度
            original_len = len(match)
            padding = 4 - (original_len % 4) % 4
            padded = match + ('=' * padding)
            
            print(f"   补齐后: {len(padded)} (填充: {padding})")
            
            # 尝试解码
            decoded = base64.b64decode(padded, validate=False)
            print(f"   ✅ Base64解码成功: {len(decoded)} 字节")
            
            # 尝试多级解码
            final_result = decode_deep_layers(decoded)
            
            if final_result:
                score = evaluate_success(final_result)
                print(f"   🎯 解密成功！评分: {score:.1f}")
                
                if score > 1000:
                    successful_decodes.append((final_result, score, f"block_{i+1}"))
                    save_result(final_result, score, f"base64_deep_{i+1}", match)
            
            else:
                print(f"   ❓ 解码无有效文本")
        
        except Exception as e:
            print(f"   ❌ base64解码失败: {e}")
        
        # 只尝试前5个最有希望的
        if i >= 4:
            break
    
    # 方案2：寻找特殊模式的base64
    print(f"\n🔥 特殊模式搜索:")
    
    # 查找efbfbd位置附近的的base64
    efbfbd_positions = [m.start() for m in re.finditer('efbfbd', text_data[:100000])]
    
    if efbfbd_positions:
        print(f"   找到 {len(efbfbd_positions)} 个efbfbd位置")
        
        # 取前几个位置
        sample_positions = efbfbd_positions[:5]
        
        for i, pos in enumerate(sample_positions):
            print(f"\n🔥 从efbfbd位置 {pos:,} 提取数据")
            
            # 从该位置向前后搜索base64字符
            window_start = max(0, pos - 500)
            window_end = min(len(text_data), pos + 500)
            
            window = text_data[window_start:window_end]
            
            # 提取长base64序列
            base64_candidates = re.findall(r'[A-Za-z0-9+/]{20,}', window)
            
            if base64_candidates:
                long_candidate = max(base64_candidates, key=len)
                print(f"   找到长base64候选: {len(long_candidate)}")
                
                # 解码
                try:
                    decoded = base64.b64decode(long_candidate, validate=False)
                    
                    result = decode_deep_layers(decoded)
                    if result:
                        score = evaluate_success(result)
                        print(f"   🎯 位置base64成功！评分: {score:.1f}")
                        
                        if score > 500:
                            save_result(result, score, f"around_efbfbd_{i+1}", long_candidate)
                
                except Exception as e:
                    print(f"   位置base64解码失败: {e}")
    
    # 显示所有成功结果
    if successful_decodes:
        print(f"\n" + "=" * 80)
        print(f"🎉 找到 {len(successful_decodes)} 个成功解码!")
        print(f"=" * 80)
        
        successful_decodes.sort(key=lambda x: x[1], reverse=True)
        
        for result, score, label in successful_decodes[:5]:
            print(f"\n🏆 [{label}] 评分: {score:.1f}")
            analyze_result(result)
    
    else:
        print(f"\n❌ base64方法未果")
        print(f"💡 建议尝试原始字节直接解码")

def decode_deep_layers(data):
    """深层解码：尝试多种组合"""
    
    if isinstance(data, str):
        binary_data = data.encode('utf-8', errors='ignore')
    else:
        binary_data = data
    
    # 多层解码策略
    layers = [
        ('raw', lambda x: x),
        ('gzip', lambda x: gzip.decompress(x) if x[:2] == b'\x1f\x8b' else x),
        ('zlib', lambda x: zlib.decompress(x) if x[:2] == b'\x78\x9c' else x),
        ('base64', lambda x: base64.b64decode(x) if is_base64_like(x) else x),
    ]
    
    best_result = None
    best_score = 0
    
    # 尝试单个层
    for name, func in layers:
        try:
            result_data = func(binary_data)
            
            # 尝试转文本
            try:
                text_result = result_data.decode('utf-8', errors='ignore')
                score = evaluate_success(text_result)
                
                if score > best_score:
                    best_score = score
                    best_result = text_result
                    
                    if score > 2000:
                        print(f"   🎯 {name}层突破!")
                        return text_result
                        
            except Exception as e:
                pass
        
        except Exception as e:
            pass
    
    # 尝试组合
    combination_results = try_combination_decoding(binary_data)
    
    if combination_results and combination_results[1] > best_score:
        return combination_results[0]
    
    return best_result

def try_combination_decoding(data):
    """尝试组合解码"""
    
    combinations = [
        ['gzip', 'utf8'],
        ['zlib', 'utf8'],
        ['base64', 'gzip', 'utf8'],
        ['base64', 'zlib', 'utf8'],
        ['base64', 'raw']
    ]
    
    best = None
    best_score = 0
    
    for combo in combinations[:3]:  # 测试前3个组合
        try:
            result = data
            
            for layer in combo:
                if layer == 'gzip':
                    try:
                        result = gzip.decompress(result)
                    except:
                        break
                elif layer == 'zlib':
                    try:
                        result = zlib.decompress(result)
                    except:
                        break
                elif layer == 'base64':
                    try:
                        import base64
                        # 先转字符串
                        if isinstance(result, bytes):
                            text_form = result.decode('ascii', errors='ignore')
                        else:
                            text_form = str(result)
                        
                        # 清理非base64字符
                        cleaned = ''.join(c for c in text_form if c.isalnum() or c in '+/=')
                        result = base64.b64decode(cleaned, validate=False)
                    except:
                        break
                elif layer == 'utf8':
                    if isinstance(result, bytes):
                        result = result.decode('utf-8', errors='ignore')
            
            if isinstance(result, str):
                score = evaluate_success(result)
                if score > best_score:
                    best_score = score
                    best = result
                    
                    if score > 2500:
                        print(f"   🎯 组合突破!")
                        return (result, score)
            
        except Exception as e:
            pass
    
    if best:
        return (best, best_score)
    
    return None

def is_base64_like(data):
    """检查是否可能是base64"""
    try:
        if isinstance(data, bytes):
            text = data.decode('ascii', errors='ignore')
        else:
            text = str(data)
        
        # 检查长度和内容
        if len(text) < 20:
            return False
        
        # 至少80%是可base64字符
        base64_chars = sum(1 for c in text if c.isalnum() or c in '+/=')
        ratio = base64_chars / len(text)
        
        return ratio > 0.8
    
    except:
        return False

def evaluate_success(data):
    """评估解密成功度"""
    
    if not data:
        return 0
    
    text = str(data)
    length = len(text)
    
    if length < 100:
        return 0
    
    score = 0
    
    # 可读性
    readable = sum(1 for c in text if 32 <= ord(c) <= 126 or c in '\n\r\t')
    readability = readable / length
    score += readability * 2000
    
    # 关键词
    keywords = ['original', 'media_info', 'main_url', 'doubao', 'video', 'unwatermark']
    text_lower = text.lower()
    
    for keyword in keywords:
        matches = text_lower.count(keyword)
        score += matches * 8000  # 很高权重
    
    # 结构加分
    if '{' in text and '}' in text:
        score += 6000
    
    import re
    url_matches = re.findall(r'https?://', text)
    score += len(url_matches) * 8000
    
    # 大小奖励
    if length > 10000:
        score += 2000
    
    return score

def save_result(data, score, method, original=None):
    """保存结果"""
    
    try:
        filename = f"RADICAL_RESULT_{method}_{int(score)}.txt"
        
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(f"评分: {score}\n方式: {method}\n\n")
            
            if original:
                f.write(f"原始数据 ({len(original)}): {original[:200]}...\n\n")
            
            f.write(str(data))
        
        print(f"   💾 已保存到 {filename}")
    
    except Exception as e:
        print(f"   保存失败: {e}")

def analyze_result(result):
    """分析结果"""
    
    print(f"   🔍 分析内容:")
    
    text = str(result).lower()
    
    # 关键词统计
    keywords = ['original', 'media_info', 'doubao', 'main_url']
    
    found_keywords = []
    for keyword in keywords:
        if keyword in text:
            found_keywords.append(keyword)
    
    if found_keywords:
        print(f"      🎯 发现关键字: {', '.join(found_keywords)}")
    
    # 查找URL
    import re
    urls = re.findall(r'https?://\S+', str(result))
    
    if urls:
        print(f"      🎯 发现 {len(urls)} 个URL")
        
        for url in urls[:3]:
            print(f"         🔗 {url[:80]}")
            
            if 'doubao' in url.lower():
                print(f"            🟦 豆包URL")
                
                if 'unwatermark' in url.lower():
                    print(f"            🎉 无水印确认！")
                elif 'watermark' not in url.lower():
                    print(f"            💭 可能无水印")
    
    # 查找JSON
    json_objects = re.findall(r'\{[^\{\}]*?\}', str(result))
    
    if json_objects:
        print(f"      🎯 找到 {len(json_objects)} 个JSON")
        
        for js in json_objects[:2]:
            if any(kw in js.lower() for kw in ['original', 'media', 'url']):
                print(f"         🎯 [{kw}] {js[:100]}")

def main():
    radical_attack()
    
    print(f"\n🎯 RADICAL解密完成！")
    print(f"💡 查看生成的结果文件获取详细分析")

if __name__ == "__main__":
    main()