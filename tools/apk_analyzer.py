#!/usr/bin/env python3
# APK文件基础逆向分析
import zipfile
import xml.etree.ElementTree as ET
import re
import hashlib
import os
import subprocess
from pathlib import Path

def analyze_apk_structure():
    """分析APK文件结构"""
    
    apk_path = "/Users/hope/Desktop/个人作品集/ed_1871_sign.apk"
    
    print("="*80)
    print(f"🔍 APK逆向分析: {os.path.basename(apk_path)}")
    print("="*80)
    
    try:
        # 1. 基本文件信息
        print(f"\n📋 APK基本信息:")
        file_size = os.path.getsize(apk_path)
        print(f"   文件大小: {file_size:,} bytes ({file_size/1024/1024:.2f} MB)")
        
        # 计算哈希值
        with open(apk_path, 'rb') as f:
            md5_hash = hashlib.md5(f.read()).hexdigest()
            f.seek(0)
            sha256_hash = hashlib.sha256(f.read()).hexdigest()
        
        print(f"   MD5: {md5_hash}")
        print(f"   SHA256: {sha256_hash}")
        
        # 2. 解压APK（APK本质是ZIP文件）
        print(f"\n📦 解压APK结构:")
        
        extract_dir = "/tmp/apk_analysis"
        os.makedirs(extract_dir, exist_ok=True)
        
        with zipfile.ZipFile(apk_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        print(f"   ✅ 解压到: {extract_dir}")
        
        # 3. 分析文件结构
        print(f"\n📁 APK内部结构:")
        
        total_files = 0
        file_types = {}
        
        for root, dirs, files in os.walk(extract_dir):
            level = root.replace(extract_dir, '').count(os.sep)
            indent = ' ' * 2 * level
            print(f"{indent}📂 {os.path.basename(root)}/")
            
            for file in files:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, extract_dir)
                file_ext = os.path.splitext(file)[1]
                
                total_files += 1
                file_types[file_ext] = file_types.get(file_ext, 0) + 1
                
                # 重要文件特殊处理
                if file in ['AndroidManifest.xml', 'classes.dex', 'resources.arsc']:
                    print(f"{indent}  🔑 {file} (关键文件)")
                elif file_ext in ['.xml', '.dex', '.so', '.png', '.jpg']:
                    print(f"{indent}  📄 {file}")
        
        print(f"\n📊 文件统计:")
        print(f"   总文件数: {total_files}")
        for ext, count in sorted(file_types.items()):
            print(f"   {ext if ext else '无扩展名'}: {count} 个")
        
        return extract_dir
        
    except Exception as e:
        print(f"❌ APK分析失败: {e}")
        return None

def analyze_manifest(extract_dir):
    """分析AndroidManifest.xml"""
    
    print(f"\n{'='*80}")
    print(f"🔧 AndroidManifest.xml 分析")
    print(f"{'='*80}")
    
    manifest_path = os.path.join(extract_dir, "AndroidManifest.xml")
    
    if not os.path.exists(manifest_path):
        print(f"❌ 未找到AndroidManifest.xml")
        return
        
    try:
        # APK中的AndroidManifest.xml是二进制格式，需要特殊处理
        # 先读取原始内容查看结构
        with open(manifest_path, 'rb') as f:
            raw_data = f.read()
        
        print(f"📄 文件大小: {len(raw_data)} bytes")
        
        # 尝试查找可读的字符串
        readable_strings = re.findall(rb'[\x20-\x7e]{4,}', raw_data)
        
        important_info = []
        
        for string_bytes in readable_strings:
            try:
                string_text = string_bytes.decode('utf-8', errors='ignore')
                
                # 寻找重要信息
                if any(keyword in string_text.lower() for keyword in [
                    'doubao', '豆包', 'package', 'activity', 'service', 
                    'receiver', 'permission', 'http', 'api', 'video',
                    'watermark', 'download', 'sign'
                ]):
                    important_info.append(string_text)
                    
            except:
                continue
        
        print(f"🔍 发现的关键字符串:")
        for info in important_info[:20]:  # 限制显示数量
            print(f"   📍 {info}")
            
        if len(important_info) > 20:
            print(f"   ... 还有 {len(important_info) - 20} 个字符串")
        
        return important_info
        
    except Exception as e:
        print(f"❌ Manifest分析失败: {e}")
        return []

