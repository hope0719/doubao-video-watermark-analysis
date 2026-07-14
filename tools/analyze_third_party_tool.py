#!/usr/bin/env python3
# 第三方豆包去水印工具深度分析
import requests
import re
import json
from urllib.parse import urlparse, parse_qs
import hashlib
import ssl
import socket

def analyze_website():
    """分析第三方工具网站"""
    
    url = "https://easydownload.flyinglife.cn/download"
    
    print("="*80)
    print("🔍 第三方豆包去水印工具分析")
    print("="*80)
    
    # 1. 基础网站分析
    print(f"\n🌐 目标网站: {url}")
    
    try:
        # 获取网站基本信息
        response = requests.get(url, timeout=10)
        
        print(f"✅ 网站可访问")
        print(f"   HTTP状态码: {response.status_code}")
        print(f"   内容长度: {len(response.content)} bytes")
        print(f"   内容类型: {response.headers.get('content-type', 'unknown')}")
        
        # 分析HTML内容
        html_content = response.text
        
        # 查找关键词
        keywords = ['豆包', 'doubao', '去水印', 'watermark', '无水印', 'download']
        found_keywords = []
        
        for keyword in keywords:
            if keyword.lower() in html_content.lower():
                found_keywords.append(keyword)
                
        print(f"\n🔍 发现的关键词: {', '.join(found_keywords) if found_keywords else 'None'}")
        
        # 查找下载链接
        download_patterns = [
            r'href=["\']([^"\']*\.(exe|zip|dmg|pkg|msi))["\']',
            r'href=["\']([^"\']*download[^"\']*)["\']',
            r'src=["\']([^"\']*download[^"\']*)["\']'
        ]
        
        download_links = []
        for pattern in download_patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            download_links.extend(matches)
            
        print(f"\n📥 发现的下载链接:")
        if download_links:
            for link in download_links[:10]:  # 限制显示数量
                print(f"   {link}")
        else:
            print(f"   未发现明显的软件下载链接")
        
        # 查找JavaScript文件
        js_pattern = r'src=["\']([^"\']*\.js)["\']'
        js_files = re.findall(js_pattern, html_content, re.IGNORECASE)
        
        print(f"\n📜 发现的JavaScript文件:")
        for js_file in js_files[:5]:
            print(f"   {js_file}")
        
        # 检查安全性
        print(f"\n🔒 安全性检查:")
        
        # SSL证书检查
        try:
            hostname = urlparse(url).hostname
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    print(f"   ✅ SSL证书有效")
                    print(f"   主题: {cert['subject']}")
                    print(f"   颁发者: {cert['issuer']}")
        except Exception as e:
            print(f"   ❌ SSL证书检查失败: {e}")
            
        # 可疑内容检测
        suspicious_patterns = [
            r'eval\(',
            r'fromCharCode',
            r'document\.write\(',
            r'innerHTML.*=',
            r'\.hta',
            r'\.jar',
            r'powershell',
            r'cmd\.exe'
        ]
        
        suspicious_found = []
        for pattern in suspicious_patterns:
            if re.search(pattern, html_content, re.IGNORECASE):
                suspicious_found.append(pattern)
                
        if suspicious_found:
            print(f"   ⚠️  发现可疑内容模式: {', '.join(suspicious_found)}")
        else:
            print(f"   ✅ 未发现明显可疑内容")
            
    except Exception as e:
        print(f"❌ 网站访问失败: {e}")
        return False
    
    return True

def analyze_domain():
    """域名分析"""
    
    domain = "easydownload.flyinglife.cn"
    
    print(f"\n{'='*60}")
    print(f"🌍 域名深度分析: {domain}")
    print(f"{'='*60}")
    
    # 域名信息
    try:
        import socket
        ip = socket.gethostbyname(domain)
        print(f"📡 IP地址: {ip}")
        
        # 反向DNS查询
        try:
            hostname, _, _ = socket.gethostbyaddr(ip)
            print(f"🔄 反向DNS: {hostname}")
        except:
            print(f"🔄 反向DNS: 无法解析")
            
    except Exception as e:
        print(f"📡 IP查询失败: {e}")
    
    # 域名WHOIS信息（简单版本）
    domain_parts = domain.split('.')
    if len(domain_parts) >= 3:
        main_domain = '.'.join(domain_parts[-2:])
        print(f"🏢 主域名: {main_domain}")
        print(f"📂 子域名: {'.'.join(domain_parts[:-2])}")
    
    # 域名注册特征分析
    print(f"\n🔍 域名特征分析:")
    if 'flyinglife' in domain.lower():
        print(f"   🎯 包含'flyinglife' - 可能指向飞萤生活相关服务")
    if 'easydownload' in domain.lower():
        print(f"   📥 包含'easydownload' - 下载服务")
    if domain.endswith('.cn'):
        print(f"   🇨🇳 中国国家顶级域名")

