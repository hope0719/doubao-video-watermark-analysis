#!/usr/bin/env python3
# 第3层 - 修复字符重映射/Unicode 损坏

import os


def repair_utf8(data_bytes):
    """处理 ï¿½ U+FFFD"""
    try:
        s = data_bytes.decode('utf-8', errors='replace')
        # 替换 ï¿½
        s = s.replace('\ufffd', '\x00')
        # 重映射
        replacements = [
            ('\xc2\xb7', '*'),
            ('\xc3\x82', ''),
        ]
        for old, new in replacements:
            s = s.replace(old, new)
        return s.encode('utf-8', errors='ignore')
    except Exception as e:
        print(f"错误: {e}")
        return data_bytes


def main():
    input_file = 'LAYER2_URL解码_RESULT.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'rb') as f:
        data = f.read()

    print(f"输入: {len(data)} 字节")
    repaired = repair_utf8(data)
    print(f"修复: {len(repaired)} 字节")

    with open('GOOD_RESULT_字符重映射_1967.txt', 'wb') as out:
        out.write(repaired)
    print(f"已保存 -> GOOD_RESULT_字符重映射_1967.txt")


if __name__ == '__main__':
    main()