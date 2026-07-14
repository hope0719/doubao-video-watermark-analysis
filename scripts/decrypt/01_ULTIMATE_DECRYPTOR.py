#!/usr/bin/env python3
# 豆包视频去水印 - XOR 暴力

import os
import re
import base64


def try_all_keys(data):
    """尝试所有 XOR 密钥，寻找有意义结果"""
    for key in range(256):
        try:
            decrypted = bytes([b ^ key for b in data])
            ascii_count = sum(1 for b in decrypted if 32 <= b < 127)
            ratio = ascii_count / len(decrypted) if decrypted else 0
            if ratio > 0.7:  # 经验阈值
                print(f"找到有意义密钥 {key} (ASCII {ratio:.2%})")
                return key, decrypted
        except Exception:
            continue
    return None, None


def main():
    raw_file = 'get_play_info_raw_response.json'
    if not os.path.exists(raw_file):
        print(f"错误: {raw_file} 不存在")
        return

    with open(raw_file, 'rb') as f:
        data = f.read()

    key, decrypted = try_all_keys(data)
    if key is None:
        print("未找到有意义密钥")
        return

    print(f"XOR 密钥: {key} (0x{key:02x})")
    with open('XOR_DECRYPT_KEY_81.txt', 'wb') as out:
        out.write(decrypted)
    print(f"已保存 {len(decrypted)} 字节 -> XOR_DECRYPT_KEY_81.txt")


if __name__ == '__main__':
    main()