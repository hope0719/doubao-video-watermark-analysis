/**
 * 豆包图片去水印 - 浏览器扩展 API 模块 (v3)
 * 支持平台：豆包 / 通义千问 / 即梦(Dreamina)
 * 功能：图片去水印 + 视频无水印下载（千问/即梦）
 */

const Api = {
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
      title: '豆包图集 - ' + images.length + '张',
      images,
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

  // ─── 通义千问：图片+视频解析 ───
  async qwenAnalysis(url) {
    const chatIdMatch = url.match(/\/chat\/([a-f0-9]+)/);
    const shareIdMatch = url.match(/shareId=([^&\s]+)/);

    if (!chatIdMatch && !shareIdMatch) throw new Error('无法识别千问链接');

    let targetUrl = '';
    if (shareIdMatch) {
      targetUrl = url.split('?')[0] + '?shareId=' + shareIdMatch[1];
    } else if (chatIdMatch) {
      targetUrl = 'https://qwen.cn/chat/' + chatIdMatch[1];
    }

    const res = await fetch(targetUrl);
    const html = await res.text();

    const images = [];
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
            // 提取图片
            const imgPattern = /https?:\/\/[^"'\s<>]*\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi;
            let m;
            while ((m = imgPattern.exec(obj)) !== null) {
              const u = m[0];
              if (!['avatar','icon','logo','favicon'].some(k => u.includes(k)) && u.length > 40 && !images.includes(u)) {
                images.push(u);
              }
            }
            // 提取视频
            const videoPattern = /https?:\/\/[^"'\s<>]*\.(?:mp4|mov|webm)(?:\?[^"'\s<>]*)?/gi;
            while ((m = videoPattern.exec(obj)) !== null) {
              if (!videoUrl && m[0].length > 40) {
                videoUrl = m[0];
              }
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

    if (!videoUrl) {
      const videoMatch = html.match(/"(?:video_url|videoSrc|src)"\s*:\s*"(https:\/\/[^"]+\.(?:mp4|mov|webm))"/i);
      if (videoMatch) videoUrl = videoMatch[1];
    }

    // 优先返回视频
    if (videoUrl) {
      return { type: 'video', url: videoUrl, cover: '', title: '通义千问视频', platform: 'qwen' };
    }

    if (images.length > 0) {
      return { type: 'images', cover_url: images[0], title: '通义千问图集 - ' + images.length + '张', images };
    }

    throw new Error('未找到图片或视频');
  },

  // ─── 即梦：图片+视频解析 ───
  async jimengAnalysis(url) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const workId = pathParts[pathParts.length - 1].split('?')[0];

    // 方案1：get_item_info API
    const apiResult = await Api._fetchJimengItemInfo(workId);
    if (apiResult) return apiResult;

    // 方案2：HTML SSR 抓取
    const html = await Api._fetchJimengPageHtml(url);
    const media = Api._extractJimengMediaFromHtml(html);
    if (media.videoUrl) {
      return { type: 'video', url: media.videoUrl, cover: '', title: '即梦视频', platform: 'jimeng' };
    }
    if (media.images.length > 0) {
      return { type: 'images', cover_url: media.images[0], title: '即梦图集 - ' + media.images.length + '张', images: media.images };
    }

    throw new Error('未找到图片，请确保在作品详情页中使用');
  },

  // 即梦 get_item_info API
  async _fetchJimengItemInfo(workId) {
    try {
      const webId = String(Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000);
      const apiUrl = `https://jimeng.jianying.com/mweb/v1/get_item_info?aid=513695&device_platform=web&region=CN&web_id=${webId}`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://jimeng.jianying.com',
          'Referer': 'https://jimeng.jianying.com/'
        },
        body: JSON.stringify({
          published_item_id: workId,
          pack_item_opt: {},
          item_not_find_detail: true
        })
      });

      const data = await res.json();
      const d = data?.data;
      if (!d) return null;

      // 视频（清晰度降级）
      if (d.video) {
        const tv = d.video.transcoded_video || {};
        const qualityChain = ['origin', '720p', '480p', '360p'];
        for (const quality of qualityChain) {
          const entry = tv[quality];
          if (entry && entry.video_url) {
            return { type: 'video', url: entry.video_url, cover: '', title: '即梦视频', platform: 'jimeng', quality: quality === 'origin' ? '原画' : quality };
          }
        }
        if (d.video.origin_video?.video_url) {
          return { type: 'video', url: d.video.origin_video.video_url, cover: '', title: '即梦视频', platform: 'jimeng', quality: '原画' };
        }
      }

      // 图片
      if (d.image) {
        const imgs = d.image.large_images || d.image.images || [];
        const imgUrls = imgs.filter(i => i.image_url).map(i => i.image_url);
        if (imgUrls.length > 0) {
          return { type: 'images', cover_url: imgUrls[0], title: '即梦图集 - ' + imgUrls.length + '张', images: imgUrls };
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  },

  // 获取即梦页面 HTML
  async _fetchJimengPageHtml(pageUrl) {
    try {
      // 桌面版优先
      const desktopUrl = pageUrl.replace(/\/\/m\.jimeng\./, '//jimeng.');
      const res = await fetch(desktopUrl, {
        headers: { 'User-Agent': navigator.userAgent },
        credentials: 'include'
      });
      return await res.text();
    } catch (e) {
      return '';
    }
  },

  // 从即梦 HTML 提取图片+视频
  _extractJimengMediaFromHtml(html) {
    const images = [];
    const seenHashes = {};
    let videoUrl = '';

    // 视频：vlabvod.com CDN
    const vlabvodPattern = /(["'\s])(https?:\/\/[^"'\s<>]*?vlabvod\.com\/[^"'\s<>]*?)(["'\s<>])/gi;
    let match;
    while ((match = vlabvodPattern.exec(html)) !== null) {
      const url = match[2].replace(/&amp;/g, '&');
      if (!videoUrl) videoUrl = url;
    }

    // 图片：JSON image_url 字段（32位hex 哈希过滤）
    const imageUrlPattern = /"image_url"\s*:\s*"(https?:\/\/[^"]+)"/gi;
    while ((match = imageUrlPattern.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      const hashMatch = url.match(/\/([a-f0-9]{32})\//i);
      if (hashMatch && !seenHashes[hashMatch[1]]) {
        seenHashes[hashMatch[1]] = true;
        images.push(url);
      }
    }

    // 兜底：__NEXT_DATA__
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        Api._extractMediaFromObj(nextData, images, seenHashes);
      } catch (e) {}
    }

    return { images, videoUrl };
  },

  // 递归从 JSON 对象中提取图片
  _extractMediaFromObj(obj, urls, seenHashes, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(item => Api._extractMediaFromObj(item, urls, seenHashes, depth + 1));
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && val.startsWith('http')) {
        if (/\.(jpg|jpeg|png|webp|gif)(\?|$|#)/i.test(val) || /byteimg|vlabstatic|vlabvod/.test(val)) {
          const hashMatch = val.match(/\/([a-f0-9]{32})\//);
          if (hashMatch && !seenHashes[hashMatch[1]]) {
            seenHashes[hashMatch[1]] = true;
            urls.push(val);
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        Api._extractMediaFromObj(val, urls, seenHashes, depth + 1);
      }
    }
  },

  // ─── 主入口 ───
  async analysis(url) {
    if (url.includes('doubao.com')) {
      return await Api.doubaoImageAnalysis(url);
    } else if (url.includes('qwen.cn') || url.includes('qianwen.com')) {
      return await Api.qwenAnalysis(url);
    } else if (url.includes('jimeng.jianying.com') || url.includes('dreamina.com') || url.includes('xiaoyunque.jianying.com')) {
      return await Api.jimengAnalysis(url);
    } else {
      throw new Error('不支持的链接，仅支持：豆包 / 通义千问 / 即梦(Dreamina)');
    }
  },

  // ─── 工具方法 ───
  extractUrl(text) {
    const match = text.match(/(https?:\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])/);
    return match ? match[0] : '';
  }
};

// 兼容 popup 和 content script
if (typeof window !== 'undefined') window.DoubaoApi = Api;
