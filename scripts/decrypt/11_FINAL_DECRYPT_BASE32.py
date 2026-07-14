#!/usr/bin/env python3
# 第11层 - 对 base32 结果尝试 AES 暴力解密

from Crypto.Cipher import AES
import os
import binascii


def pad(data):
    """PKCS7"""
    length = 16 - (len(data) % 16)
    return data + bytes([length] * length)


def unpad(data):
    return data[:-data[-1]]


def try_aes_key(key, ciphertext):
    """尝试所有模式"""
    try:
        # ECB
        cipher = AES.new(key, AES.MODE_ECB)
        res = unpad(cipher.decrypt(ciphertext))
        if res[:16].isalnum():
            print(f"ECB OK: {res[:16]}")
        else:
            print(f"ECB OK: {res[:16]} (非字母数字)")
        # CBC (IV=0)
        iv = bytes(16)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        res = unpad(cipher.decrypt(ciphertext))
        if res[:16].isalnum():
            print(f"CBC OK: {res[:16]}")
        else:
            print(f"CBC OK: {res[:16]} (非字母数字)")
    except Exception:
        return


def main():
    input_file = 'BASE32_DECODED.bin'
    key_file = 'AES_KEY_CANDIDATES.txt'

    if not os.path.exists(input_file):
        print(f"错误: {input_file} 不存在")
        return
    if not os.path.exists(key_file):
        print(f"错误: {key_file} 不存在")
        return

    ciphertext = open(input_file, 'rb').read()
    print(f"Ciphertext: {len(ciphertext)} 字节")

    keys = []
    with open(key_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            keys.append(line.strip())

    for k in keys:
        print(f"尝试 {k}")
        key_bytes = k.encode('utf-8')
        try_aes_key(key_bytes, ciphertext)


if __name__ == '__main__':
    main()