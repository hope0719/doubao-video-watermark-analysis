/**
 * 豆包去水印 - 对话页浮动资源面板 (content-panel.js)
 *
 * 运行在 chat 页面的 isolated world，监听 background 发来的消息：
 *   - MEDIA_FOUND  ：background 从 /im/chain/single 提取到的原图/无水印视频列表
 *   - MEDIA_STATUS ：状态提示（如「未提取到资源」）
 *
 * 每条对话消息（一个 requestId）对应一个 sourceKey，面板按 sourceKey 累积展示，
 * 最新的对话消息作为当前视图。点击「下载」通过 DOWNLOAD_MEDIA 交给 background 下载。
 *
 * 注意：本面板只负责展示与下载，提取逻辑全部在 background（debugger 引擎）中完成。
 */
(function () {
  const PANEL_ID = "watermark-free-media-panel";

  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = PANEL_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        font-family: Arial, "Microsoft YaHei", sans-serif;
      }

      .panel {
        width: 336px;
        max-height: 420px;
        display: flex;
        flex-direction: column;
        color: #1f2937;
        background: #fff;
        border: 1px solid rgba(31, 41, 55, 0.16);
        border-radius: 8px;
        box-shadow: 0 14px 38px rgba(15, 23, 42, 0.2);
        overflow: hidden;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        background: #f8fafc;
        border-bottom: 1px solid rgba(31, 41, 55, 0.1);
      }

      .title {
        font-size: 14px;
        line-height: 20px;
        font-weight: 700;
      }

      .count {
        min-width: 22px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: #166534;
        color: #fff;
        font-size: 12px;
        line-height: 20px;
        text-align: center;
      }

      .list {
        min-height: 76px;
        max-height: 350px;
        overflow: auto;
        padding: 8px;
      }

      .empty {
        padding: 18px 10px;
        color: #64748b;
        font-size: 13px;
        line-height: 20px;
        text-align: center;
      }

      .item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid rgba(31, 41, 55, 0.12);
        border-radius: 6px;
        background: #fff;
      }

      .item + .item {
        margin-top: 8px;
      }

      .label {
        min-width: 0;
        color: #273444;
        font-size: 13px;
        line-height: 18px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tag {
        display: inline-block;
        min-width: 34px;
        margin-right: 8px;
        padding: 2px 6px;
        border-radius: 999px;
        color: #fff;
        font-size: 12px;
        line-height: 16px;
        text-align: center;
      }

      .tag.video {
        background: #6d28d9;
      }

      .tag.image {
        background: #0f766e;
      }

      button {
        height: 30px;
        padding: 0 10px;
        border: 0;
        border-radius: 6px;
        background: #2563eb;
        color: #fff;
        font-size: 12px;
        line-height: 30px;
        cursor: pointer;
        white-space: nowrap;
      }

      button:hover {
        background: #1d4ed8;
      }
    </style>
    <section class="panel" aria-label="无水印资源面板">
      <div class="header">
        <div class="title">无水印资源</div>
        <div class="count">0</div>
      </div>
      <div class="list">
        <div class="empty">打开豆包对话页，生成图片或视频后这里会自动出现原图与无水印视频</div>
      </div>
    </section>
  `;

  const list = shadow.querySelector(".list");
  const count = shadow.querySelector(".count");
  const items = new Map();
  let currentSourceKey = "";
  let statusText = "打开豆包对话页，生成图片或视频后这里会自动出现原图与无水印视频";

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) {
      return;
    }

    if (message.type === "MEDIA_STATUS" && typeof message.text === "string") {
      resetForSource(message.sourceKey);
      items.clear();
      statusText = message.text;
      render();
      return;
    }

    if (message.type === "MEDIA_FOUND" && Array.isArray(message.items)) {
      resetForSource(message.sourceKey);
      items.clear();
      addItems(message.items);
      statusText = items.size ? "" : "未提取到资源";
      render();
      return;
    }
  });

  function resetForSource(sourceKey) {
    if (typeof sourceKey !== "string" || !sourceKey) {
      return;
    }
    if (sourceKey !== currentSourceKey) {
      currentSourceKey = sourceKey;
      items.clear();
      statusText = "";
    }
  }

  function render() {
    count.textContent = String(items.size);
    list.textContent = "";

    if (!items.size) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = statusText || "等待捕获资源";
      list.appendChild(empty);
      return;
    }

    let index = 0;
    Array.from(items.values()).forEach((item) => {
      index += 1;
      const row = document.createElement("div");
      row.className = "item";

      const label = document.createElement("div");
      label.className = "label";
      label.title = item.url;

      const tag = document.createElement("span");
      tag.className = `tag ${item.type}`;
      tag.textContent = item.type === "image" ? "图片" : "视频";

      const indexText = document.createElement("span");
      indexText.textContent = String(index);

      label.append(tag, indexText);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "下载";
      button.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "DOWNLOAD_MEDIA",
          url: item.url,
          filename: buildFilename(item, index)
        });
      });

      row.append(label, button);
      list.appendChild(row);
    });
  }

  function buildFilename(item, index) {
    const ext = guessExt(item.url, item.type);
    const prefix = item.type === "image" ? "doubao_img" : "doubao_video";
    return `${prefix}_${index}.${ext}`;
  }

  function guessExt(url, type) {
    const m = (url || "").match(/\.(mp4|webm|mov|png|jpg|jpeg|webp|gif)(?:[?#]|$)/i);
    if (m) return m[1].toLowerCase();
    return type === "image" ? "png" : "mp4";
  }

  function addItems(nextItems) {
    for (const item of nextItems) {
      if (!item || typeof item.url !== "string" || !isHttpUrl(item.url)) {
        continue;
      }
      items.set(item.url, {
        type: item.type === "image" ? "image" : "video",
        url: item.url
      });
    }
  }

  function isHttpUrl(url) {
    return /^https?:\/\//i.test(url);
  }
})();
