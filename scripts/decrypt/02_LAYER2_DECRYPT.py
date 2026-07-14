#!/usr/bin/env python3
# 第2层 - 多种编码/压缩处理

import gzip
import zlib
import base64
import urllib.parse
import os


def try_gzip(data):
    try:
        return gzip.decompress(data)
    except Exception:
        return None


def try_zlib(data):
    try:
        return zlib.decompress(data)
    except Exception:
        return None


def try_b64(data_bytes):
    try:
        return base64.b64decode(data_bytes)
    except Exception:
        return None


def try_url(data_bytes):
    try:
        s = data_bytes.decode('utf-8', errors='ignore')
        unquoted = urllib.parse.unquote(s)
        return unquoted.encode('utf-8', errors='ignore')
    except Exception:
        return None


def main():
    input_file = 'XOR_DECRYPT_KEY_81.txt'
    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return

    with open(input_file, 'rb') as f:
        data = f.read()

    print(f"输入: {len(data)} 字节")

    # 依次尝试
    res = try_zlib(data)
    if res and len(res) > len(data) * 1.5:
        print(f"Zlib OK: {len(res)} 字节")
    else:
        res = try_gzip(data)
        if res and len(res) > len(data) * 1.5:
            print(f"Gzip OK: {len(res)} 字节")
        else:
            res = try_b64(data)
            if res:
                print(f"Base64 OK: {len(res)} 字节")
            else:
                res = try_url(data)
                if res:
                    print(f"URL OK: {len(res)} 字节")

    if res:
        with open('LAYER2_URL解码_RESULT.txt', 'wb') as out:
            out.write(res if isinstance(res, bytes) else res.encode('utf-8'))
        print(f"已保存 -> LAYER2_URL解码_RESULT.txt")
    else:
        print("无有意义处理")


if __name__ == '__main__':
    main()