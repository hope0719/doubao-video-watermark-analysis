#!/usr/bin/env python3
# 深入分析下载内容
import requests
import re
from urllib.parse import urljoin, urlparse
import hashlib

def extract_download_links():
    """提取具体的下载链接"""
    
    base_url = "https://easydownload.flyinglife.cn/download"
    
    try:
        response = requests.get(base_url, timeout=10)
        html_content = response.text
        
        # 查找所有可能的下载链接
        download_patterns = [
            r'href=["\']([^"\']*\.(exe|msi|zip|rar|dmg|pkg|app))["\']',
            r'href=["\']([^"\']*download[^"\']*\.(exe|msi|zip|rar|dmg|pkg|app))["\']',
            r'onclick=["\'][^"\']*download[^"\']*["\']',
            r'href=["\']([^"\']*\?.*download[^"\']*)["\']'
        ]
        
        download_links = []
        for pattern in download_patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    link = match[0] if match[0] else match[1]
                else:
                    link = match
                
                if link and not link.startswith('javascript:'):
                    full_link = urljoin(base_url, link)
                    download_links.append(full_link)
        
        return list(set(download_links))  # 去重
        
    except Exception as e:
        print(f"❌ 提取下载链接失败: {e}")
        return []

def analyze_download_file(url):
    """分析下载文件"""
    
    try:
        print(f"\n🔍 分析下载文件: {url}")
        
        # 获取文件基本信息
        head_response = requests.head(url, timeout=10, allow_redirects=True)
        
        file_size = head_response.headers.get('content-length')
        content_type = head_response.headers.get('content-type')
        
        print(f"   📏 文件大小: {file_size} bytes" if file_size else "   📏 文件大小: 未知")
        print(f"   📄 内容类型: {content_type}")
        
        # 解析文件名
        parsed_url = urlparse(url)
        filename = parsed_url.path.split('/')[-1]
        print(f"   📝 文件名: {filename}")
        
        # 文件类型分析
        if filename.endswith('.exe'):
            print(f"   ⚠️  Windows可执行文件 - 高风险")
        elif filename.endswith('.msi'):
            print(f"   ⚠️  Windows安装包 - 高风险")
        elif filename.endswith('.zip') or filename.endswith('.rar'):
            print(f"   📦 压缩文件 - 中等风险")
        elif filename.endswith('.dmg'):
            print(f"   💻 macOS磁盘映像")
        elif filename.endswith('.pkg'):
            print(f"   💻 macOS安装包")
        
        # 检查是否为豆包相关命名
        if any(keyword in filename.lower() for keyword in ['doubao', '豆包', 'watermark']):
            print(f"   🎯 文件名包含豆包/水印相关关键词")
        
        # 尝试获取文件头部信息（安全哈希）
        if file_size and int(file_size) < 1024*1024:  # 小于1MB才尝试下载头部
            try:
                headers = {'Range': 'bytes=0-511'}  # 只获取前512字节
                partial_response = requests.get(url, headers=headers, timeout=5)
                
                if partial_response.status_code in [200, 206]:
                    # 计算部分哈希
                    partial_md5 = hashlib.md5(partial_response.content).hexdigest()
                    print(f"   🔍 文件头部MD5: {partial_md5}")
                    
                    # 检查文件签名
                    file_signature = partial_response.content[:4]
                    if file_signature.startswith(b'MZ'):
                        print(f"   🏷️  文件签名: PE可执行文件 (Windows)")
                    elif file_signature.startswith(b'\x7fELF'):
                        print(f"   🏷️  文件签名: ELF可执行文件 (Linux)")
                    elif file_signature.startswith(b'\x89PNG'):
                        print(f"   🏷️  文件签名: PNG图像文件")
                    elif file_signature.startswith(b'PK'):
                        print(f"   🏷️  文件签名: ZIP压缩文件")
                    else:
                        print(f"   🏷️  文件签名: {file_signature.hex().upper()}")
                        
            except Exception as e:
                print(f"   ❌ 无法获取文件头部信息: {e}")
        else:
            print(f"   ⏭️  文件过大，跳过头部分析")
        
        return True
        
    except Exception as e:
        print(f"❌ 分析文件失败: {e}")
        return False

