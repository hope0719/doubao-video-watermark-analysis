#!/usr/bin/env python3
# 第5层 - 清洗提取可打印 ASCII

import os


def is_printable(c):
    return (32 <= ord(c) < 127)


def main():
    input_file = 'FINAL_SUCCESS_RESULT.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    filtered = ''.join([c for c in text if is_printable(c)])
    print(f"输入: {len(text)}")
    print(f"输出: {len(filtered)}")

    with open('CLEAN_EXTRACTED_DATA.txt', 'w', encoding='utf-8') as out:
        out.write(filtered)
    print(f"已保存 -> CLEAN_EXTRACTED_DATA.txt")


if __name__ == '__main__':
    main()