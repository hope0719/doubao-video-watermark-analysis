# Doubao Video Watermark Removal - Full Decryption Report

## 1. 攻击流程简述（多层解密）

### 第0层：原始数据
- get_play_info 响应，165 KB JSON

### 第1层：XOR 0x81
- ULTIMATE_DECRYPTOR.py: 找到密钥 0x81
- 生成长度 165 KB XOR 数据

### 第2层：编码与压缩
- LAYER2_DECRYPT.py: 尝试 gzip/zlib/b64/url 解码
- 生成 142 KB 文本

### 第3层：Unicode 修复
- LAYER3_DESTROYER.py: 处理 ï¿½ 错误
- 字符重映射还原

### 第4层：ABCBD 序列处理
- LAYER4_FINAL_DESTROYER.py: 分析 ABCBD 重复模式
- ABCBD 可能为混淆

### 第5层：提取与清洗
- CLEAN_EXTRACTED.py: 过滤 ASCII 有效字符
- 得到 20,025 字符合法文本

### 第6层：键值对分析
- KEY_VALUE_MINER.py: 从清洗后 JSON 抽取 169 个 key-value 对

### 第7层：高熵密文提取
- AES_BREAKER.py: 找到长高熵字符串

### 第8层：AES 特征分析
- ADVANCED_AES_ATTACK.py: 找到 AES 特征，候选密钥 3 个：
  - HW2UxdAsG53CHD4_
  - aDJda58xJOR_UOL6
  - 5my_ycVCnHVwyjX8

### 第9层：多 base64/b32 解码
- FINAL_CMS.py: 从 9 个候选中，3 个可字母数字 base64 解码
- FINAL_BASES.py: 发现 base32 可解码
  - 值 C7w7h7tnFOq4YuXboFYllbcFCW5qVM8ixjxjGb 可 base32，得 23 字节

## 2. 关键脚本

### 2.1 核心解密工具

#### ULTIMATE_DECRYPTOR.py
将原始 JSON 逐字节 XOR 暴力破解，找到 `0x81` 密钥

#### LAYER2_DECRYPT.py
尝试 Gzip/Zlib/Base64/URL 编码，发现中间数据进一步解码

#### LAYER3_DESTROYER.py
处理 UTF-8 损坏（ï¿½），字符重映射还原原始字节

#### LAYER4_FINAL_DESTROYER.py
分析 ABCBD 5 字符模式，移除混淆

#### CLEAN_EXTRACTED.py
过滤可打印 ASCII，提取原始 JSON 结构

#### KEY_VALUE_MINER.py
使用正则解析 JSON 键值对，找到 169 个 key-value

#### AES_BREAKER.py
计算熵值，识别 AES 密文候选（高熵字符串）

#### ADVANCED_AES_ATTACK.py
匹配 AES 密钥与密文，生成 AES_KEY_CANDIDATES.txt、KEY_CIPHERTEXT_PAIRS.txt

#### FINAL_CMS.py
分析密文间 XOR 关系，寻找明文线索

#### FINAL_BASES.py
尝试 base32 解码，发现 1 个可 base32 项

#### FINAL_DECRYPT_BASE32.py
对 base32 结果（23 字节）尝试 AES 解密，尝试 ECB/CBC

#### FINAL_STRIP_MASK.py
直接移除 ABCBD 掩码（'ABC'、'CB'、'BD'、'DA' 全部替换为空）

## 3. 关键文件

| 文件 | 大小 | 描述 |
|---|---|---|
| XOR_DECRYPT_KEY_81.txt | 165 KB | XOR 解码后数据 |
| LAYER2_URL解码_RESULT.txt | 142 KB | URL/文本处理后 |
| GOOD_RESULT_字符重映射_1967.txt | 120 KB | 字符重映射后 |
| CLEAN_EXTRACTED_DATA.txt | 20 KB | 清洗后合法文本 |
| ALL_KEY_VALUE_PAIRS.txt | 4 KB | 169 个键值对 |
| KEY_CIPHERTEXT_PAIRS.txt | 900 B | 9 个高熵配对 |
| AES_KEY_CANDIDATES.txt | 100 B | 3 个 AES 候选密钥 |
| HIGH_ENTROPY_CANDIDATES.txt | 200 B | 105 个高熵密文 |
| FINAL_SUCCESS_RESULT.txt | 120 KB | ABCBD 处理中间 |
| FINAL_STRIP_MASK_cleaned1.txt | 9 KB | 清洗后候选明文 |

## 4. 已尝试方法

1. 多层 XOR 暴力
2. 多种编码（Gzip/Zlib/Base64/URL/Base32）
3. Unicode 损坏修复（ï¿½ -> 0x00）
4. 重复序列分析（ABCBD 5 字节模式）
5. 字符重映射（移位、替换）
6. 正则提取 JSON 键值对
7. 熵分析识别 AES 特征
8. AES ECB/CBC 暴力
9. XOR 两两（hex1^hex2）
10. 三层 base64 解码（原始 > base64 > hex > b32）
11. Base32 解码 23 字节后 AES
12. 直接移除 ABCBD 掩码

## 5. 深度技术细节

### 5.1 密文特征

- 候选密文（KEY_CIPHERTEXT_PAIRS.txt）：
  - `~O>=sj^7UvBMG9...` (55 字符)
  - `>J#^Hl`Mr4St~n...` (61 字符)
  - `C{7w7h$7~!tn...` (57 字符)
  - `N:u.52v)w?r...` (56 字符)
  - `a5yGol^9yb...` (56 字符)
  - `F!O.H/jPg{...` (57 字符)
  - `BSQb)@\l9i...` (56 字符)
  - `CH?tV(`-zH...` (60 字符)
  - `DdV0:wt|_Q...` (60 字符)

### 5.2 AES 候选

- 密钥（均 16 字节）：
  - `HW2UxdAsG53CHD4_`
  - `aDJda58xJOR_UOL6`
  - `5my_ycVCnHVwyjX8`

### 5.3 Base32 解码

- `C7w7h7tnFOq4YuXboFYllbcFCW5qVM8ixjxjGb` -> Base32 -> 23 字节 hex:
  - `17edf3fe6d2ba1cc52e17170b5844515bb0ab1174dd260`

### 5.4 关键数据流

- 165 KB JSON
  - XOR 0x81
    - 165 KB
      - gzip/zlib/b64/url
        - 142 KB 文本
          - 字符重映射
            - 120 KB
              - ABCBD 分析
                - 20 KB 清洗后
                  - 正则提取 169 key-value
                    - 高熵 9 配对
                      - base64/xor/xor
                        - AES 暴力
                          - Base32 解码 23 字节
                            - AES 尝试

## 6. 清理摘要

已排除方法：FFmpeg/AI 修复。未分析方向：
- 原始 JSON 结构（可能字段名重命名）
- JS 代码混淆（需AJAX Hook）

## 7. 日志与输出

见 `tools/` 目录下所有 `.txt` 文件。

## 8. Chrome 扩展

`chrome-extension/` 目录包含请求拦截器，用于直接捕获响应体。

## 9. 参考文献

无。