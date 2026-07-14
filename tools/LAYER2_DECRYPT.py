#!/usr/bin/env python3
"""
第二层解密 - 针对XOR后的数据
"""
import gzip
import zlib
import base64
import json
from urllib.parse import unquote

def layer2_attack():
    """攻击第二层加密"""
    
    print("\n" + "=" * 80)
    print("🔓 LAYER 2 解密攻击 - XOR后的深层数据")
    print("=" * 80)
    
    # 加载XOR破解结果
    filename = "XOR_DECRYPT_KEY_81.txt"
    
    with open(filename, 'rb') as f:
        layer1_data = f.read()
    
    print(f"📊 Layer 1数据: {len(layer1_data):,} 字节")
    
    # 第二层攻击策略
    layer2_strategies = [
        {'name': 'gzip解压', 'function': try_gzip},
        {'name': 'zlib解压', 'function': try_zlib}, 
        {'name': 'base64解码', 'function': try_base64},
        {'name': 'URL解码', 'function': try_url_decode},
        {'name': '文本转换', 'function': try_text_conversion}
    ]
    
    results = []
    
    for strategy in layer2_strategies:
        print(f"\n🔥 Layer 2: {strategy['name']}")
        
        try:
            result = strategy['function'](layer1_data)
            
            if result:
                print(f"   💡 成功！得到 {len(result)} 字符")
                
                # 评估
                quality = eval_result_quality(result)
                print(f"   评分: {quality:.1f}")
                
                if quality > 100:
                    results.append((result, strategy['name'], quality))
                    save_result(result, f"LAYER2_{strategy['name']}")
                
            else:
                print(f"   ❌ 无结果")
                
        except Exception as e:
            print(f"   ❌ 失败: {e}")
    
    # 显示最佳结果
    if results:
        results.sort(key=lambda x: x[2], reverse=True)
        
        print(f"\n🎯 最佳Layer 2结果:")
        
        for i, (result, method, score) in enumerate(results[:3]):
            print(f"   🏆 [{i+1}] {method} (分数: {score:.1f})")
            
            preview = str(result)[:200]
            print(f"      预览: {preview}")
            
            # 分析这个结果
            analyze_candidate(result, method)
    
    else:
        print(f"\n❌ Layer 2攻击未果")
        print(f"💡 可能需要更复杂的解密方法")

def try_gzip(data):
    """尝试gzip解压"""
    
    try:
        # 检查gzip magic
        if data[:2] == b'\x1f\x8b':
            print(f"   🔍 gzip magic detected")
            
        decompressed = gzip.decompress(data)
        print(f"   ✅ gzip解压成功，{len(decompressed)} 字节")
        
        # 转文本
        try:
            text = decompressed.decode('utf-8')
            return text
        except:
            return decompressed
            
    except Exception as e:
        print(f"   gzip失败: {e}")
        return None

def try_zlib(data):
    """尝试zlib解压"""
    
    try:
        # 检查zlib magic  
        if data[:2] == b'\x78\x9c':
            print(f"   🔍 zlib magic detected")
        
        decompressed = zlib.decompress(data)
        print(f"   ✅ zlib解压成功，{len(decompressed)} 字节")
        
        try:
            text = decompressed.decode('utf-8')
            return text
        except:
            return decompressed
            
    except Exception as e:
        print(f"   zlib失败: {e}")
        return None

def try_base64(data):
    """尝试base64解码"""
    
    try:
        # 先转字符串
        if isinstance(data, bytes):
            try:
                text_data = data.decode('utf-8', errors='ignore')
            except:
                return None
        else:
            text_data = str(data)
        
        # 清理非base64字符
        cleaned = ''.join(c for c in text_data if c.isalnum() or c in '+/=')
        
        print(f"   清理后Base64数据长度: {len(cleaned)}")
        
        if len(cleaned) > 100:
            # 补齐4的倍数
            padding = 4 - (len(cleaned) % 4)
            if padding != 4:
                cleaned += '=' * padding
            
            try:
                decoded = base64.b64decode(cleaned)
                print(f"   ✅ Base64解码成功，{len(decoded)} 字节")
                
                # 尝试进一步解码
                try:
                    text = decoded.decode('utf-8')
                    return text
                except:
                    # 可能是gzip压缩的，再试一次
                    decompressed = gzip.decompress(decoded)
                    try:
                        text = decompressed.decode('utf-8')
                        print(f"   🎉 Base64+gzip成功！")
                        return text
                    except:
                        return decoded
                        
            except Exception as e:
                print(f"   Base64解码失败: {e}")
    
    except Exception as e:
        print(f"   Base64整体失败: {e}")
        
    return None

