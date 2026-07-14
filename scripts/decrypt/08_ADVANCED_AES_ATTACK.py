#!/usr/bin/env python3
# 第8层 - 结合 KEY/密文，寻找 AES 配对（16 字节密钥）

import os


def find_aes_candidates(pairs):
    """在 169 对中找 16 字符密钥和高熵value"""
    # 筛选 16 字符 key（可能 AES key）
    keys = []
    values = []
    for k, v in pairs:
        if len(k) == 16 and k.isalnum():
            keys.append(k)
        if len(v) > 20:
            values.append(v)
    return keys, values


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

    keys, values = find_aes_candidates(pairs)
    print(f"候选密钥: {len(keys)}")
    print(f"长值: {len(values)}")

    # 密钥
    with open('AES_KEY_CANDIDATES.txt', 'w', encoding='utf-8') as out:
        for k in keys:
            out.write(f"{k}\n")

    # 配对
    with open('KEY_CIPHERTEXT_PAIRS.txt', 'w', encoding='utf-8') as out:
        for k, v in pairs:
            if len(k) == 16 and len(v) > 20:
                out.write(f"{k}:{v}\n")

    print(f"已保存 AES_KEY_CANDIDATES.txt")
    print(f"已保存 KEY_CIPHERTEXT_PAIRS.txt")


if __name__ == '__main__':
    main()