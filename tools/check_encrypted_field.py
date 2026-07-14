#!/usr/bin/env python3
"""
检查original_media_info字段是否被加密
"""
import json
import re

def check_encryption_in_response():
    """检查之前的API响应中或否有被加密的original_media_info字段"""
    
    print("🔍 检查API响应中的加密original_media_info字段\n")
    
    # 要检查的result文件
    result_files = [
        "../content_analysis_results.json",
        "../binary_analysis_results.json", 
        "../decoding_summary_20260706_102428.json"
    ]
    
    # 解码文件
    decoded_files = [
        "../decoded_content_URL解码_20260706_102428.txt",
        "../decoded_content_Unicode解码_20260706_102428.txt",
        "../decoded_content_字符替换_20260706_102428.txt"
    ]
    
    all_files = result_files + decoded_files
    
    # 原始二进制文件
    binary_files = ["../get_play_info_raw_response_20260706_101726.json"]
    
    # 搜索所有类型的original_media_info
    search_patterns = [
        r'"original_media_info"\s*:\s*\{([^}]*)\}',
        r'"original_media_info"\s*:\s*"([^"]+)"',
        r'"original"\s*:\s*\{([^}]*)\}',
        r'"original"\s*:\s*"([^"]+)"',
        r'original_media[\s\S]*url[\s\S]*?', 
        r'media_info[\s\S]*original'
    ]
    
    for file_path in all_files:
        print(f"📋 检查文件: {file_path}")
        
        try:
            # 尝试读取为文本
            with open(file_path, 'rb') as f:
                content = f.read()
            
            print(f"   大小: {len(content):,} 字节")
            
            # 如果是纯文本result
            if file_path.endswith('.json'):
                try:
                    text = content.decode('utf-8', errors='ignore')
                except:
                    text = str(content) 
            else:
                # 解码文件
                text = content.decode('utf-8', errors='ignore')
            
            # 特别关注大文件，分页输出
            if len(text) > 50000:
                print(f"   ⚠️ 文件很大，只分析部分内容")
                text_chunks = [text[i:i+10000] for i in range(0, len(text), 5000)]
            else:
                text_chunks = [text]
            
            found_matches = 0
            
            for chunk_num, chunk in enumerate(text_chunks[:3]):  # 限制chunk数
                print(f"   分析第{chunk_num+1}个chunk...")
                
                for pattern in search_patterns:
                    matches = re.findall(pattern, chunk, re.IGNORECASE | re.DOTALL)
                    
                    if matches:
                        found_matches += len(matches)
                        print(f"   🔍 发现匹配 (pattern: {pattern[:50]}...):")
                        
                        for i, match in enumerate(matches[:3]):  # 限制显示数量
                            cleaned_match = str(match).replace('\n', ' ').replace('\r', '')
                            print(f"      [{i+1}] {cleaned_match[:300]}")
                            
                            # 分析这个match的加密特征
                            analyze_encryption_features(cleaned_match, file_path)
            
            if found_matches > 0:
                print(f"   ✅ 在该文件中共找到 {found_matches} 个media_info相关匹配")
            else:
                print(f"   ❌ 未发现media_info字段")
                
        except Exception as e:
            print(f"   ❌ 读取失败: {e}")
    
    print(f"\n📊 检查完成")

def analyze_encryption_features(text, source_file):
    """分析字段的加密特征"""
    
    analysis = {
        'length': len(text),
        'has_binary': False,
        'has_base64': False, 
        'has_unicode': False,
        'has_url_encoding': False,
        'entropy_level': 'low'
    }
    
    # 检查二进制特征
    if '\\x' in text or re.search(r'[\x00-\x1f\x7f-\xff]', text):
        analysis['has_binary'] = True
        print(f"      📝 特征: 包含二进制数据")
    
    # 检查Base64
    base64_match = re.search(r'(?:[A-Za-z0-9+/]{40,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4}))', text)
    if base64_match:
        analysis['has_base64'] = True
        print(f"      📝 特征: 包含Base64编码: {base64_match.group()[:50]}...")
    
    # 检查Unicode
    if re.search(r'\\u[0-9a-fA-F]{4}', text):
        analysis['has_unicode'] = True
        print(f"      📝 特征: 包含Unicode转义")
    
    # 检查URL编码
    if re.search(r'%[0-9a-fA-F]{2}', text):
        analysis['has_url_encoding'] = True
        print(f"      📝 特征: 包含URL编码")
    
    # 检查长度
    if len(text) > 200:
        analysis['entropy_level'] = 'high'
        print(f"      📝 特征: 长文本，可能是加密数据")
    elif len(text) > 50:
        analysis['entropy_level'] = 'medium'
    
    # 特殊模式检查
    if re.search(r'[0-9a-f]{32,}', text):  # 可能的哈希值
        print(f"      📝 特征: 包含可能的哈希: {re.search(r'[0-9a-f]{{32,}}', text).group()[:20]}...")
    
    if re.search(r'[A-Z0-9]{16,}', text):  # 可能的token
        print(f"      📝 特征: 包含大写字节流: {re.search(r'[A-Z0-9]{{16,}}', text).group()[:20]}...")
    
    return analysis

def check_hex_patterns():
    """直接检查十六进制模式"""
    
    print(f"\n\n🔬 深入检查十六进制模式...")
    
    files_to_check = [
        "../decoded_content_URL解码_20260706_102428.txt",
        "../decoded_content_Unicode解码_20260706_102428.txt"
    ]
    
    for file_path in files_to_check:
        print(f"\n检查 {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                raw_bytes = f.read()
            
            # 转换为HEX字符串
            hex_string = raw_bytes.hex()
            
            # 查找可能的加密数据
            hex_patterns = [
                r'(?:[0-9a-f]{2}){20,}',  # 40+以16进制字符
                r'[0-9a-f]{64,}',  # 长16进制串（可能的SHA256）
                r'(?:7c|3f|f5){10,}'  # 重复模式
            ]
            
            for pattern in hex_patterns:
                matches = re.findall(pattern, hex_string, re.IGNORECASE)
                if matches:
                    print(f"   🎯 发现十六进制模式 ({pattern}): {matches[0][:100]}")
            
            # 检查大文件只显示开头
            if len(hex_string) > 1000:
                print(f"   十六进制开头: {hex_string[:1000]}")
            
        except Exception as e:
            print(f"   ❌ 处理失败: {e}")

if __name__ == "__main__":
    check_encryption_in_response()
    check_hex_patterns()