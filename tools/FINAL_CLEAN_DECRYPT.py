#!/usr/bin/env python3
"""
最终整理版AES解密 - 直接针对长值高熵base64进行暴力
"""
import re
import base64
import binascii

def is_base64(s):
    """检查字符串是否为base64"""
    try:
        # 检查长度
        if len(s) % 4 != 0:
            return False
        # 检查字符集
        if not re.match(r'^[A-Za-z0-9+/]*$', s):
            return False
        # 实际解码测试
        decoded = base64.b64decode(s, validate=True)
        return len(decoded) > 0
    except:
        return False

def bin_to_hex(b):
    """二进制转hex"""
    return b.hex().upper()

def try_aes_bruteforce():
    print("🔥🔥🔥 直接AES暴力破解长值 🔥🔥🔥")
    
    # 3个标准key
    keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    # 要测试的候选（来自KEY_CIPHERTEXT_PAIRS的9个）
    candidates = [
        '~O>=sj^7UvBMG9DLzog/r>H)Y..Qa=(KLyasAe%z9oRSq/*nc8[...',
        '>J#^Hl`Mr4St~n0m&1TNJ[.^g.&nWkU!$g2$@?Ur%J+oq|T+E^O_{KjO#j...',
        'C{7w7h$7~!tnFOq<4Yu_/X`*boFY*llbcF^{\\CW5^q]\'VM8ixjxjGb...',
        'N:u.52v)w?r3]*3\\a\'0x2mMH#iFmvdE?JL\\0KKyOlkhi2j?v"G)I*KCi...',
        'a5yGol^9yb\\uo3K6h{.<4\'ARq}DDI:Z=5./x`%Ood8Ia\\fECaY2>(...',
        'F!O.H/jPg{O>Y4)@7_kv)-9\\Fm/_ss{VwKp~9H~&-0Yi=.A&#$Es[w...',
        'BSQb)@\\l9i~q]eQ3^$awgqFz!M8{C]i%pzrZk%-r\'=~<<daY7R$N\'...',
        'CH?tV(`-zH_b|xA^J08g32:+Ls!|L>K"-^m$JCylo1\\Lr#</Z5:/3eS/|...',
        'DdV0:wt|_Q[Zf%{.XCM:tiTT"LAj07Bjd0o3F(to>}&yg-I+\'5uGbc1VA...'
    ]
    
    # 去除省略号
    clean_candidates = []
    for c in candidates:
        clean = c.replace('...', '')
        # 只保留前1000字符以防过长
        if len(clean) > 1000:
            clean = clean[:1000]
        clean_candidates.append(clean)
    
    print(f"🎯 测试 {len(clean_candidates)} 个候选")
    
    total_tested = 0
    str_b64_success = 0
    str_hex_success = 0
    str_bin_success = 0
    str_success_count = 0
    
    # 遍历所有候选
    for idx, value in enumerate(clean_candidates):
        print(f"\n🎯 测试候选[{idx+1}]: {value[:50]}...")
        print(f"   长度: {len(value)} 字符")
        
        if len(value) <= 1:
            print(f"   ❌ 跳过 (太短)")
            continue
        
        total_tested += 1
        
        # 解码1: 直接base64
        str_b64_decode = None
        if is_base64(value):
            try:
                str_b64_decode = base64.b64decode(value)
                print(f"   ✅ 直接base64成功: {len(str_b64_decode)} 字节")
                str_b64_success += 1
            except Exception as e:
                print(f"   ❌ 直接base64失败: {e}")
        
        else:
            # 解码2: URL解码类型的超集（清理特殊字符）
            # 尝试多种base64字符替换
            str_alt_values = [
                value,  # 原始
                re.sub(r'[^A-Za-z0-9+/=]', '+', value),  # 特殊字符变+
                re.sub(r'[^A-Za-z0-9]', '', value),  # 只留字母数字
                value.replace(' ', '+'),  # 空格变+
            ]
            
            for alt_idx, alt_value in enumerate(str_alt_values):
                if not alt_value:
                    continue
                
                # 补齐到4的倍数
                padding = 4 - (len(alt_value) % 4) % 4
                padded_value = alt_value + ('=' * padding)
                
                if is_base64(padded_value):
                    try:
                        decoded = base64.b64decode(padded_value, validate=True)
                        print(f"   ✅ base64变体{alt_idx+1}成功: {len(decoded)} 字节")
                        str_b64_decode = decoded
                        str_b64_success += 1
                        break
                    except Exception as e:
                        print(f"   ❌ base64变体{alt_idx+1}失败: {e}")
                        continue
        
        # 解码3: 16进制
        str_hex_decode = None
        if re.match(r'^[0-9a-fA-F]+$', value) and len(value) % 2 == 0:
            try:
                str_hex_decode = bytes.fromhex(value)
                print(f"   ✅ 16进制成功: {len(str_hex_decode)} 字节")
                str_hex_success += 1
            except Exception as e:
                print(f"   ❌ 16进制失败: {e}")
        
        # 解码4: 尝试binary8bit到hex再转bytes
        str_bin_decode = None
        # 移除所有可见控制字符
        bin_str = re.sub(r'[\x00-\x20\x7f-\xff]', '', value) if value else ''
        if len(bin_str) > 10:
            # 还是尝试base64
            try:
                padding = 4 - (len(bin_str) % 4) % 4
                padded = bin_str + ('=' * padding)
                decoded = base64.b64decode(padded, validate=True)
                str_bin_decode = decoded
                print(f"   ✅ 8bitbase64成功: {len(decoded)} 字节")
                str_bin_success += 1
            except:
                pass
        
        # 尝试所有成功的解码结果进行AES
        for attempt_idx, (decode_name, decode_bytes) in enumerate([
            ('base64', str_b64_decode),
            ('hex', str_hex_decode),
            ('bin', str_bin_decode)
        ]):
            if not decode_bytes:
                continue
            
            print(f"   \n🔍 尝试AES ({decode_name}): {len(decode_bytes)} 字节")
            
            # 检查block大小
            if len(decode_bytes) % 16 != 0:
                print(f"   ❌ 不是16倍数")
                continue
            
            print(f"   ✅ 符合AES块大小 ({decode_bytes[:16].hex()})")
            
            # 用3个key尝试AES
            for key_idx, key in enumerate(keys):
                try:
                    key_bytes = key.encode('utf-8')
                    
                    # 模式1: ECB
                    try:
                        from Crypto.Cipher import AES
                        cipher = AES.new(key_bytes, AES.MODE_ECB)
                        decrypted_bytes = cipher.decrypt(decode_bytes)
                        
                        print(f"   ✅ AES-ECB[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                        
                        # 尝试解码文本
                        try:
                            text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                            if len(text_result.strip()) > 30:
                                print(f"   🎯 ECB文本: {text_result[:100]}...")
                                
                                # 保存结果
                                success_filename = f"DECRYPT_{decode_name}_ECB_k{key_idx+1}_idx{idx+1}.txt"
                                with open(success_filename, 'w', encoding='utf-8') as f:
                                    f.write(f"解码方式: {decode_name}\nAES模式: ECB\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   💾 保存 {success_filename}")
                                
                                str_success_count += 1
                                
                                # 检查media关键词
                                text_lower = text_result.lower()
                                if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                    print(f"   🎉🎉🎉 MEDIA关键词！")
                                    
                                    with open(f"MEDIA_FOUND_{decode_name}_ECB_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                        f.write(f"🎯 MEDIA信息发现！\n密钥: {key}\n\n")
                                        f.write(text_result)
                                    
                                    print(f"   🎯🎯🎯 MEDIA保存")
                        except Exception as e:
                            print(f"   ❌ ECB文本解码失败: {e}")
                            # 保存二进制
                            with open(f"aes_ecb_k{key_idx+1}_{decode_name}_{idx+1}.bin", 'wb') as f:
                                f.write(decrypted_bytes)
                            print(f"   💾 ECB二进制保存")
                    except Exception as e:
                        print(f"   ❌ AES-ECB[{key_idx+1}]失败: {e}")
                        
                    # 模式2: CBC (key前16字节作IV)
                    try:
                        from Crypto.Cipher import AES
                        iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
                        cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
                        decrypted_bytes = cipher.decrypt(decode_bytes)
                        
                        print(f"   ✅ AES-CBC[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                        
                        # 尝试解码文本
                        try:
                            text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                            if len(text_result.strip()) > 30:
                                print(f"   🎯 CBC文本: {text_result[:100]}...")
                                
                                # 保存结果
                                success_filename = f"DECRYPT_{decode_name}_CBC_k{key_idx+1}_idx{idx+1}.txt"
                                with open(success_filename, 'w', encoding='utf-8') as f:
                                    f.write(f"解码方式: {decode_name}\nAES模式: CBC\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   💾 保存 {success_filename}")
                                
                                str_success_count += 1
                                
                                # 检查media
                                text_lower = text_result.lower()
                                if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                    print(f"   🎉🎉🎉 CBC MEDIA关键词！")
                                    
                                    with open(f"MEDIA_FOUND_{decode_name}_CBC_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                        f.write(f"🎯 CBC MEDIA信息\n密钥: {key}\n\n")
                                        f.write(text_result)
                                    
                                    print(f"   🎯🎯🎯 CBC MEDIA保存")
                        except Exception as e:
                            print(f"   ❌ CBC文本解码失败: {e}")
                            # 保存二进制
                            with open(f"aes_cbc_k{key_idx+1}_{decode_name}_{idx+1}.bin", 'wb') as f:
                                f.write(decrypted_bytes)
                            print(f"   💾 CBC二进制保存")
                    except Exception as e:
                        print(f"   ❌ AES-CBC[{key_idx+1}]失败: {e}")
                
                except Exception as e:
                    print(f"   ❌ AES总体[{key_idx+1}]失败: {e}")
    
    print(f"\n📊 完成: {total_tested} 个候选")
    print(f"   base64: {str_b64_success} 次成功")
    print(f"   hex: {str_hex_success} 次成功")
    print(f"   bin: {str_bin_success} 次成功")
    print(f"   总解密成功: {str_success_count}")

def is_base64(s):
    """检查字符串是否为base64"""
    try:
        # 检查长度
        if len(s) % 4 != 0:
            return False
        # 检查字符集
        if not re.match(r'^[A-Za-z0-9+/]*$', s):
            return False
        # 实际解码测试
        decoded = base64.b64decode(s, validate=True)
        return len(decoded) > 0
    except:
        return False

def bin_to_hex(b):
    """二进制转hex"""
    return b.hex().upper()

def try_aes_bruteforce():
    print("🔥🔥🔥 整理AES暴力 - 只测长且base64 🔥🔥🔥")
    
    # 3个标准key
    keys = [
        'HW2UxdAsG53CHD4_',
        'aDJda58xJOR_UOL6',
        '5my_ycVCnHVwyjX8'
    ]
    
    # 读KEY_CIPHERTEXT_PAIRS.txt得到实际长密文
    with open('/Users/hope/Desktop/个人作品集/豆包视频去水印-技术研究/tools/KEY_CIPHERTEXT_PAIRS.txt', 'r') as f:
        lines = f.read().split('\n')
    
    # 提取所有 Ciphertext 行
    ctext_lines = []
    for line in lines:
        if line.startswith('Ciphertext:'):
            value = line[11:].strip()
            ctext_lines.append(value)
    
    print(f"🎯 从KEY_CIPHERTEXT_PAIRS找到 {len(ctext_lines)} 个密文")
    
    total_tested = 0
    str_b64_success = 0
    str_hex_success = 0
    str_bin_success = 0
    str_success_count = 0
    
    # 遍历密文
    for idx, value in enumerate(ctext_lines):
        print(f"\n🎯 测试候选[{idx+1}]: {value[:50]}...")
        print(f"   长度: {len(value)} 字符")
        
        if len(value) <= 1:
            print(f"   ❌ 跳过 (太短)")
            continue
        
        total_tested += 1
        
        # 解码1: 直接base64
        str_b64_decode = None
        if is_base64(value):
            try:
                str_b64_decode = base64.b64decode(value)
                print(f"   ✅ 直接base64成功: {len(str_b64_decode)} 字节")
                str_b64_success += 1
            except Exception as e:
                print(f"   ❌ 直接base64失败: {e}")
        
        else:
            # 解码2: URL解码类型的超集（清理特殊字符）
            # 尝试多种base64字符替换
            str_alt_values = [
                value,  # 原始
                re.sub(r'[^A-Za-z0-9+/=]', '+', value),  # 特殊字符变+
                re.sub(r'[^A-Za-z0-9]', '', value),  # 只留字母数字
                value.replace(' ', '+'),  # 空格变+
            ]
            
            for alt_idx, alt_value in enumerate(str_alt_values):
                if not alt_value:
                    continue
                
                # 补齐到4的倍数
                padding = 4 - (len(alt_value) % 4) % 4
                padded_value = alt_value + ('=' * padding)
                
                if is_base64(padded_value):
                    try:
                        decoded = base64.b64decode(padded_value, validate=True)
                        print(f"   ✅ base64变体{alt_idx+1}成功: {len(decoded)} 字节")
                        str_b64_decode = decoded
                        str_b64_success += 1
                        break
                    except Exception as e:
                        print(f"   ❌ base64变体{alt_idx+1}失败: {e}")
                        continue
        
        # 解码3: 16进制
        str_hex_decode = None
        if re.match(r'^[0-9a-fA-F]+$', value) and len(value) % 2 == 0:
            try:
                str_hex_decode = bytes.fromhex(value)
                print(f"   ✅ 16进制成功: {len(str_hex_decode)} 字节")
                str_hex_success += 1
            except Exception as e:
                print(f"   ❌ 16进制失败: {e}")
        
        # 解码4: 尝试binary8bit到hex再转bytes
        str_bin_decode = None
        # 移除可见控制字符
        bin_str = re.sub(r'[\x00-\x20\x7f-\xff]', '', value) if value else ''
        if len(bin_str) > 10:
            # 还是尝试base64
            try:
                padding = 4 - (len(bin_str) % 4) % 4
                padded = bin_str + ('=' * padding)
                decoded = base64.b64decode(padded, validate=True)
                str_bin_decode = decoded
                print(f"   ✅ 8bitbase64成功: {len(decoded)} 字节")
                str_bin_success += 1
            except:
                pass
        
        # 尝试所有成功的解码结果进行AES
        for attempt_idx, (decode_name, decode_bytes) in enumerate([
            ('base64', str_b64_decode),
            ('hex', str_hex_decode),
            ('bin', str_bin_decode)
        ]):
            if not decode_bytes:
                continue
            
            print(f"   \n🔍 尝试AES ({decode_name}): {len(decode_bytes)} 字节")
            
            # 检查block大小
            if len(decode_bytes) % 16 != 0:
                print(f"   ❌ 不是16倍数")
                continue
            
            print(f"   ✅ 符合AES块大小 ({decode_bytes[:16].hex()})")
            
            # 用3个key尝试AES
            for key_idx, key in enumerate(keys):
                try:
                    key_bytes = key.encode('utf-8')
                    
                    # 模式1: ECB
                    try:
                        from Crypto.Cipher import AES
                        cipher = AES.new(key_bytes, AES.MODE_ECB)
                        decrypted_bytes = cipher.decrypt(decode_bytes)
                        
                        print(f"   ✅ AES-ECB[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                        
                        # 尝试解码文本
                        try:
                            text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                            if len(text_result.strip()) > 30:
                                print(f"   🎯 ECB文本: {text_result[:100]}...")
                                
                                # 保存结果
                                success_filename = f"DECRYPT_{decode_name}_ECB_k{key_idx+1}_idx{idx+1}.txt"
                                with open(success_filename, 'w', encoding='utf-8') as f:
                                    f.write(f"解码方式: {decode_name}\nAES模式: ECB\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   💾 保存 {success_filename}")
                                
                                str_success_count += 1
                                
                                # 检查media关键词
                                text_lower = text_result.lower()
                                if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                    print(f"   🎉🎉🎉 MEDIA关键词！")
                                    
                                    with open(f"MEDIA_FOUND_{decode_name}_ECB_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                        f.write(f"🎯 MEDIA信息发现！\n密钥: {key}\n\n")
                                        f.write(text_result)
                                    
                                    print(f"   🎯🎯🎯 MEDIA保存  ")
                        except Exception as e:
                            print(f"   ❌ ECB文本解码失败: {e}")
                            # 保存二进制
                            with open(f"aes_ecb_k{key_idx+1}_{decode_name}_{idx+1}.bin", 'wb') as f:
                                f.write(decrypted_bytes)
                            print(f"   💾 ECB二进制保存")
                    except Exception as e:
                        print(f"   ❌ AES-ECB[{key_idx+1}]失败: {e}")
                        
                    # 模式2: CBC (key前16字节作IV)
                    try:
                        from Crypto.Cipher import AES
                        iv = key_bytes[:16] if len(key_bytes) >= 16 else key_bytes + b'\x00' * (16 - len(key_bytes))
                        cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
                        decrypted_bytes = cipher.decrypt(decode_bytes)
                        
                        print(f"   ✅ AES-CBC[{key_idx+1}]成功: {len(decrypted_bytes)} 字节")
                        
                        # 尝试解码文本
                        try:
                            text_result = decrypted_bytes.decode('utf-8', errors='ignore')
                            if len(text_result.strip()) > 30:
                                print(f"   🎯 CBC文本: {text_result[:100]}...")
                                
                                # 保存结果
                                success_filename = f"DECRYPT_{decode_name}_CBC_k{key_idx+1}_idx{idx+1}.txt"
                                with open(success_filename, 'w', encoding='utf-8') as f:
                                    f.write(f"解码方式: {decode_name}\nAES模式: CBC\n密钥: {key}\n\n")
                                    f.write(text_result)
                                
                                print(f"   💾 保存 {success_filename}")
                                
                                str_success_count += 1
                                
                                # 检查media
                                text_lower = text_result.lower()
                                if any(kw in text_lower for kw in ['original', 'media_info', 'url', 'video', 'doubao']):
                                    print(f"   🎉🎉🎉 CBC MEDIA关键词！")
                                    
                                    with open(f"MEDIA_FOUND_{decode_name}_CBC_k{key_idx+1}_idx{idx+1}.txt", 'w', encoding='utf-8') as f:
                                        f.write(f"🎯 CBC MEDIA信息\n密钥: {key}\n\n")
                                        f.write(text_result)
                                    
                                    print(f"   🎯🎯🎯 CBC MEDIA保存  ")
                        except Exception as e:
                            print(f"   ❌ CBC文本解码失败: {e}")
                            # 保存二进制
                            with open(f"aes_cbc_k{key_idx+1}_{decode_name}_{idx+1}.bin", 'wb') as f:
                                f.write(decrypted_bytes)
                            print(f"   💾 CBC二进制保存  ")
                    except Exception as e:
                        print(f"   ❌ AES-CBC[{key_idx+1}]失败: {e}")
                
                except Exception as e:
                    print(f"   ❌ AES总体[{key_idx+1}]失败: {e}")
    
    print(f"\n📊 完成: {total_tested} 个候选")
    print(f"   base64: {str_b64_success} 次成功")
    print(f"   hex: {str_hex_success} 次成功")
    print(f"   bin: {str_bin_success} 次成功")
    print(f"   总解密成功: {str_success_count}")

if __name__ == "__main__":
    try_aes_bruteforce()