def try_url_decode(data):
    """尝试URL解码"""
    
    try:
        if isinstance(data, bytes):
            text_data = data.decode('utf-8', errors='ignore')
        else:
            text_data = str(data)
        
        # 检查是否有URL编码特征
        if '%' in text_data:
            decoded = unquote(text_data)
            
            if decoded != text_data:
                print(f"   ✅ URL解码成功，发现 {text_data.count('%')} 个%%")
                return decoded
    
    except Exception as e:
        print(f"   URL解码失败: {e}")
        
    return None

def try_text_conversion(data):
    """尝试文本转换"""
    
    try:
        if isinstance(data, bytes):
            # 尝试多种编码
            encodings = ['utf-8', 'latin1', 'cp1252', 'gbk']
            
            for encoding in encodings:
                try:
                    text = data.decode(encoding, errors='ignore')
                    print(f"   ✅ 编码{encoding}成功")
                    return text
                except:
                    continue
        
        else:
            return str(data)
            
    except Exception as e:
        print(f"   文本转换失败: {e}")
        
    return None

def eval_result_quality(result):
    """评估结果质量"""
    
    try:
        if not result:
            return 0
            
        text = str(result) if not isinstance(result, str) else result
        text_len = len(text)
        
        if text_len < 50:
            return 0
            
        score = 0
        
        # 可读性评分
        readable_chars = sum(1 for c in text if 32 <= ord(c) <= 126 or c in '\n\r\t .')
        readability = readable_chars / text_len
        score += readability * 500
        
        # 媒体关键词
        keywords = ['original', 'media', 'video', 'url', 'doubao', 'unwatermark']
        text_lower = text.lower()
        for keyword in keywords:
            matches = text_lower.count(keyword)
            score += matches * 100
        
        # 结构加分
        if '{' in text and '}' in text:
            score += 200
        
        if '"' in text:
            score += 100
            
        import re
        if re.search(r'https?://', text):
            url_count = len(re.findall(r'https?://\S+', text))
            score += url_count * 150
        
        # 长度奖励
        if 1000 < text_len < 50000:
            score += 100
        
        return score
        
    except Exception:
        return 0

def save_result(result, prefix):
    """保存结果"""
    
    try:
        filename = f"{prefix}_RESULT.txt"
        with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
            f.write(str(result))
        print(f"   💾 已保存到 {filename}")
    except Exception as e:
        print(f"   保存失败: {e}")

def analyze_candidate(result, method):
    """分析 candidate"""
    
    try:
        text = str(result)
        
        print(f"   🔍 深度分析 [{method}]:")
        
        # 查找original
        import re
        original_matches = re.findall(r'[Oo]riginal[^\n<]{0,300}', text)
        
        if original_matches:
            print(f"      🎯 找到 {len(original_matches)} 个original:")
            for match in original_matches[:3]:
                print(f"         {match[:100]}")
        
        # 查找URL
        urls = re.findall(r'https?://\S+', text)
        
        if urls:
            print(f"      🎯 找到 {len(urls)} 个URL:")
            for url in urls[:3]:
                print(f"         {url[:80]}")
                
                if 'doubao' in url.lower():
                    if 'unwatermark' in url:
                        print(f"             🎉🎉🎉 无水印确认！")
                    elif 'watermark' not in url:
                        print(f"             💭 可能无水印")
        
    except Exception as e:
        print(f"   分析失败: {e}")

def main():
    layer2_attack()
    
    print(f"\n🎯 Layer 2攻击完成！")
    print(f"💡 检查生成的文件获取detail结果")

if __name__ == "__main__":
    main()