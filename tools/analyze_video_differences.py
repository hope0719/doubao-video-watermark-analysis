#!/usr/bin/env python3
# 深入分析不同视频文件的具体差异
import requests
import re

def analyze_video_urls():
    """分析不同视频URL的差异"""
    
    # 基于前面的测试，这些是不同MD5的URL
    different_urls = {
        'URL1': {
            'url': 'https://v9-videoweb.doubao.com/acc78d5cfacd557e5a8404948e7081a9/6a4a0ca1/video/tos/cn/tos-cn-v-9ecd54/osaIBGkRg4bJomvI3JeFQXEs4IiMQG9K0CA1qD/?a=497858&ch=0&cr=7&dr=3&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C1&cv=1&br=2159&bt=2159&cs=4&ds=3&ft=vTVAHK~cBBkq8ZmoLK8vk_vjVQWw&mime_type=video_mp4&qs=0&rc=NGUzMzc6NmhoODo1MzpkNEBpajc1NzVrb3g5PDczNGY5M0AzLS8xMC4yXmExMmAwNS8zYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783234183&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=20260705144943956F2B819ECE7A6C1465',
            'md5': 'FDC029CF564613F3DA3F69DC9308676B',
            'total_size': 2786669,
            'description': '2159kbps, 2.7MB'
        },
        'URL3': {
            'url': 'https://v9-videoweb.doubao.com/051b7290e9a6c3e4a08f07e529a1b083/6a4b5013/video/tos/cn/tos-cn-v-9ecd54/o4IQDED9Ii1IJRubRUs6AeJ04gA4aQXmoIKtvk/?a=497858&ch=0&cr=0&dr=0&er=0&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C0&cv=1&br=2549&bt=2549&cs=0&ds=3&ft=vTVAHK~cBBkq8ZmosK8vk_vjVQWw&mime_type=video_mp4&qs=0&rc=Nzk8ZDplZDxnOjpoMzMzZ0Bpajc1NzVrb3g5PDczNGY5M0AzLWE2YmA1Ni8xNDNhMjNeYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783234185&feature_id=e38567d78da7ae34faf3833d9e13c66f&l=20260705144945F802BD680E5E76001AA7&download=true',
            'md5': 'A8413D3B330030BB2E3EAECE4DB6E8C7', 
            'total_size': 3289007,
            'description': '2549kbps, 3.2MB'
        }
    }
    
    print("="*80)
    print("🔍 不同视频版本详细分析")
    print("="*80)
    
    for name, info in different_urls.items():
        url = info['url']
        print(f"\n📹 {name}: {info['description']}")
        
        # 提取并分析URL参数
        print(f"\n🔧 URL参数分析:")
        
        # 基础参数
        params = {
            'a': re.search(r'[?&]a=(\d+)', url),
            'ch': re.search(r'[?&]ch=(\d+)', url),
            'cr': re.search(r'[?&]cr=(\d+)', url),
            'dr': re.search(r'[?&]dr=(\d+)', url),
            'er': re.search(r'[?&]er=(\d+)', url),
            'lr': re.search(r'[?&]lr=([^&]+)', url),
            'cd': re.search(r'[?&]cd=([^&]+)', url),
            'cv': re.search(r'[?&]cv=(\d+)', url),
            'br': re.search(r'[?&]br=(\d+)', url),
            'bt': re.search(r'[?&]bt=(\d+)', url),
            'cs': re.search(r'[?&]cs=(\d+)', url),
            'ds': re.search(r'[?&]ds=(\d+)', url),
            'ft': re.search(r'[?&]ft=([^&]+)', url),
            'mime_type': re.search(r'[?&]mime_type=([^&]+)', url),
        }
        
        for key, match in params.items():
            if match:
                value = match.group(1)
                print(f"   {key}: {value}")
                
                # 特殊分析
                if key == 'br':  # 码率
                    print(f"      → 视频码率: {int(value)} kbps")
                elif key == 'cr':  # 裁剪
                    print(f"      → 裁剪参数: {value} (可能表示不同的画面区域)")
                elif key == 'dr':  # 可能有特殊含义
                    print(f"      → 距离/位移参数: {value}")
                elif key == 'lr':  # 水印参数
                    if 'unwatermarked' in value:
                        print(f"      → 🎉 找到无水印参数！")
                    else:
                        print(f"      → 水印版本: {value}")
        
        # 视频路径分析
        path_match = re.search(r'https://[^/]+/([^/]+/[^/]+/[^/]+)', url)
        if path_match:
            path = path_match.group(1)
            print(f"\n🗂️  视频路径: {path}")
            
            # 解析路径组件
            path_parts = path.split('/')
            if len(path_parts) >= 3:
                print(f"   域名ID: {path_parts[0]}")
                print(f"   会话ID: {path_parts[1]}")
                print(f"   存储类型: {path_parts[2]}")
        
        print(f"\n📊 文件信息:")
        print(f"   MD5: {info['md5']}")
        print(f"   总大小: {info['total_size']:,} bytes ({info['total_size']/1024/1024:.1f} MB)")
    
    print(f"\n{'='*80}")
    print("🔬 关键差异分析")
    print(f"{'='*80}")
    
    url1_info = different_urls['URL1']
    url3_info = different_urls['URL3']
    
    # 提取参数值避免f-string中的反斜杠
    br1 = re.search(r'br=(\d+)', url1_info['url']).group(1)
    br3 = re.search(r'br=(\d+)', url3_info['url']).group(1)
    cr1 = re.search(r'cr=(\d+)', url1_info['url']).group(1)
    cr3 = re.search(r'cr=(\d+)', url3_info['url']).group(1)
    dr1 = re.search(r'dr=(\d+)', url1_info['url']).group(1)
    dr3 = re.search(r'dr=(\d+)', url3_info['url']).group(1)
    
    print(f"\n🎯 主要差异点:")
    print(f"   1. 视频码率: {int(br1)} vs {int(br3)} kbps")
    print(f"   2. 文件大小: {url1_info['total_size']/1024/1024:.1f} vs {url3_info['total_size']/1024/1024:.1f} MB")
    print(f"   3. 裁剪参数: cr={cr1} vs cr={cr3}")
    print(f"   4. 位移参数: dr={dr1} vs dr={dr3}")
    print(f"   5. 视频路径: 不同CDN路径指向不同文件")
    
    print(f"\n⚠️  重要发现:")
    print(f"   - 所有URL仍然包含 lr=video_gen_watermark_dyn")
    print(f"   - 不同文件可能代表不同码率/质量的版本")
    print(f"   - 但没有发现无水印版本 (lr参数仍然是watermark_dyn)")
    
    print(f"\n💡 结论:")
    print(f"   这些不同的URL代表同一视频的不同编码版本:")
    print(f"   - URL1: 2159kbps, 2.7MB (较低质量)")
    print(f"   - URL3: 2549kbps, 3.2MB (较高质量)")
    print(f"   - 所有版本都包含水印")
    print(f"   - 不同API可能返回不同的质量版本")

