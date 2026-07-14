#!/usr/bin/env python3
# 第10层 - 尝试 base32 解码

import base64
import base64 as b32
import os


def try_b32(s):
    try:
        s = s.upper().replace(' ', '')
        res = b32.b32decode(s)
        return res
    except Exception:
        return None


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

    # 长于 50 的（可能 base32）
    vals = [v for k, v in pairs if len(v) > 50]
    for v in vals:
        res = try_b32(v)
        if res:
            print(f"base32 OK: {v} -> {len(res)} 字节")
            with open('BASE32_DECODED.bin', 'wb') as out:
                out.write(res)
            print(f"已保存 BASE32_DECODED.bin")
            break


if __name__ == '__main__':
    main()