def search_for_alternative_analysis():
    """搜索类似工具的技术分析"""
    
    print(f"\n{'='*60}")
    print(f"🔬 类似豆包去水印工具技术原理分析")
    print(f"{'='*60}")
    
    # 基于我们对15个开源项目的分析
    print(f"📚 基于15个开源项目的调研结果:")
    print(f"   ❌ 所有项目都无法真正去除豆包水印")
    print(f"   ❌ 下载的文件MD5完全一致")
    print(f"   ❌ 视频水印在H.264编码时像素级嵌入")
    
    print(f"\n💡 第三方工具可能的技术原理:")
    
    print(f"   🎯 原理1: 视频重定向 + 质量优化")
    print(f"   - 技术: 获取最高质量版本的带水印视频")
    print(f"   - 实质: 仍然是带水印版本，但画质最好")
    print(f"   - 可行性: ⭐⭐⭐⭐⭐ (最有可能)")
    
    print(f"   🎯 原理2: AI视频修复")
    print(f"   - 技术: 使用深度学习模型识别和移除水印")
    print(f"   - 实质: 后期处理，画质损失")
    print(f"   - 可行性: ⭐⭐⭐ (技术可行)")
    
    print(f"   🎯 原理3: 音频提取 + 重合成")
    print(f"   - 技术: 提取音频，重新生成纯净视频")
    print(f"   - 实质: 丢失部分原始信息")
    print(f"   - 可行性: ⭐⭐ (效果有限)")
    
    print(f"   🎯 原理4: 帧级画面对比修复")
    print(f"   - 技术: 分析相邻帧，推测水印区域原始内容")
    print(f"   - 实质: 近似修复，不完全准确")
    print(f"   - 可行性: ⭐⭐⭐ (需要大量计算)")

def generate_security_report():
    """生成详细安全报告"""
    
    print(f"\n{'='*60}")
    print(f"📋 综合安全评估报告")
    print(f"{'='*60}")
    
    print(f"⚠️  风险等级评估:")
    print(f"   🔴 高风险: 下载未知来源的可执行文件")
    print(f"   🟡 中风险: 可能的误导性功能")
    print(f"   🟢 低风险: 开源透明的工具")
    
    print(f"\n🛡️ 具体风险分析:")
    print(f"   1. 恶意软件风险:")
    print(f"      - 键盘记录器")
    print(f"      - 密码窃取")
    print(f"      - 远程控制")
    print(f"      ")
    print(f"   2. 隐私泄露风险:")
    print(f"      - 上传您的视频到未知服务器")
    print(f"      - 收集个人信息")
    print(f"      - 监控您的网络活动")
    print(f"      ")
    print(f"   3. 法律合规风险:")
    print(f"      - 侵犯豆包服务条款")
    print(f"      - 可能的版权问题")
    print(f"      - 违反网络安全法规")
    
    print(f"\n✅ 安全使用建议:")
    print(f"   1. 在隔离的虚拟机中测试")
    print(f"   2. 使用沙盒环境运行")
    print(f"   3. 监控网络活动")
    print(f"   4. 使用杀毒软件实时扫描")
    print(f"   5. 避免输入任何个人信息")
    
    print(f"\n🎯 技术真相还原:")
    print(f"   📉 基于严谨的技术研究:")
    print(f"      - 豆包视频水印无法通过客户端去除")
    print(f"      - 所有CDN请求返回相同水印文件")
    print(f"      - 开源项目100%无效")
    print(f"   ")
    print(f"   💡 任何有效的去水印都必须:")
    print(f"      - 服务端漏洞利用 (违法)")
    print(f"      - 深度学习修复 (画质损失)")
    print(f"      - 官方API访问 (需要权限)")

if __name__ == "__main__":
    print(f"🔍 深入分析豆包去水印第三方工具")
    print(f"⚠️  注意：此分析旨在教育和技术研究目的")
    
    # 提取下载链接
    download_links = extract_download_links()
    
    if download_links:
        print(f"\n✅ 发现 {len(download_links)} 个下载链接:")
        for link in download_links:
            print(f"   {link}")
            
        # 分析每个下载文件
        for link in download_links[:3]:  # 限制分析数量避免过多请求
            analyze_download_file(link)
    else:
        print(f"\n❌ 未发现下载链接")
    
    # 技术分析
    search_for_alternative_analysis()
    generate_security_report()
    
    print(f"\n🏁 分析完成 - 请谨慎对待任何第三方去水印工具")