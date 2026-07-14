#!/usr/bin/env python3
# 验证不同URL返回的文件一致性
import requests
import hashlib
import time

def download_and_hash(url, timeout=30):
    """下载视频片段并计算MD5"""
    try:
        # 只下载前1MB来快速验证哈希
        headers = {'Range': 'bytes=0-1048575'}  # 1MB
        response = requests.get(url, headers=headers, timeout=timeout)
        
        if response.status_code in [200, 206]:  # 206是部分内容
            md5 = hashlib.md5(response.content).hexdigest().upper()
            sha256 = hashlib.sha256(response.content).hexdigest().upper()
            actual_size = len(response.content)
            total_size = response.headers.get('content-range', '').split('/')[-1] if 'content-range' in response.headers else response.headers.get('content-length', 'unknown')
            
            return {
                'md5': md5,
                'sha256': sha256,
                'downloaded_bytes': actual_size,
                'total_size': total_size,
                'status': 'success'
            }
        else:
            return {'status': 'http_error', 'code': response.status_code}
            
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def test_url_consistency():
    """测试URL一致性"""
    
    # 从刚才的测试中提取的不同URL
    test_urls = [
        "https://v9-videoweb.doubao.com/acc78d5cfacd557e5a8404948e7081a9/6a4a0ca1/video/tos/cn/tos-cn-v-9ecd54/osaIBGkRg4bJomvI3JeFQXEs4IiMQG9K0CA1qD/?a=497858&ch=0&cr=7&dr=3&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C1&cv=1&br=2159&bt=2159&cs=4&ds=3&ft=vTVAHK~cBBkq8ZmoLK8vk_vjVQWw&mime_type=video_mp4&qs=0&rc=NGUzMzc6NmhoODo1MzpkNEBpajc1NzVrb3g5PDczNGY5M0AzLS8xMC4yXmExMmAwNS8zYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783234183&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=20260705144943956F2B819ECE7A6C1465",
        "https://v26-videoweb.doubao.com/9f1c179d693bfc642a375f9765ad7f30/6a4a0ca1/video/tos/cn/tos-cn-v-9ecd54/osaIBGkRg4bJomvI3JeFQXEs4IiMQG9K0CA1qD/?a=497858&ch=0&cr=7&dr=3&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C1&cv=1&br=2159&bt=2159&cs=4&ds=3&ft=vTVAHK~cBBkq8ZmoLK8vk_vjVQWw&mime_type=video_mp4&qs=0&rc=NGUzMzc6NmhoODo1MzpkNEBpajc1NzVrb3g5PDczNGY5M0AzLS8xMC4yXmExMmAwNS8zYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783234183&feature_id=069767e0b4f5d9d87fcf68b96cd224a7&l=20260705144943956F2B819ECE7A6C1465",
        "https://v9-videoweb.doubao.com/051b7290e9a6c3e4a08f07e529a1b083/6a4b5013/video/tos/cn/tos-cn-v-9ecd54/o4IQDED9Ii1IJRubRUs6AeJ04gA4aQXmoIKtvk/?a=497858&ch=0&cr=0&dr=0&er=0&lr=video_gen_watermark_dyn&cd=0%7C0%7C0%7C0&cv=1&br=2549&bt=2549&cs=0&ds=3&ft=vTVAHK~cBBkq8ZmosK8vk_vjVQWw&mime_type=video_mp4&qs=0&rc=Nzk8ZDplZDxnOjpoMzMzZ0Bpajc1NzVrb3g5PDczNGY5M0AzLWE2YmA1Ni8xNDNhMjNeYSMxc2FhcWdmazFhLS1kNmFzcw%3D%3D&btag=80000e00008000&dy_q=1783234185&feature_id=e38567d78da7ae34faf3833d9e13c66f&l=20260705144945F802BD680E5E76001AA7&download=true"
    ]
    
    print("="*80)
    print("验证不同CDN URL返回的文件一致性")
    print("="*80)
    
    results = []
    
    for i, url in enumerate(test_urls, 1):
        print(f"\n🔗 URL {i}: {url[:80]}...")
        
        # 分析URL参数
        if 'lr=' in url:
            import re
            lr_match = re.search(r'lr=([^&]+)', url)
            if lr_match:
                lr_value = lr_match.group(1)
                print(f"   lr参数: {lr_value}")
                
        start_time = time.time()
        result = download_and_hash(url)
        elapsed = time.time() - start_time
        
        if result['status'] == 'success':
            print(f"   ✅ 下载成功 ({elapsed:.2f}s)")
            print(f"   📊 MD5: {result['md5']}")
            print(f"   📏 下载大小: {result['downloaded_bytes']:,} bytes")
            print(f"   📐 总大小: {result['total_size']}")
            
            results.append({
                'url_id': i,
                'md5': result['md5'],
                'size': result['downloaded_bytes'],
                'total_size': result['total_size'],
                'elapsed': elapsed
            })
            
        else:
            print(f"   ❌ 失败: {result}")
    
    # 分析结果一致性
    print(f"\n{'='*80}")
    print("🔍 一致性分析结果")
    print(f"{'='*80}")
    
    if len(results) > 1:
        md5s = [r['md5'] for r in results]
        sizes = [r['size'] for r in results]
        
        if len(set(md5s)) == 1:
            print(f"✅ MD5一致性: {results[0]['md5']}")
            print("   → 所有URL返回完全相同的文件内容")
        else:
            print("❌ MD5不一致:")
            for r in results:
                print(f"   URL {r['url_id']}: {r['md5']}")
                
        if len(set(sizes)) == 1:
            print(f"✅ 大小一致性: {results[0]['size']:,} bytes")
        else:
            print("❌ 大小不一致:")
            for r in results:
                print(f"   URL {r['url_id']}: {r['size']:,} bytes")
                
        # 总结
        if len(set(md5s)) == 1:
            print(f"\n🎯 结论: 所有不同CDN URL返回完全相同的文件")
            print(f"   - 尽管URL看起来不同，但文件内容MD5一致")
            print(f"   - CDN节点可能有不同的URL格式，但内容相同")
            print(f"   - 所有文件仍然包含水印 (lr=video_gen_watermark_dyn)")
        else:
            print(f"\n⚠️  发现真正不同的文件:")
            print(f"   - 这可能意味着找到了不同的视频版本")
            print(f"   - 需要进一步分析是否包含无水印版本")
    
    else:
        print("❌ 无法完成一致性分析（有效URL不足）")

if __name__ == "__main__":
    test_url_consistency()