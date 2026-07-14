#!/usr/bin/env python3
# 第4层 - 分析 ABCBD 5字节重复序列，尝试直接移除

import os
import re


def remove_abc_pattern(text):
    """直接移除 ABCBD 序列"""
    patterns = ['ABC', 'CB', 'BD', 'DA']
    cleaned = text
    for p in patterns:
        before = len(cleaned)
        cleaned = cleaned.replace(p, '')
        after = len(cleaned)
        print(f"移除 {p}: {after} 字符")
    return cleaned


def main():
    input_file = 'GOOD_RESULT_字符重映射_1967.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    print(f"输入: {len(text)} 字符")
    cleaned1 = remove_abc_pattern(text)
    print(f"输出1: {len(cleaned1)} 字符")

    with open('FINAL_SUCCESS_RESULT.txt', 'w', encoding='utf-8') as out:
        out.write(cleaned1)
    print(f"已保存 -> FINAL_SUCCESS_RESULT.txt")


if __name__ == '__main__':
    main()