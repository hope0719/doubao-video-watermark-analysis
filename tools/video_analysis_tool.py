#!/usr/bin/env python3
# 视频输出分析工具
# 用于分析APK处理后的视频文件，寻找技术特征

import os
import subprocess
import hashlib
from datetime import datetime
import json

class VideoAnalysisTool:
    """
    视频输出分析工具
    分析处理后视频的技术特征，寻找实现技术的线索
    """
    
    def __init__(self):
        self.analysis_results = {}
        self.ffmpeg_path = self._find_ffmpeg()
        
    def _find_ffmpeg(self):
        """查找FFmpeg可执行文件"""
        try:
            result = subprocess.run(['which', 'ffmpeg'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except:
            pass
        
        # 尝试常见路径
        common_paths = [
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg'
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
                
        return None
    
    def calculate_file_hash(self, file_path):
        """计算文件哈希值"""
        
        hashes = {}
        
        try:
            # 计算MD5
            with open(file_path, 'rb') as f:
                md5_hash = hashlib.md5()
                while chunk := f.read(4096):
                    md5_hash.update(chunk)
                hashes['md5'] = md5_hash.hexdigest()
            
            # 计算SHA256
            with open(file_path, 'rb') as f:
                sha256_hash = hashlib.sha256()
                while chunk := f.read(4096):
                    sha256_hash.update(chunk)
                hashes['sha256'] = sha256_hash.hexdigest()
            
            return hashes
            
        except Exception as e:
            print(f"❌ 计算文件哈希失败: {e}")
            return None
    
    def get_video_info(self, file_path):
        """使用FFmpeg获取视频详细信息"""
        
        if not self.ffmpeg_path:
            print("❌ FFmpeg未找到，请安装FFmpeg:")
            print("   macOS: brew install ffmpeg")
            print("   Windows: 下载ffmpeg并添加到环境变量")
            return None
        
        try:
            # 获取视频信息
            cmd = [
                self.ffmpeg_path,
                '-i', file_path,
                '-f', 'ffmetadata',
                '-'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"❌ 获取视频信息失败: {result.stderr}")
                return None
            
            return self._parse_video_info(result.stderr)
            
        except Exception as e:
            print(f"❌ 视频信息分析失败: {e}")
            return None
    
    def _parse_video_info(self, ffmpeg_output):
        """解析FFmpeg输出信息"""
        
        info = {
            'duration': None,
            'bitrate': None,
            'width': None,
            'height': None,
            'fps': None,
            'codec': None,
            'format': None
        }
        
        try:
            lines = ffmpeg_output.split('\n')
            for line in lines:
                line = line.strip()
                
                # 解析基本信息
                if 'Duration:' in line:
                    # 示例: Duration: 00:01:30.00, start: 0.000000, bitrate: 2159 kb/s
                    import re
                    duration_match = re.search(r'Duration: (\d{2}:\d{2}:\d{2}\.\d{2})', line)
                    if duration_match:
                        info['duration'] = duration_match.group(1)
                    
                    bitrate_match = re.search(r'bitrate: (\d+) kb/s', line)
                    if bitrate_match:
                        info['bitrate'] = int(bitrate_match.group(1))
                
                if 'Video:' in line:
                    # 示例: Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, 2159 kb/s, 30 fps
                    import re
                    
                    # 提取编码格式
                    codec_match = re.search(r'Video: (\w+)', line)
                    if codec_match:
                        info['codec'] = codec_match.group(1)
                    
                    # 提取分辨率
                    resolution_match = re.search(r'(\d+)x(\d+)', line)
                    if resolution_match:
                        info['width'] = int(resolution_match.group(1))
                        info['height'] = int(resolution_match.group(2))
                    
                    # 提取帧率
                    fps_match = re.search(r'(\d+(?:\.\d+)?) fps', line)
                    if fps_match:
                        info['fps'] = float(fps_match.group(1))
            
            return info
            
        except Exception as e:
            print(f"❌ 解析视频信息失败: {e}")
            return info
    
    def analyze_file_structure(self, file_path):
        """分析文件结构特征"""
        
        try:
            file_info = {
                'file_path': file_path,
                'file_size': os.path.getsize(file_path),
                'created_time': datetime.fromtimestamp(os.path.getctime(file_path)),
                'modified_time': datetime.fromtimestamp(os.path.getmtime(file_path))
            }
            
            # 读取文件头部（前1024字节）
            with open(file_path, 'rb') as f:
                header = f.read(1024)
                file_info['file_header_hex'] = header.hex()[:100] + '...'
                
                # 检查常见的视频文件标识
                if header.startswith(b'\x00\x00\x00\x20ftyp'):
                    file_info['format_hint'] = 'MP4 container'
                elif header.startswith(b'ftyp'):
                    file_info['format_hint'] = 'QuickTime/MP4'
                elif b'ftypisom' in header:
                    file_info['format_hint'] = 'MP4 (ISO base media)'
                else:
                    file_info['format_hint'] = 'Unknown format'
            
            return file_info
            
        except Exception as e:
            print(f"❌ 文件结构分析失败: {e}")
            return None
    
    def compare_videos(self, original_file, processed_file):
        """比较原始视频和处理后视频"""
        
        print("\n" + "="*60)
        print("🔍 视频对比分析")
        print("="*60)
        
        if not os.path.exists(original_file):
            print(f"❌ 原始文件不存在: {original_file}")
            return None
            
        if not os.path.exists(processed_file):
            print(f"❌ 处理后文件不存在: {processed_file}")
            return None
        
        comparison = {
            'original': {},
            'processed': {},
            'differences': {}
        }
        
        # 分析原始文件
        print("📊 分析原始文件...")
        comparison['original']['hash'] = self.calculate_file_hash(original_file)
        comparison['original']['video_info'] = self.get_video_info(original_file)
        comparison['original']['file_structure'] = self.analyze_file_structure(original_file)
        
        # 分析处理后文件
        print("📊 分析处理后文件...")
        comparison['processed']['hash'] = self.calculate_file_hash(processed_file)
        comparison['processed']['video_info'] = self.get_video_info(processed_file)
        comparison['processed']['file_structure'] = self.analyze_file_structure(processed_file)
        
        # 比较关键差异
        print("🔍 比较关键差异...")
        
        if comparison['original']['video_info'] and comparison['processed']['video_info']:
            orig_info = comparison['original']['video_info']
            proc_info = comparison['processed']['video_info']
            
            comparison['differences']['bitrate_change'] = proc_info['bitrate'] != orig_info['bitrate']
            comparison['differences']['resolution_change'] = (
                proc_info['width'] != orig_info['width'] or 
                proc_info['height'] != orig_info['height']
            )
            comparison['differences']['codec_change'] = proc_info['codec'] != orig_info['codec']
        
        comparison['differences']['hash_different'] = (
            comparison['original']['hash']['md5'] != comparison['processed']['hash']['md5']
        )
        
        # 显示对比结果
        self._display_comparison(comparison)
        
        return comparison
    
    def _display_comparison(self, comparison):
        """显示对比结果"""
        
        print("\n📋 文件基本信息对比:")
        print("   原始文件:")
        if comparison['original']['file_structure']:
            fs = comparison['original']['file_structure']
            print(f"      大小: {fs['file_size']:,} 字节")
            print(f"      格式: {fs['format_hint']}")
            
        print("   处理后文件:")
        if comparison['processed']['file_structure']:
            fs = comparison['processed']['file_structure']
            print(f"      大小: {fs['file_size']:,} 字节")
            print(f"      格式: {fs['format_hint']}")
        
        print("\n📋 视频特征对比:")
        
        if comparison['original']['video_info']:
            orig = comparison['original']['video_info']
            proc = comparison['processed']['video_info']
            
            print(f"   📏 分辨率:")
            print(f"      原始: {orig['width']}x{orig['height']} ({orig['fps']} fps)")
            if proc:
                print(f"      处理: {proc['width']}x{proc['height']} ({proc['fps']} fps)")
            
            print(f"   🎬 编码格式:")
            print(f"      原始: {orig['codec']}")
            if proc:
                print(f"      处理: {proc['codec']}")
            
            print(f"   📊 码率:")
            print(f"      原始: {orig['bitrate']} kb/s")
            if proc:
                print(f"      处理: {proc['bitrate']} kb/s")
        
        print("\n🔍 关键差异分析:")
        diffs = comparison['differences']
        
        print(f"   🔄 文件哈希不同: {diffs['hash_different']}")
        if 'bitrate_change' in diffs:
            print(f"   📊 码率变化: {diffs['bitrate_change']}")
            print(f"   📏 分辨率变化: {diffs['resolution_change']}")
            print(f"   🎬 编码格式变化: {diffs['codec_change']}")
        
        print("\n💡 技术推论:")
        
        # 基于差异进行技术推测
        if diffs['hash_different']:
            print("   ✅ 文件确实被修改过")
            
            if 'codec_change' in diffs and diffs['codec_change']:
                print("   💡 检测到编码格式变化，可能是重新编码")
                print("   🔍 可能的技术路径: 解码 → 去水印修复 → 再编码")
            
            if 'bitrate_change' in diffs and diffs['bitrate_change']:
                print("   💡 检测到码率变化，可能是质量调整")
                print("   🔍 可能的技术路径: 画质优化/压缩")
        
        else:
            print("   ⚠️  文件哈希相同，可能只是元数据修改")
    
    def save_analysis_report(self, comparison, original_file, processed_file):
        """保存分析报告"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"video_analysis_report_{timestamp}.json"
        
        try:
            # 准备报告数据
            report_data = {
                'analysis_timestamp': datetime.now().isoformat(),
                'files': {
                    'original': original_file,
                    'processed': processed_file
                },
                'comparison_results': comparison,
                'analysis_summary': {
                    'files_modified': comparison['differences']['hash_different'],
                    'technical_indicators': self._generate_summary(comparison)
                }
            }
            
            # 保存JSON报告
            with open(f"/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/{report_file}", 'w', encoding='utf-8') as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2)
            
            print(f"\n📄 分析报告已保存: {report_file}")
            
        except Exception as e:
            print(f"❌ 保存报告失败: {e}")
    
    def _generate_summary(self, comparison):
        """生成分析总结"""
        
        summary = []
        
        if comparison['differences']['hash_different']:
            summary.append("文件经过实质性修改")
        
        if 'codec_change' in comparison['differences']:
            if comparison['differences']['codec_change']:
                summary.append("涉及视频重新编码")
        
        if 'bitrate_change' in comparison['differences']:
            if comparison['differences']['bitrate_change']:
                summary.append("视频码率发生变化")
        
        return summary

def main():
    """主函数 - 执行视频分析"""
    
    print("""
    ================================================================
    🎬 豆包视频去水印 - 输出视频分析工具
    分析APK处理后视频的技术特征，寻找实现方式
    ================================================================
    """)
    
    analyzer = VideoAnalysisTool()
    
    # 检查FFmpeg
    if not analyzer.ffmpeg_path:
        print("❌ FFmpeg未安装，请先安装FFmpeg")
        print("   macOS: brew install ffmpeg")
        return
    
    print(f"✅ 检测到FFmpeg: {analyzer.ffmpeg_path}")
    
    # 获取文件路径
    print("\n📁 请输入文件路径:")
    
    original_file = input("   原始视频文件路径: ").strip()
    processed_file = input("   处理后视频文件路径: ").strip()
    
    if not original_file or not processed_file:
        print("❌ 文件路径不能为空")
        return
    
    # 执行分析
    comparison = analyzer.compare_videos(original_file, processed_file)
    
    if comparison:
        # 保存分析报告
        analyzer.save_analysis_report(comparison, original_file, processed_file)
        
        print("\n🎯 分析完成！")
        print("\n💡 后续建议:")
        next_steps = [
            "1. 记录技术特征和观察结果",
            "2. 分析是否涉及重新编码",
            "3. 研究码率/分辨率变化的意义",
            "4. 结合其他分析方法验证推测"
        ]
        
        for step in next_steps:
            print(f"   {step}")
    
    else:
        print("❌ 分析失败，请检查文件有效性")

if __name__ == "__main__":
    main()