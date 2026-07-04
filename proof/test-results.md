# 测试结果记录

> 最后更新: 2026-07-04
> 测试视频: `v0269cg10004d946i5iljhtf2dunr5e0`

## 运行方式

```bash
pip install -r requirements.txt
python3 test_api.py
```

## 预期输出

```
============================================================
  豆包视频去水印 — 技术验证测试
  视频 ID: v0269cg10004d946i5iljhtf2dunr5e0
  分享 ID: 49152711347982082
============================================================

============================================================
测试 1: GET_PLAY_INFO
POST https://www.doubao.com/samantha/media/get_play_info
  original_media_info.main_url: https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn...
  media_info[0].main_url:       https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn...
  ⚠️  两个字段完全相同 — 无水印路径已失效

============================================================
测试 2: GET_VIDEO_SHARE_INFO
POST https://www.doubao.com/creativity/share/get_video_share_info
  play_info.main:   https://v9-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn...
  play_info.backup: https://v26-videoweb.doubao.com/.../?lr=video_gen_watermark_dyn...
  ⚠️  有水印参数

============================================================
测试 3: CDN 文件一致性验证 (etag)
  get_play_info (orig)           etag="5bd9650c..."  size=843802
  get_play_info (media)          etag="5bd9650c..."  size=843802
  share_info (main)              etag="072a67e4..."  size=590370
  share_info (backup)            etag="072a67e4..."  size=590370

  ⚠️  两个不同 etag — get_play_info 和 share_info 返回不同编码版本
  但同一版本内所有 URL 指向同一文件

============================================================
测试 4: URL 参数操控测试
  原始 URL (基准)                etag=5bd9650c...  size=843802
  去掉 lr 参数                   etag=5bd9650c...  size=843802
  lr=none                        etag=5bd9650c...  size=843802
  lr=no_watermark                etag=5bd9650c...  size=843802
  去掉 download                  etag=5bd9650c...  size=843802
  去掉 ft 参数                   etag=5bd9650c...  size=843802
  ft=AAAA (随机)                 etag=5bd9650c...  size=843802
  cr=7&dr=3                      etag=5bd9650c...  size=843802

============================================================
  最终结论
  所有 API 返回的视频 URL 均包含 'video_gen_watermark_dyn' 参数
  所有 URL 参数变体均返回相同文件 (etag 不变)
  视频水印无法通过客户端技术去除
============================================================
```

## 结论

所有测试确认：视频水印在编码阶段嵌入，客户端无去除方案。