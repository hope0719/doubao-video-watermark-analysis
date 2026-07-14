#!/usr/bin/env python3
# 新手友好的数据挖掘工具
# 一步步指导您获取豆包视频数据

import requests
import json
import time
from urllib.parse import quote

class BeginnerTool:
    """
    新手友好的数据挖掘工具
    专为非技术用户提供简单有效的分析方法
    """
    
    def __init__(self):
        self.session = requests.Session()
        self.setup_session()
        
    def setup_session(self):
        """设置简单易用的会话"""
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36'
        })
        
    def step_by_step_guide(self):
        """一步步指导"""
        print("="*60)
        print("🤝 新手友好数据挖掘工具")
        print("="*60)
        
        print("\n🎯 本工具将帮助您在10分钟内获取关键数据")
        print("不需要编程知识，按照提示操作即可")
        
        steps = [
            "📋 输入分享链接",
            "🔍 自动获取基础数据",
            "📊 分析数据特征",
            "💾 保存分析结果",
            "📈 生成简单报告"
        ]
        
        for i, step in enumerate(steps, 1):
            print(f"   {i}. {step}")
        
        print("\n💡 所有操作都是安全的，不会影响您正常使用")
    
    def get_share_link(self):
        """获取分享链接"""
        print("\n🔗 第一步: 输入分享链接")
        print("   (您可以复制豆包的分享链接在这里)")
        
        share_url = input("请输入分享链接: ").strip()
        
        if len(share_url) < 10:
            print("❌ 链接太短，请检查是否完整")
            return None
            
        print(f"✅ 链接获取成功: {share_url[:50]}...")
        return share_url
    
    def basic_analysis(self, share_url):
        """基础分析"""
        print("\n🔍 第二步: 开始分析...")
        print("   系统将自动获取数据，请稍等...")
        
        try:
            print("   📡 建立连接...") 
            response = self.session.get(share_url, timeout=30)
            
            print(f"   📊 获取到数据: {len(response.text)} 字符")
            print(f"   🎯 状态: {'成功' if response.status_code == 200 else '失败'}")
            
            basic_info = {
                'url': share_url,
                'status_code': response.status_code,
                'content_length': len(response.text),
                'content_type': response.headers.get('Content-Type', ''),
                'server': response.headers.get('Server', ''),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return basic_info, response
            
        except Exception as e:
            print(f"   ❌ 分析过程中遇到问题: {e}")
            return None, None
    
    def analyze_content_features(self, response):
        """分析内容特征"""
        print("\n📊 第三步: 分析内容特征...")
        
        content = response.text if response else ""
        
        features = {
            'has_video_keywords': False,
            'has_json_like_content': False,
            'has_script_tags': False,
            'content_completeness': 0,
            'string_count': 0,
            'binary_ratio': 0
        }
        
        # 分析视频相关关键词
        video_keywords = ['video', 'mp4', 'play', 'url', 'cdn', 'doubao']
        found_keywords = []
        
        for keyword in video_keywords:
            if keyword.lower() in content.lower():
                found_keywords.append(keyword)
        
        if found_keywords:
            features['has_video_keywords'] = True
            print(f"   ✅ 发现视频相关关键词: {', '.join(found_keywords)}")
        
        # 分析JSON结构
        if '{' in content and '}' in content and '"' in content:
            features['has_json_like_content'] = True
            print(f"   ✅ 发现JSON类结构")
        
        # 分析脚本标签
        if '<script' in content:
            features['has_script_tags'] = True
            print(f"   ✅ 发现脚本标签")
        
        # 计算内容完整度
        if len(content) > 1000:
            features['content_completeness'] = min(100, int((len(content) / 10000) * 100))
        
        # 分析字符串和疑似二进制内容
        string_chars = sum(1 for c in content if 32 <= ord(c) <= 126)
        features['string_count'] = string_chars
        features['binary_ratio'] = ((len(content) - string_chars) / len(content)) * 100 if content else 0
        
        if features['binary_ratio'] > 50:
            print(f"   🔒 发现加密/压缩内容 (二进制比例: {features['binary_ratio']:.1f}%)")
        else:
            print(f"   📝 主要为文本内容 (可读比例: {100-features['binary_ratio']:.1f}%)")
        
        return features
    
    def find_data_patterns(self, response):
        """查找数据模式"""
        print("\n🔍 第四步: 查找数据模式...")
        
        content = response.text if response else ""
        patterns = {
            'urls': [],
            'video_references': [],
            'special_patterns': []
        }
        
        import re
        
        # 查找任何看起来像URL的内容
        url_pattern = r'https?://[^\s"\'>]{10,}'  
        urls = re.findall(url_pattern, content)
        patterns['urls'] = list(set(urls))[:10]  # 去重，最多10个
        
        if patterns['urls']:
            print(f"   ✅ 找到 {len(patterns['urls'])} 个URL")
            for i, url in enumerate(patterns['urls'][:3]):
                print(f"      {i+1}. {url[:80]}")
        
        # 查找视频相关引用
        video_patterns = [
            r'video["\'][\s\S]*?[:=][\s\S]*?["\']([^"\']{5,})["\']',
            r'play["\'][\s\S]*?[:=][\s\S]*?["\']([^"\']{5,})["\']',
            r'\.mp4[\s"\',]',
            r'cdn[^\s"\'>]{5,}'
        ]
        
        for pattern in video_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            patterns['video_references'].extend(matches[:5])  # 每个模式最多5个
        
        if patterns['video_references']:
            print(f"   ✅ 发现 {len(patterns['video_references'])} 个视频相关引用")
        
        return patterns
    
    def save_analysis_report(self, basic_info, features, patterns):
        """保存分析报告"""
        print("\n💾 第五步: 保存分析结果...")
        
        report = {
            'analysis_timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'basic_info': basic_info,
            'content_features': features,
            'data_patterns': {
                'url_count': len(patterns['urls']),
                'video_ref_count': len(patterns['video_references']),
                'detected_urls': patterns['urls'][:5],
                'sample_findings': patterns['video_references'][:10]
            },
            'conclusions': self.generate_conclusions(features, patterns)
        }
        
        import json
        filename = f"simple_analysis_report_{int(time.time())}.json"
        filepath = f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{filename}"
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            
            print(f"   ✅ 报告保存成功: {filename}")
            return filepath
            
        except Exception as e:
            print(f"   ❌ 保存失败: {e}")
            return None
    
    def generate_conclusions(self, features, patterns):
        """生成简单结论"""
        conclusions = []
        
        # 基于内容特征的结论
        if features['has_video_keywords']:
            conclusions.append("📹 页面可能包含视频相关内容")
        
        if features['binary_ratio'] > 50:
            conclusions.append("🔒 数据经过加密或压缩")
        
        if features['has_json_like_content']:
            conclusions.append("📊 包含结构化数据")
        
        # 基于数据模式的结论
        if patterns['urls']:
            conclusions.append(f"🌐 发现 {len(patterns['urls'])} 个可能的外部资源")
        
        if patterns['video_references']:
            conclusions.append(f"🎬 检测到 {len(patterns['video_references'])} 个视频引用")
        
        return conclusions
    
    def print_final_summary(self, basic_info, features, patterns, report_path):
        """打印最终总结"""
        print("\n" + "="*60)
        print("📋 分析总结")
        print("="*60)
        
        print(f"\n🎯 基本信息:")
        print(f"   ✓ 分析时间: {basic_info.get('timestamp')}")
        print(f"   ✓ 数据大小: {basic_info.get('content_length'):,} 字符")
        print(f"   ✓ 响应状态: {'成功' if basic_info.get('status_code') == 200 else '失败'}")
        
        print(f"\n📊 内容特征:")
        print(f"   ✓ 可读文本: {100-features['binary_ratio']:.1f}%")
        print(f"   ✓ 疑似加密: {features['binary_ratio']:.1f}%")
        print(f"   ✓ 包含视频关键词: {'是' if features['has_video_keywords'] else '否'}")
        
        print(f"\n🔍 发现内容:")
        print(f"   ✓ URL数量: {len(patterns['urls'])}")
        print(f"   ✓ 视频引用: {len(patterns['video_references'])}")
        
        print(f"\n📄 报告文件: {report_path}")
        
        print("\n💡 下一步建议:")
        next_steps = [
            "1. 查看生成的JSON报告文件",
            "2. 重点关注发现的URL列表", 
            "3. 分析加密内容的比例和特征",
            "4. 考虑是否需要更深入的专业分析",
            "5. 结合您使用APK的经验进行对比"
        ]
        
        for step in next_steps:
            print(f"   {step}")
        
        print("\n🎊 首次分析完成！您的数据探索之旅开始了！")


def main():
    """主函数 - 新手友好模式"""
    
    print("""
    ================================================================
    🤝 豆包数据挖掘 - 新手友好工具
    
    🎯 专为非技术用户设计
    📱 提供最简单的数据挖掘方法
    🔍 一步步指导，确保您能成功
    
    💡 您只需要: 电脑 + 浏览器 + 您的分享链接
    ================================================================
    """)
    
    tool = BeginnerTool()
    
    # 显示指南
    tool.step_by_step_guide()
    
    # 获取链接
    share_url = tool.get_share_link()
    if not share_url:
        print("❌ 链接无效，请重新运行程序")
        return
    
    # 基础分析
    basic_info, response = tool.basic_analysis(share_url)
    if not basic_info:
        print("❌ 基础分析失败，请检查链接或网络连接")
        return
    
    # 内容特征分析
    features = tool.analyze_content_features(response)
    
    # 数据模式分析
    patterns = tool.find_data_patterns(response)
    
    # 保存报告
    report_path = tool.save_analysis_report(basic_info, features, patterns)
    
    # 最终总结
    tool.print_final_summary(basic_info, features, patterns, report_path)

if __name__ == "__main__":
    main()