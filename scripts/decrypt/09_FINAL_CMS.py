#!/usr/bin/env python3
# 第9层 - 分析 3 个密文之间的关联（异或）

import binascii
import base64
import os


def try_decode_b64(s):
    try:
        return base64.b64decode(s)
    except Exception:
        return None


def xor_strings(a, b):
    """异或"""
    return bytes(ai ^ bi for ai, bi in zip(a, b))


def main():
    input_file = 'KEY_CIPHERTEXT_PAIRS.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    pairs = []
    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.strip().split(':', 1)
            if len(parts) == 2:
                pairs.append((parts[0], parts[1]))

    # 筛选字母数字 value
    clean_vals = []
    for k, v in pairs:
        if v.isalnum() and len(v) > 50:
            clean_vals.append(v)
    print(f"字母数字 value: {len(clean_vals)}")

    # 尝试 base64
    for v in clean_vals:
        res = try_decode_b64(v)
        if res:
            print(f"base64 OK: {v[:8]} -> {len(res)} 字节")

    # XOR 3 个
    if len(clean_vals) >= 3:
        xored = xor_strings(clean_vals[0].encode(), clean_vals[1].encode())[:64]
        with open('XOR_3_CIPHERTEXT.txt', 'wb') as out:
            out.write(xored)
        print(f"已保存 XOR_3_CIPHERTEXT.txt")


if __name__ == '__main__':
    main()