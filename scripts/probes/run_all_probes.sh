#!/usr/bin/env bash
# 豆包无水印视频 完整探测流程
# 使用前请阅读 README

set -e

cd "$(dirname "$0")"

echo "==============================================="
echo "  豆包无水印视频 完整探测流程"
echo "==============================================="
echo ""

echo "[1/3] 准备 Cookie"
echo "  请在浏览器登录 https://www.doubao.com/"
echo "  F12 → Console → 粘贴: document.cookie"
echo "  把输出粘到下方"
echo ""

if [ ! -f doubao_cookies.json ]; then
  read -p "  Cookie 字符串 (回车跳过): " cookie_input
  if [ -n "$cookie_input" ]; then
    python3 -c "
import json, sys
cookies = []
for kv in sys.argv[1].split('; '):
    if '=' in kv:
        k, v = kv.split('=', 1)
        cookies.append({'name': k, 'value': v})
with open('doubao_cookies.json', 'w', encoding='utf-8') as f:
    json.dump(cookies, f, ensure_ascii=False, indent=2)
print(f'Saved {len(cookies)} cookies')
" "$cookie_input"
  fi
else
  echo "  [OK] doubao_cookies.json 已存在"
fi

echo ""
echo "[2/3] 运行探测脚本"
echo "  - doubao_full_probe.py     (豆包所有端点)"
echo "  - douyin_jianying_probe.py (抖音/剪映)"
echo "  - doubao_enhance_probe.py  (变清晰/增强类)"
echo ""

# 2. 运行探测
if [ -f doubao_cookies.json ]; then
  echo "  [A] 豆包全链路探测..."
  python3 doubao_full_probe.py 2>&1 | tail -30 || echo "  探测失败"
  echo ""
  echo "  [B] 抖音/剪映同步探测..."
  python3 douyin_jianying_probe.py 2>&1 | tail -30 || echo "  探测失败"
  echo ""
  echo "  [C] 变清晰功能探测..."
  python3 doubao_enhance_probe.py 2>&1 | tail -50 || echo "  探测失败"
fi

echo ""
echo "[3/3] 探测结果"
echo "  JSON 结果: doubao_probe_v3_*.json"
echo "  增强扫描: doubao_enhance_scan_*.json"
ls -lh doubao_probe_v3_*.json 2>/dev/null | tail -3
ls -lh doubao_enhance_scan_*.json 2>/dev/null | tail -3

echo ""
echo "==============================================="
echo "  探测完成。检查上述输出和日志文件"
echo "==============================================="