def test_new_parameters():
    """测试一些可能的新的无水印参数"""
    
    print(f"\n{'='*80}")
    print("🧪 测试新的可能无水印参数")
    print(f"{'='*80}")
    
    # 基于URL差异推测可能的参数组合
    base_url = "https://www.doubao.com/samantha/media/get_play_info"
    video_id = "v0d69cg10004d946nuiljht2d4d2v44g"
    
    headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://www.doubao.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
    
    params = {
        'version_code': '20800',
        'language': 'zh-CN',
        'device_platform': 'web',
        'aid': '497858',
        'real_aid': '497858',
        'pkg_type': 'release_version',
        'samantha_web': '1',
        'use-olympus-account': '1'
    }
    
    # 测试一些新的参数组合
    test_cases = [
        {
            'name': '创作者下载模式',
            'data': {'key': video_id, 'creator_download': True}
        },
        {
            'name': '原始版本请求',
            'data': {'key': video_id, 'version': 'original'}
        },
        {
            'name': '无水印标志',
            'data': {'key': video_id, 'watermark': False}
        },
        {
            'name': '清理版本',
            'data': {'key': video_id, 'version': 'clean'}
        },
        {
            'name': '源文件请求',
            'data': {'key': video_id, 'format': 'source'}
        },
        {
            'name': '高清无水印',
            'data': {'key': video_id, 'quality': 'hd', 'watermark': False}
        }
    ]
    
    for test_case in test_cases[:3]:  # 只测试前3个避免过多请求
        print(f"\n🧪 测试: {test_case['name']}")
        
        try:
            response = requests.post(
                base_url,
                params=params,
                headers=headers,
                json=test_case['data'],
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # 简单检查响应中是否包含可能的无水印URL
                response_str = str(result).lower()
                if 'unwatermark' in response_str or 'no_watermark' in response_str:
                    print(f"   ⚠️  发现可能的无水印关键词!")
                else:
                    print(f"   📝 响应中未发现明确无水印关键词")
                    print(f"   响应预览: {str(result)[:200]}...")
                    
            else:
                print(f"   ❌ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 异常: {e}")

if __name__ == "__main__":
    analyze_video_urls()
    test_new_parameters()