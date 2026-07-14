/**
 * 豆包去水印 - 浏览器扩展 API 模块
 * 支持平台：豆包 / 通义千问 / 即梦(Dreamina)
 * 使用 fetch 替代小程序的 wx.request
 */

const Api = {
  // ─── 豆包：获取无水印视频 ───
  async doubaoFetchPlayInfo(vid) {
    const res = await fetch(
      'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'origin': 'https://www.doubao.com',
          'referer': 'https://www.doubao.com/'
        },
        body: JSON.stringify({ key: vid })
      }
    );
    const json = await res.json();
    if (json.code !== 0 || !json.data) throw new Error(json.msg || '解析失败');

    const data = json.data;
    const original = data.original_media_info || {};
    const preview = (data.media_info && data.media_info[0]) || {};

    const downurl = original.main_url || preview.main_url || '';
    if (!downurl) throw new Error('未获取到视频地址');

    const meta = original.meta || preview.meta || {};
    return {
      downurl,
      cover_url: data.poster_url || '',
      duration: parseFloat(meta.duration) || 0,
      width: parseInt(meta.width) || 0,
      height: parseInt(meta.height) || 0,
      definition: meta.definition || ''
    };
  },

  // ─── 豆包：获取分享元信息（标题/作者） ───
  async doubaoFetchShareMeta(vid, shareId) {
    try {
      const res = await fetch(
        'https://www.doubao.com/creativity/share/get_video_share_info?aid=497858&device_platform=web&language=zh-CN',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'origin': 'https://www.doubao.com',
            'referer': 'https://www.doubao.com/'
          },
          body: JSON.stringify({ share_id: shareId || '', vid, creation_id: '' })
        }
      );
      const json = await res.json();
      if (json.code === 0 && json.data) {
        return {
          prompt: json.data.prompt || '',
          nickname: (json.data.user_info && json.data.user_info.nickname) || ''
        };
      }
    } catch (e) { /* 静默失败 */ }
    return { prompt: '', nickname: '' };
  },

  // ─── 豆包：视频解析主入口 ───
  async doubaoAnalysis(url) {
    if (!url.includes('doubao.com')) throw new Error('不是豆包链接');

    const videoIdMatch = url.match(/video_id=([^&\s]+)/);
    const shareIdMatch = url.match(/share_id=([^&\s]+)/);

    if (!videoIdMatch) {
      const threadIdMatch = url.match(/\/thread\/([a-f0-9]+)/);
      if (threadIdMatch) return await Api.doubaoImageAnalysis(url);
      throw new Error('链接格式错误，找不到 video_id');
    }

    const vid = videoIdMatch[1];
    const shareId = shareIdMatch ? shareIdMatch[1] : '';

    // 并行请求
    const [playInfo, shareMeta] = await Promise.allSettled([
      Api.doubaoFetchPlayInfo(vid),
      Api.doubaoFetchShareMeta(vid, shareId)
    ]);

    if (playInfo.status === 'rejected') throw new Error(playInfo.reason?.message || '解析失败');

    const info = playInfo.value;
    const meta = shareMeta.status === 'fulfilled' ? shareMeta.value : { prompt: '', nickname: '' };

    return {
      type: 'video',
      cover_url: info.cover_url,
      downurl: info.downurl,
      title: meta.prompt || '',
      nickname: meta.nickname || '',
      images: [],
      duration: info.duration,
      width: info.width,
      height: info.height,
      definition: info.definition
    };
  },

  // ─── 豆包：图集解析 ───
  async doubaoImageAnalysis(url) {
    const threadIdMatch = url.match(/\/thread\/([a-f0-9]+)/);
    if (!threadIdMatch) throw new Error('无法识别图集ID');

    const threadId = threadIdMatch[1];
    const res = await fetch('https://www.doubao.com/thread/' + threadId, {
      headers: {
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'user-agent': navigator.userAgent
      }
    });
    const html = await res.text();

    let images = [];

    // 结构化 JSON 提取
    const fnArgsMatch = html.match(/data-script-src="modern-run-router-data-fn"\s+data-fn-args="(.*?)"\s+nonce="/i);
    if (fnArgsMatch && fnArgsMatch[1]) {
      const jsonStr = fnArgsMatch[1].replace(/&quot;/g, '"');
      try {
        const jsonData = JSON.parse(jsonStr);
        for (const item of jsonData) {
          if (typeof item === 'object' && item.data && item.data.message_snapshot) {
            const msgList = item.data.message_snapshot.message_list || [];
            for (const msg of msgList) {
              if (!msg.content_block) continue;
              for (const block of msg.content_block) {
                try {
                  const contentV2 = JSON.parse(block.content_v2);
                  if (contentV2.creation_block && contentV2.creation_block.creations) {
                    for (const creation of contentV2.creation_block.creations) {
                      if (creation.image && creation.image.image_ori_raw) {
                        let imgUrl = creation.image.image_ori_raw.url.replace(/&amp;/g, '&');
                        images.push(imgUrl);
                      }
                    }
                  }
                } catch (e) { /* skip */ }
              }
            }
          }
        }
      } catch (e) { /* fallback */ }
    }

    // 正则回退
    if (images.length === 0) {
      images = Api._extractImagesByRegex(html);
    }

    if (images.length === 0) throw new Error('未找到图片');

    return {
      type: 'images',
      cover_url: images[0] || '',
      downurl: '',
      title: '豆包图集 - ' + images.length + '张',
      images,
      duration: 0,
      width: 0,
      height: 0,
      definition: ''
    };
  },

  // 正则提取图片（回退方案）
  _extractImagesByRegex(html) {
    function fullDecode(raw) {
      if (!raw) return '';
      return raw
        .replace(/&quot;/g, '"')
        .replace(/\\u0026/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/\\\//g, '/')
        .replace(/^["'\s]+|["'\s]+$/g, '');
    }

    const results = [];
    const seenHashes = {};

    const patterns = [
      /image_ori_raw[\s\S]*?url[\s\S]*?(https:\/\/[^\\&\s"]+rc_gen_image\/[a-f0-9]{32}\.[a-z]+[^\\&\s"]*)/gi,
      /(https:\/\/p\d+-flow-imagex-sign\.byteimg\.com\/tos-cn-i-[a-z0-9]+\/rc_gen_image\/[a-f0-9]{32}\.[a-z~]+[^\\&\s"'<>]*x-signature=[^\\&\s"'<>]*)/gi
    ];

    for (const pattern of patterns) {
      let m;
      while ((m = pattern.exec(html)) !== null) {
        const urlCandidate = m[1] || m[0];
        const cleanUrl = fullDecode(urlCandidate);
        const hashMatch = cleanUrl.match(/rc_gen_image\/([a-f0-9]{32})/);
        if (hashMatch && !seenHashes[hashMatch[1]] && cleanUrl.startsWith('http')) {
          seenHashes[hashMatch[1]] = true;
          results.push(cleanUrl);
        }
      }
    }

    return results;
  },

  // ─── 通义千问：图片/视频解析 ───
  async qwenImageAnalysis(url) {
    const isExternalShare = (url.includes('qianwen.com') || url.includes('qwen.cn')) &&
      (url.includes('qwen-external-share') || url.includes('shareId'));

    const chatIdMatch = url.match(/\/chat\/([a-f0-9]+)/);
    const shareIdMatch = url.match(/shareId=([^&\s]+)/);

    if (!isExternalShare && !chatIdMatch) throw new Error('无法识别千问链接');

    const shareId = shareIdMatch ? shareIdMatch[1] : '';
    let targetUrl = '';
    if (isExternalShare && shareId) {
      targetUrl = url.split('?')[0] + '?shareId=' + shareId;
    } else if (chatIdMatch) {
      targetUrl = 'https://qwen.cn/chat/' + chatIdMatch[1];
    }

    const res = await fetch(targetUrl);
    const html = await res.text();

    let images = [];
    let videoUrl = '';

    // __NEXT_DATA__ JSON 提取
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">(.*?)<\/script>/i);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps || {};

        function traverse(obj, depth) {
          if (depth > 20 || !obj) return;
          if (typeof obj === 'string') {
            const imgPattern = /https:\/\/[^"'\s<>]*\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi;
            let m;
            while ((m = imgPattern.exec(obj)) !== null) {
              const u = m[0];
              if (!['avatar','icon','logo','favicon'].some(k => u.includes(k)) && u.length > 40 && !images.includes(u)) {
                images.push(u);
              }
            }
            const vidPattern = /https:\/\/[^"'\s<>]*\.(?:mp4|mov|avi|webm)(?:\?[^"'\s<>]*)?/gi;
            let vm;
            while ((vm = vidPattern.exec(obj)) !== null) {
              if (!videoUrl) videoUrl = vm[0];
            }
            return;
          }
          if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, depth + 1));
          } else if (typeof obj === 'object') {
            Object.values(obj).forEach(v => traverse(v, depth + 1));
          }
        }
        traverse(pageProps, 0);
      } catch (e) { /* fallback */ }
    }

    // 正则回退
    if (images.length === 0) {
      const qwenPatterns = [
        /"(?:original_url|url|src|imageUrl|image_url|oss_url|file_url)"\s*:\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi,
        /(https:\/\/[^"'\s<>]*(?:alicdn|aliyuncs|oss-cn|wanx)[^"'\s<>]*\.(?:jpg|jpeg|png|webp))/gi
      ];
      for (const p of qwenPatterns) {
        let m;
        while ((m = p.exec(html)) !== null) {
          const u = (m[1] || m[0]).replace(/\\"/g, '"').replace(/\\u002F/g, '/');
          if (!images.includes(u) && u.length > 40) images.push(u);
        }
      }
    }

    const isVideo = videoUrl.length > 0 && images.length === 0;

    if (isVideo) {
      return { type: 'video', cover_url: '', downurl: videoUrl, title: '通义千问视频', images: [], duration: 0, width: 0, height: 0, definition: '' };
    } else if (images.length > 0) {
      return { type: 'images', cover_url: images[0], downurl: '', title: '通义千问图集 - ' + images.length + '张', images, duration: 0, width: 0, height: 0, definition: '' };
    } else {
      throw new Error('未找到图片或视频');
    }
  },

  // ─── 即梦：视频解析（v2：使用页面抓取） ───
  async jimengVideoAnalysis(url) {
    const redirectUrl = await Api._followRedirect(url);
    const params = Api._parseQueryString(redirectUrl);

    // 提取作品 ID
    let itemId = '';
    const pathMatch = redirectUrl.match(/\/(?:ai-tool|detail|i|v|item|post)\/(\d+)/);
    if (pathMatch) itemId = pathMatch[1];
    if (!itemId) itemId = params.item_id || params.id || '';

    // 尝试抓取页面提取视频
    const videoUrls = await Api._fetchJimengMedia(redirectUrl, itemId, 'video');
    if (videoUrls && videoUrls.length > 0) {
      return {
        type: 'video',
        cover_url: '',
        downurl: videoUrls[0],
        title: '即梦视频',
        images: [],
        duration: 0, width: 0, height: 0, definition: ''
      };
    }

    // 回退：尝试旧版 API（可能仍有效）
    try {
      return await Api._jimengApiLegacy(redirectUrl, params, 'video');
    } catch (e) {
      throw new Error('未找到视频，请确保在作品详情页中使用（内容脚本自动拦截）');
    }
  },

  // ─── 即梦：图片解析（v2：使用页面抓取） ───
  async jimengImageAnalysis(url) {
    const redirectUrl = await Api._followRedirect(url);
    const params = Api._parseQueryString(redirectUrl);

    let itemId = '';
    const pathMatch = redirectUrl.match(/\/(?:ai-tool|detail|i|v|item|post)\/(\d+)/);
    if (pathMatch) itemId = pathMatch[1];
    if (!itemId) itemId = params.item_id || params.id || '';

    const imageUrls = await Api._fetchJimengMedia(redirectUrl, itemId, 'image');
    if (imageUrls && imageUrls.length > 0) {
      return {
        type: 'images',
        cover_url: imageUrls[0] || '',
        downurl: '',
        title: '即梦图集 - ' + imageUrls.length + '张',
        images: imageUrls,
        duration: 0, width: 0, height: 0, definition: ''
      };
    }

    // 回退：尝试旧版 API
    try {
      return await Api._jimengApiLegacy(redirectUrl, params, 'image');
    } catch (e) {
      throw new Error('未找到图片，请确保在作品详情页中使用（内容脚本自动拦截）');
    }
  },

  // ─── 即梦：页面抓取（主方案） ───
  async _fetchJimengMedia(pageUrl, itemId, type) {
    try {
      const res = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': navigator.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
        },
        credentials: 'include'
      });
      const html = await res.text();

      const urls = [];
      const seenHashes = {};

      // 策略1：从 __INITIAL_STATE__ 或 __NEXT_DATA__ 中提取
      const jsonDataMatch = html.match(/(?:window\.__INITIAL_STATE__|window\.__NEXT_DATA__)\s*=\s*({.+?})\s*[;<]/s);
      if (jsonDataMatch) {
        try {
          const data = JSON.parse(jsonDataMatch[1]);
          Api._extractMediaFromObj(data, urls, seenHashes, type);
        } catch (e) { /* 跳过 */ }
      }

      // 策略2：直接扫描 HTML 中的 CDN URL
      if (urls.length === 0) {
        const cdnPatterns = type === 'video'
          ? [/\b(https:\/\/[^\s"'<>]*\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?)/gi]
          : [
              // 图片：优先找高清版本（byteimg.com / vlabstatic.com / vlabvod.com）
              /"(url|src|videoUrl|image_url|download_url|original_url|large_url)"\s*:\s*"([^"]+)"/gi,
              /https:\/\/(?:[a-z0-9-]+\.)*(?:byteimg|vlabstatic|vlabvod|byted-static)\.com[^\s"'<>]*(?:\.jpg|\.jpeg|\.png|\.webp|\.gif)(?:\?[^\s"'<>]*)?/gi,
            ];

        for (const pattern of cdnPatterns) {
          let match;
          while ((match = pattern.exec(html)) !== null) {
            const rawUrl = (match[2] || match[0]).replace(/\\"/g, '"').replace(/&amp;/g, '&');
            const hashMatch = rawUrl.match(/\/([a-f0-9]{32})\//);
            if (hashMatch && !seenHashes[hashMatch[1]]) {
              seenHashes[hashMatch[1]] = true;
              urls.push(rawUrl);
            }
          }
        }
      }

      // 去重
      const deduped = [];
      const dedupSet = new Set();
      for (const u of urls) {
        if (!dedupSet.has(u) && u.startsWith('http')) {
          dedupSet.add(u);
          deduped.push(u);
        }
      }

      return deduped;
    } catch (e) {
      return [];
    }
  },

  // 递归从 JSON 对象中提取媒体 URL
  _extractMediaFromObj(obj, urls, seenHashes, type, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(item => Api._extractMediaFromObj(item, urls, seenHashes, type, depth + 1));
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && val.startsWith('http')) {
        if (type === 'video') {
          if (/\.(mp4|webm|mov)(\?|$|#)/i.test(val) || /mime_type=video_/.test(val)) {
            const hashMatch = val.match(/\/([a-f0-9]{32})\//);
            if (hashMatch && !seenHashes[hashMatch[1]]) {
              seenHashes[hashMatch[1]] = true;
              urls.push(val);
            }
          }
        } else {
          // 图片：过滤低质量
          if (/\.(jpg|jpeg|png|webp|gif)(\?|$|#)/i.test(val) || /byteimg|vlabstatic|vlabvod/.test(val)) {
            const hashMatch = val.match(/\/([a-f0-9]{32})\//);
            if (hashMatch && !seenHashes[hashMatch[1]]) {
              seenHashes[hashMatch[1]] = true;
              urls.push(val);
            }
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        Api._extractMediaFromObj(val, urls, seenHashes, type, depth + 1);
      }
    }
  },

  // ─── 即梦：旧版 API 回退（保留但降低优先级） ───
  async _jimengApiLegacy(url, params, type) {
    const shareId = params.share_id || '';
    if (!shareId) throw new Error('无法获取分享ID');

    const res = await fetch(
      'https://xiaoyunque.jianying.com/luckycat/cn/jianying/campaign/v1/pippit/share/landing_page',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://xiaoyunque.jianying.com',
          'referer': 'https://xiaoyunque.jianying.com/'
        },
        body: JSON.stringify({
          query_params: {
            content_type: type,
            home_input_type: type === 'video' ? 'VIDEO_PART' : 'IMAGE_PART',
            scene: 'agent_tool',
            share_campaign_key: 'pippit_invite_fission',
            share_id: shareId,
            share_sec_did: params.share_sec_did || '',
            share_sec_uid: params.share_sec_uid || ''
          }
        })
      }
    );
    const result = await res.json();

    if (!result.data?.page_info?.generate_page?.item_info) {
      throw new Error('API 返回数据异常，可能链接已失效');
    }

    const pageInfo = result.data.page_info;
    const itemInfo = pageInfo.generate_page.item_info || {};

    if (type === 'video') {
      const videoInfoList = itemInfo.video_info || [];
      if (videoInfoList.length === 0) throw new Error('未找到视频信息');
      const videoInfo = videoInfoList[0];
      return {
        type: 'video',
        cover_url: videoInfo.cover_url || '',
        downurl: videoInfo.video_url || '',
        title: '即梦视频',
        images: [],
        duration: 0, width: 0, height: 0, definition: ''
      };
    } else {
      const imageInfoList = itemInfo.image_info || [];
      const images = imageInfoList.map(img => img.image_url).filter(Boolean);
      if (images.length === 0) throw new Error('未找到图片');
      return {
        type: 'images',
        cover_url: images[0] || '',
        downurl: '',
        title: '即梦图集 - ' + images.length + '张',
        images,
        duration: 0, width: 0, height: 0, definition: ''
      };
    }
  },

  // ─── 主入口：根据 URL 自动路由 ───
  async analysis(url) {
    if (url.includes('doubao.com')) {
      return await Api.doubaoAnalysis(url);
    } else if (url.includes('qwen.cn') || url.includes('qianwen.com')) {
      return await Api.qwenImageAnalysis(url);
    } else if (url.includes('jimeng.jianying.com') || url.includes('dreamina.com') || url.includes('xiaoyunque.jianying.com')) {
      // 即梦可能图片或视频，先尝试视频
      try { return await Api.jimengVideoAnalysis(url); }
      catch { return await Api.jimengImageAnalysis(url); }
    } else {
      throw new Error('不支持的链接，仅支持：豆包 / 通义千问 / 即梦(Dreamina)');
    }
  },

  // ─── 工具方法 ───
  _parseQueryString(url) {
    const queryIndex = url.indexOf('?');
    const qs = queryIndex > -1 ? url.substring(queryIndex + 1) : '';
    const params = {};
    if (qs) {
      for (const pair of qs.split('&')) {
        const [k, v] = pair.split('=');
        if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }
    return params;
  },

  async _followRedirect(url) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      return res.url || url;
    } catch {
      return url;
    }
  },

  // 从文本中提取 URL
  extractUrl(text) {
    const match = text.match(/(https?:\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])/);
    return match ? match[0] : '';
  }
};

// 兼容 popup 和 content script
if (typeof window !== 'undefined') window.DoubaoApi = Api;
