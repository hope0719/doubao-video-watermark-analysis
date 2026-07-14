#!/usr/bin/env python3
# 第6层 - 从清洗后 JSON 提取键值对

import re
import os


def extract_json_pairs(text):
    """正则提取 key:value"""
    pairs = []
    # 双引号
    pattern1 = r'"([^"]+?)"\s*:\s*["]([^"]*)"'
    # 单引号
    pattern2 = r"'([^']+?)'\s*:\s*[']([^']*)'"
    # : 周围
    pattern3 = r'([\w_$][\w_$\d]*)\s*:\s*([^"[{},*\s][^[{},*\s]*)'

    def try_match(pattern):
        matches = re.findall(pattern, text)
        for k, v in matches:
            k = k.strip()
            v = v.strip()
            if len(k) > 1 and len(v) > 1:
                pairs.append((k, v))
        return pairs

    try_match(pattern1)
    try_match(pattern2)
    try_match(pattern3)
    return pairs


def main():
    input_file = 'CLEAN_EXTRACTED_DATA.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    pairs = extract_json_pairs(text)
    print(f"找到 {len(pairs)} 键值对")

    with open('ALL_KEY_VALUE_PAIRS.txt', 'w', encoding='utf-8') as out:
        for i, (k, v) in enumerate(pairs):
            out.write(f"{k}:{v}\n")
    print(f"已保存 -> ALL_KEY_VALUE_PAIRS.txt")


if __name__ == '__main__':
    main()