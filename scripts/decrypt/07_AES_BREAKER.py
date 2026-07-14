#!/usr/bin/env python3
# 第7层 - 高熵 AES 密文提取

import re
import math
import os


def entropy(string):
    """计算字符串熵"""
    freq = {}
    for c in string:
        freq[c] = freq.get(c, 0) + 1
    prob = [freq[c] / len(string) for c in freq]
    return -sum(p * math.log2(p) for p in prob)


def main():
    input_file = 'ALL_KEY_VALUE_PAIRS.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    pairs = []
    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.strip().split(':', 1)
            if len(parts) == 2:
                pairs.append((parts[0], parts[1]))

    # 选择长值（>20）且高熵（>0.7）
    candidates = []
    for k, v in pairs:
        if len(v) > 20 and entropy(v) > 0.7:
            candidates.append(v)

    print(f"169 对 -> {len(candidates)} 高熵")

    if candidates:
        with open('HIGH_ENTROPY_CANDIDATES.txt', 'w', encoding='utf-8') as out:
            for c in candidates:
                out.write(f"{c}\n")
        print(f"已保存 -> HIGH_ENTROPY_CANDIDATES.txt")


if __name__ == '__main__':
    main()