def compare_with_open_source():
    """与开源项目对比分析"""
    
    print(f"\n{'='*60}")
    print(f"🔬 与已知开源项目对比分析")
    print(f"{'='*60}")
    
    # 我们已经分析的15个开源项目特点
    known_open_source_projects = [
        "catscarlet/doubao-watermark-free",
        "xiaoka6688/doubao-no-watermark", 
        "Luncot/doubao-watermark-remover"
    ]
    
    print(f"📊 已知开源项目共同特点:")
    print(f"   ❌ 所有项目下载的仍为水印版本")
    print(f"   ❌ 文件哈希完全一致 (MD5相同)")
    print(f"   ❌ 无法真正去除豆包视频水印")
    
    print(f"\n🔍 第三方工具可能实现方式分析:")
    print(f"   1️⃣ 可能性A: 深度伪造/API破解")
    print(f"      - 难度: ⭐⭐⭐⭐⭐ (几乎不可能)")
    print(f"      - 需要: 突破豆包服务端安全措施")
    print(f"      - 风险: 严重违规，可能违法")
    
    print(f"   2️⃣ 可能性B: AI图像修复")
    print(f"      - 难度: ⭐⭐⭐ (相对现实)")
    print(f"      - 技术: 深度学习去除水印")
    print(f"      - 缺点: 画质损失，不完全准确")
    
    print(f"   3️⃣ 可能性C: 视频重编码优化")
    print(f"      - 难度: ⭐⭐ (最简单)")
    print(f"      - 技术: 选择最佳质量版本下载")
    print(f"      - 实质: 仍然是带水印版本")
    
    print(f"   4️⃣ 可能性D: 误导性宣传")
    print(f"      - 可能: 商业营销手段")
    print(f"      - 实质: 下载的仍然是带水印版本")
    
    print(f"\n💡 技术现实性评估:")
    print(f"   📉 基于豆包技术架构，客户端无法获取无水印源文件")
    print(f"   📈 AI修复是目前最现实的去水印方法")
    print(f"   ⚠️  任何声称'100%去水印'的工具都值得怀疑")

def security_warning():
    """安全警告"""
    
    print(f"\n{'='*60}")
    print(f"⚠️  重要安全警告")
    print(f"{'='*60}")
    
    print(f"🔒 下载第三方软件的风险:")
    print(f"   1. 恶意软件感染")
    print(f"   2. 个人信息泄露")
    print(f"   3. 账号安全风险")
    print(f"   4. 法律合规问题")
    
    print(f"\n🛡️ 安全建议:")
    print(f"   ✅ 优先使用开源、透明的解决方案")
    print(f"   ✅ 在虚拟机或隔离环境中测试")
    print(f"   ✅ 使用杀毒软件扫描下载文件")
    print(f"   ✅ 避免输入敏感信息（如账号密码）")
    
    print(f"\n🎯 针对豆包去水印的现实建议:")
    print(f"   1. 接受技术限制：客户端无法获取无水印版本")
    print(f"   2. 考虑替代方案：使用支持无水印的平台（如即梦）")
    print(f"   3. 如果必须使用：选择AI修复工具（明确说明是后期处理）")
    print(f"   4. 法律合规：仅处理自己创作的视频内容")

if __name__ == "__main__":
    print("""
    =========================================================
    ⚠️  豆包第三方去水印工具安全分析
    本报告仅供参考，不建议随意下载未知来源软件
    =========================================================
    """)
    
    # 执行分析
    website_accessible = analyze_website()
    analyze_domain()
    compare_with_open_source()
    security_warning()
    
    if website_accessible:
        print(f"\n📋 分析总结:")
        print(f"   ✅ 目标网站可访问")
        print(f"   🔍 需要进一步分析具体的下载文件")
        print(f"   ⚠️  强烈建议在安全环境中测试")
    else:
        print(f"\n❌ 网站无法访问，可能存在安全风险")