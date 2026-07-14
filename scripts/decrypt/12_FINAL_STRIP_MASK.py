#!/usr/bin/env python3
# 第12层 - 直接移除 ABCBD 掩码

import os


def main():
    input_file = 'GOOD_RESULT_字符重映射_1967.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    patterns = ['ABC', 'CB', 'BD', 'DA']
    cleaned = text
    for p in patterns:
        before = len(cleaned)
        cleaned = cleaned.replace(p, '')
        after = len(cleaned)
        print(f"移除 {p}: {after} 字符")

    with open('FINAL_STRIP_MASK_cleaned1.txt', 'w', encoding='utf-8') as out:
        out.write(cleaned)
    print(f"已保存 FINAL_STRIP_MASK_cleaned1.txt")


if __name__ == '__main__':
    main()