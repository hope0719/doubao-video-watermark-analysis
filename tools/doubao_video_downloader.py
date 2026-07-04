#!/usr/bin/env python3
"""
豆包视频去水印下载工具
作者: Technical Analysis
版本: 1.0.0
日期: 2026-07-04

使用方法:
    python doubao_video_downloader.py <分享链接>
    python doubao_video_downloader.py <分享链接> -o 输出文件名.mp4
    
示例:
    python doubao_video_downloader.py "https://www.doubao.com/video-sharing?video_id=v0d69cg10004d946nuiljht2d4d2v44g"

注意事项:
    1. 仅供学习研究使用
    2. 请遵守豆包平台服务条款
    3. 尊重内容创作者版权
    4. 部分视频可能需要登录态Cookie
"""

import sys
import re
import json
import argparse
import requests
from urllib.parse import urlparse, parse_qs
from pathlib import Path


class DoubaoVideoDownloader:
    """豆包视频下载器"""
    
    def __init__(self, cookies=None, verbose=False):
        """
        初始化下载器
        
        Args:
            cookies: Cookie字典，用于身份验证
            verbose: 是否显示详细信息
        """
        self.api_url = "https://www.doubao.com/samantha/media/get_play_info"
        self.session = requests.Session()
        self.verbose = verbose
        
        if cookies:
            self.session.cookies.update(cookies)
    
    def log(self, message):
        """打印日志信息"""
        if self.verbose:
            print(f"[LOG] {message}")
    
    def extract_video_id(self, share_url):
        """
        从分享链接提取video_id
        
        Args:
            share_url: 豆包视频分享链接
            
        Returns:
            video_id字符串
            
        Raises:
            ValueError: 如果无法提取video_id
        """
        self.log(f"解析URL: {share_url}")
        
        # 方法1: URL参数解析
        try:
            parsed = urlparse(share_url)
            params = parse_qs(parsed.query)
            video_id = params.get('video_id', [None])[0]
            if video_id:
                self.log(f"提取到video_id: {video_id}")
                return video_id
        except Exception as e:
            self.log(f"URL参数解析失败: {e}")
        
        # 方法2: 正则表达式
        pattern = r'video_id=([a-zA-Z0-9_-]+)'
        match = re.search(pattern, share_url)
        if match:
            video_id = match.group(1)
            self.log(f"正则提取到video_id: {video_id}")
            return video_id
        
        raise ValueError("无法从链接中提取video_id，请检查链接格式")
    
    def get_video_info(self, video_id):
        """
        获取视频信息（包含无水印视频URL）
        
        Args:
            video_id: 视频ID
            
        Returns:
            包含视频信息的字典
            
        Raises:
            Exception: 如果API调用失败
        """
        self.log("准备调用API获取视频信息")
        
        # API参数
        params = {
            'version_code': '20800',
            'language': 'zh-CN',
            'device_platform': 'web',
            'aid': '497858',
            'real_aid': '497858',
            'pkg_type': 'release_version',
            'device_id': '',
            'pc_version': '2.51.7',
            'region': '',
            'sys_region': '',
            'samantha_web': '1',
            'use-olympus-account': '1',
            'web_tab_id': ''
        }
        
        # 请求头
        headers = {
            'Content-Type': 'application/json',
            'Origin': 'https://www.doubao.com',
            'Referer': 'https://www.doubao.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
        
        # 请求体
        data = {'key': video_id}
        
        self.log(f"发送POST请求到: {self.api_url}")
        self.log(f"请求参数: {json.dumps(params, ensure_ascii=False)}")
        self.log(f"请求体: {json.dumps(data, ensure_ascii=False)}")
        
        try:
            response = self.session.post(
                self.api_url,
                params=params,
                headers=headers,
                json=data,
                timeout=30
            )
            
            self.log(f"响应状态码: {response.status_code}")
            
            response.raise_for_status()
            result = response.json()
            
            self.log(f"响应内容: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}...")
            
            # 检查响应数据
            if 'data' not in result:
                raise Exception("API响应缺少data字段")
            
            if 'original_media_info' not in result['data']:
                raise Exception("API响应缺少original_media_info字段，可能需要登录")
            
            if 'main_url' not in result['data']['original_media_info']:
                raise Exception("API响应缺少main_url字段")
            
            video_info = {
                'video_id': video_id,
                'video_url': result['data']['original_media_info']['main_url'],
                'duration': result['data'].get('duration', 0),
                'width': result['data']['original_media_info'].get('width', 0),
                'height': result['data']['original_media_info'].get('height', 0),
                'size': result['data']['original_media_info'].get('size', 0)
            }
            
            self.log(f"视频信息: {json.dumps(video_info, ensure_ascii=False, indent=2)}")
            
            return video_info
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"JSON解析失败: {e}")
        except KeyError as e:
            raise Exception(f"响应数据格式错误: {e}")
    
    def download_video(self, video_url, output_path, show_progress=True):
        """
        下载视频到本地
        
        Args:
            video_url: 视频下载URL
            output_path: 输出文件路径
            show_progress: 是否显示下载进度
        """
        print(f"\n📥 开始下载视频...")
        print(f"📍 保存路径: {output_path}")
        
        try:
            # 发送请求
            response = self.session.get(
                video_url,
                stream=True,
                timeout=60,
                headers={
                    'Referer': '',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            )
            
            response.raise_for_status()
            
            # 获取文件大小
            total_size = int(response.headers.get('content-length', 0))
            
            if total_size > 0:
                total_mb = total_size / (1024 * 1024)
                print(f"📦 文件大小: {total_mb:.2f} MB")
            
            # 下载文件
            downloaded = 0
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        # 显示进度
                        if show_progress and total_size > 0:
                            percent = (downloaded / total_size) * 100
                            downloaded_mb = downloaded / (1024 * 1024)
                            bar_length = 40
                            filled_length = int(bar_length * downloaded // total_size)
                            bar = '█' * filled_length + '░' * (bar_length - filled_length)
                            print(f"\r进度: [{bar}] {percent:.1f}% ({downloaded_mb:.2f}/{total_mb:.2f} MB)", end='')
            
            if show_progress:
                print()  # 换行
            
            print(f"✅ 下载完成: {output_path}")
            
            # 验证文件
            file_size = Path(output_path).stat().st_size
            if file_size == 0:
                raise Exception("下载的文件大小为0，下载可能失败")
            
            print(f"✓ 文件大小: {file_size / (1024 * 1024):.2f} MB")
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"下载失败: {e}")
        except IOError as e:
            raise Exception(f"文件写入失败: {e}")
    
    def process(self, share_url, output_path=None):
        """
        处理完整的下载流程
        
        Args:
            share_url: 豆包视频分享链接
            output_path: 输出文件路径（可选）
            
        Returns:
            输出文件路径
        """
        print("\n" + "="*60)
        print("🎬 豆包视频去水印下载工具")
        print("="*60)
        
        # 1. 提取video_id
        print("\n📌 步骤 1/3: 解析视频ID")
        video_id = self.extract_video_id(share_url)
        print(f"✓ Video ID: {video_id}")
        
        # 2. 获取视频信息
        print("\n📌 步骤 2/3: 获取视频信息")
        video_info = self.get_video_info(video_id)
        print(f"✓ 视频URL: {video_info['video_url'][:80]}...")
        
        if video_info.get('width') and video_info.get('height'):
            print(f"✓ 分辨率: {video_info['width']}x{video_info['height']}")
        
        if video_info.get('duration'):
            duration_sec = video_info['duration'] / 1000
            print(f"✓ 时长: {duration_sec:.1f}秒")
        
        # 3. 下载视频
        print("\n📌 步骤 3/3: 下载视频")
        
        if output_path is None:
            output_path = f"{video_id}-无水印.mp4"
        
        self.download_video(video_info['video_url'], output_path)
        
        print("\n" + "="*60)
        print("🎉 所有操作完成！")
        print("="*60 + "\n")
        
        return output_path


def parse_cookies_string(cookie_string):
    """
    解析Cookie字符串为字典
    
    Args:
        cookie_string: Cookie字符串，格式如 "key1=value1; key2=value2"
        
    Returns:
        Cookie字典
    """
    cookies = {}
    for item in cookie_string.split(';'):
        item = item.strip()
        if '=' in item:
            key, value = item.split('=', 1)
            cookies[key.strip()] = value.strip()
    return cookies


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='豆包视频去水印下载工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python doubao_video_downloader.py "https://www.doubao.com/video-sharing?video_id=xxx"
  python doubao_video_downloader.py "分享链接" -o my_video.mp4
  python doubao_video_downloader.py "分享链接" -c "sessionid=xxx; uid=xxx"
  python doubao_video_downloader.py "分享链接" --verbose

注意事项:
  1. 仅供学习研究使用
  2. 请遵守豆包平台服务条款
  3. 尊重内容创作者版权
  4. 部分视频可能需要登录态Cookie
        """
    )
    
    parser.add_argument(
        'url',
        help='豆包视频分享链接'
    )
    
    parser.add_argument(
        '-o', '--output',
        help='输出文件路径（默认：video_id-无水印.mp4）',
        default=None
    )
    
    parser.add_argument(
        '-c', '--cookies',
        help='Cookie字符串（格式：key1=value1; key2=value2）',
        default=None
    )
    
    parser.add_argument(
        '-v', '--verbose',
        help='显示详细日志信息',
        action='store_true'
    )
    
    args = parser.parse_args()
    
    # 解析Cookie
    cookies = None
    if args.cookies:
        cookies = parse_cookies_string(args.cookies)
        if args.verbose:
            print(f"[LOG] 加载Cookie: {list(cookies.keys())}")
    
    # 创建下载器
    downloader = DoubaoVideoDownloader(
        cookies=cookies,
        verbose=args.verbose
    )
    
    # 执行下载
    try:
        downloader.process(args.url, args.output)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
