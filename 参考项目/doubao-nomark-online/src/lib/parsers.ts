export interface ImageResult {
  url: string;
  width: number;
  height: number;
}

export interface VideoResult {
  url: string;
  width: number;
  height: number;
  definition: string;
  poster_url: string;
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const WECHAT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/14315";

export async function parseDoubaoImage(url: string): Promise<ImageResult[]> {
  if (!url.includes("/thread/")) {
    throw new Error("链接有误，请使用包含 /thread/ 的豆包对话链接");
  }

  const resp = await fetch(url, {
    headers: {
      "accept-language": "zh-CN,zh;q=0.9",
      "user-agent": CHROME_UA,
    },
  });

  if (!resp.ok) {
    throw new Error(`网络请求失败（HTTP ${resp.status}）`);
  }

  const html = await resp.text();

  const pattern =
    /data-script-src="modern-run-router-data-fn" data-fn-args="([\s\S]*?)" nonce="/;
  const m = html.match(pattern);
  if (!m) {
    throw new Error("页面数据解析失败，请检查链接是否有效");
  }

  const jsonStr = m[1].replace(/&quot;/g, '"');
  const jsonData = JSON.parse(jsonStr);

  const images: ImageResult[] = [];
  try {
    for (const item of jsonData) {
      if (!item || typeof item !== "object" || !item.data) continue;
      const msgList = item.data.message_snapshot?.message_list;
      if (!Array.isArray(msgList)) continue;
      for (const msg of msgList) {
        if (!Array.isArray(msg.content_block)) continue;
        for (const block of msg.content_block) {
          const contentStr = block.content_v2;
          if (!contentStr) continue;
          const content = JSON.parse(contentStr);
          const creations = content.creation_block?.creations;
          if (!Array.isArray(creations)) continue;
          for (const creation of creations) {
            const raw = creation.image?.image_ori_raw;
            if (!raw) continue;
            images.push({
              url: raw.url.replace(/&amp;/g, "&"),
              width: raw.width,
              height: raw.height,
            });
          }
        }
      }
    }
  } catch (_e) {
    throw new Error("页面结构已变更，解析失败");
  }

  return images;
}

export async function parseQianwenImage(url: string): Promise<ImageResult[]> {
  if (!url.includes("qianwen.com/share/chat/")) {
    throw new Error("链接有误，请使用包含 /share/chat/ 的千问对话链接");
  }

  const shareId = url.split("?")[0].split("chat/").pop();
  if (!shareId) {
    throw new Error("无法提取分享 ID，请检查链接是否完整");
  }

  const resp = await fetch("https://chat2-api.qianwen.com/api/v1/share/info", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": CHROME_UA,
      origin: "https://www.qianwen.com",
    },
    body: JSON.stringify({ share_id: shareId, biz_id: "ai_qwen" }),
  });

  if (!resp.ok) {
    throw new Error(`网络请求失败（HTTP ${resp.status}）`);
  }

  const result = await resp.json();

  if (!result.data) {
    throw new Error("数据格式异常，链接可能已失效");
  }
  if (!result.data.session) {
    throw new Error("无法获取会话数据，请稍后重试");
  }

  const images: ImageResult[] = [];
  try {
    const recordList = result.data.session.record_list;
    if (!Array.isArray(recordList)) return images;

    for (const record of recordList) {
      const messages = record.response_messages;
      if (!Array.isArray(messages)) continue;
      for (const msg of messages) {
        if (msg.mime_type !== "multi_load/iframe") continue;
        if (msg.status !== "complete") continue;
        const multiLoad = msg.meta_data?.multi_load;
        if (!Array.isArray(multiLoad)) continue;
        for (const item of multiLoad) {
          const displayList = item.content?.display_list;
          if (!Array.isArray(displayList)) continue;
          for (const display of displayList) {
            const img = display.image;
            if (!img || !Array.isArray(img) || img.length === 0) continue;
            images.push({
              url: img[0].url,
              width: img[0].width,
              height: img[0].height,
            });
          }
        }
      }
    }
  } catch (_e) {
    throw new Error("千问页面结构已变更，解析失败");
  }

  return images;
}

export async function parseDoubaoVideo(url: string): Promise<VideoResult> {
  const parsed = new URL(url);
  const shareId = parsed.searchParams.get("share_id");
  const videoId = parsed.searchParams.get("video_id");

  if (!shareId) {
    throw new Error("链接缺少必要参数，请确认链接完整性");
  }
  if (!videoId) {
    throw new Error("链接缺少必要参数，请确认链接完整性");
  }

  const apiUrl = new URL(
    "https://www.doubao.com/creativity/share/get_video_share_info",
  );
  apiUrl.searchParams.set("version_code", "20800");
  apiUrl.searchParams.set("language", "zh-CN");
  apiUrl.searchParams.set("device_platform", "web");
  apiUrl.searchParams.set("aid", "497858");
  apiUrl.searchParams.set("pc_version", "2.51.7");

  const resp = await fetch(apiUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": WECHAT_UA,
      origin: "https://www.doubao.com",
    },
    body: JSON.stringify({
      share_id: shareId,
      vid: videoId,
      creation_id: "",
    }),
  });

  if (!resp.ok) {
    throw new Error(`网络请求失败（HTTP ${resp.status}）`);
  }

  const result = await resp.json();

  if (!result.data) {
    throw new Error("数据格式异常，链接可能已失效");
  }
  if (!result.data.play_info) {
    throw new Error("无法获取视频播放信息，请稍后重试");
  }

  const play = result.data.play_info;
  return {
    url: play.main,
    width: play.width,
    height: play.height,
    definition: play.definition,
    poster_url: play.poster_url,
  };
}