def analyze_dex_files(extract_dir):
    """分析DEX字节码文件"""
    
    print(f"\n{'='*80}")
    print(f"🔬 DEX字节码文件分析")
    print(f"{'='*80}")
    
    dex_files = []
    
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            if file.endswith('.dex'):
                dex_files.append(os.path.join(root, file))
    
    if not dex_files:
        print(f"❌ 未发现DEX文件")
        return
        
    print(f"📋 发现的DEX文件:")
    for dex_file in dex_files:
        file_size = os.path.getsize(dex_file)
        print(f"   📄 {os.path.basename(dex_file)} ({file_size:,} bytes)")
    
    # 分析DEX内容
    for dex_file in dex_files:
        print(f"\n🔍 分析: {os.path.basename(dex_file)}")
        
        try:
            with open(dex_file, 'rb') as f:
                dex_data = f.read()
            
            # 查找字符串常量
            strings = re.findall(rb'[\x20-\x7e]{6,}', dex_data)
            
            doubao_related = []
            api_related = []
            video_related = []
            network_related = []
            
            for string_bytes in strings:
                try:
                    string_text = string_bytes.decode('utf-8', errors='ignore')
                    
                    # 分类搜索关键词
                    if any(keyword in string_text.lower() for keyword in ['doubao', '豆包']):
                        doubao_related.append(string_text)
                    elif any(keyword in string_text.lower() for keyword in ['api', 'http', 'url', 'request']):
                        api_related.append(string_text)
                    elif any(keyword in string_text.lower() for keyword in ['video', 'watermark', 'media', 'play']):
                        video_related.append(string_text)
                    elif any(keyword in string_text.lower() for keyword in ['network', 'download', 'client']):
                        network_related.append(string_text)
                        
                except:
                    continue
            
            # 显示发现
            if doubao_related:
                print(f"   🎯 豆包相关字符串:")
                for s in doubao_related[:10]:
                    print(f"      📍 {s}")
            
            if api_related:
                print(f"   🔗 API相关字符串:")
                for s in api_related[:10]:
                    print(f"      📍 {s}")
            
            if video_related:
                print(f"   🎥 视频相关字符串:")
                for s in video_related[:10]:
                    print(f"      📍 {s}")
                    
            if network_related:
                print(f"   🌐 网络相关字符串:")
                for s in network_related[:10]:
                    print(f"      📍 {s}")
                    
        except Exception as e:
            print(f"   ❌ 分析失败: {e}")

def search_for_secrets(extract_dir):
    """搜索可能的密钥或敏感信息"""
    
    print(f"\n{'='*80}")
    print(f"🔐 搜索密钥和敏感信息")
    print(f"{'='*80}")
    
    # 搜索模式
    secret_patterns = [
        (r'api[_-]?key["\']?\s*[=:]\s*["\']([^"\'\s]+)', 'API Key'),
        (r'secret["\']?\s*[=:]\s*["\']([^"\'\s]+)', 'Secret'),
        (r'token["\']?\s*[=:]\s*["\']([^"\'\s]+)', 'Token'),
        (r'password["\']?\s*[=:]\s*["\']([^"\'\s]+)', 'Password'), 
        (r'https?://[^\s"\']+', 'URL'),
    ]
    
    found_secrets = []
    
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            file_path = os.path.join(root, file)
            
            # 只检查文本文件
            if not file.endswith(('.xml', '.txt', '.json', '.properties', '.gradle')):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                for pattern, secret_type in secret_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    for match in matches:
                        found_secrets.append((secret_type, match, file))
                        
            except Exception:
                continue
    
    if found_secrets:
        print(f"⚠️  发现可能的敏感信息:")
        for secret_type, value, source_file in found_secrets:
            if len(value) > 50:  # 过长的截断
                value = value[:47] + "..."
            print(f"   {secret_type}: {value} (来自 {source_file})")
    else:
        print(f"✅ 未发现明显的敏感信息")

def generate_analysis_report(extract_dir, important_info):
    """生成分析报告"""
    
    print(f"\n{'='*80}")
    print(f"📋 APK逆向分析报告")
    print(f"{'='*80}")
    
    print(f"🎯 分析结果总结:")
    print(f"   ✅ APK文件: ed_1871_sign.apk")
    print(f"   ✅ 文件结构: 已成功解压分析")
    print(f"   🔍 Manifest: 发现 {len(important_info)} 个关键字符串")
    print(f"   🔬 DEX文件: 已进行字符串分析")
    print(f"   🔐 安全扫描: 完成")
    
    print(f"\n💡 技术发现:")
    
    doubao_strings = [s for s in important_info if 'doubao' in s.lower() or '豆包' in s]
    if doubao_strings:
        print(f"   🎯 发现豆包相关字符串:")
        for s in doubao_strings[:5]:
            print(f"      - {s}")
    else:
        print(f"   ❓ 未发现明确的豆包相关字符串")
    
    print(f"\n⚠️  重要提醒:")
    print(f"   - APK分析受限于Python工具，深度有限")
    print(f"   - 如需完整源码，需要专业工具（jadx、apktool）")
    print(f"   - 该APK可能经过混淆，增加分析难度")
    print(f"   - 注意法律风险，仅用于学习研究")
    
    print(f"\n🔧 建议后续步骤:")
    print(f"   1. 安装专业APK反编译工具进行深度分析")
    print(f"   2. 分析网络请求逻辑和加密算法")
    print(f"   3. 监控实际应用的网络行为")
    print(f"   4. 对比多个版本的差异")

if __name__ == "__main__":
    print("""
    ===========================================================
    🔒 APK逆向工程分析工具
    ⚠️  注意：仅用于技术研究和学习目的
    ===========================================================
    """)
    
    # 执行分析
    extract_dir = analyze_apk_structure()
    
    if extract_dir:
        important_info = analyze_manifest(extract_dir)
        analyze_dex_files(extract_dir)
        search_for_secrets(extract_dir)
        generate_analysis_report(extract_dir, important_info)
        
        print(f"\n🧹 清理临时文件...")
        try:
            import shutil
            shutil.rmtree(extract_dir)
            print(f"✅ 临时文件已清理")
        except:
            print(f"⚠️ 临时文件清理失败")
    
    print(f"\n🏁 APK分析完成")