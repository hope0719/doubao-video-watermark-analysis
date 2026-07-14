"use server";

import type { ImageResult, VideoResult } from "@/lib/parsers";
import { parseDoubaoImage, parseQianwenImage } from "@/lib/parsers";
import { withRetry } from "@/lib/retry";

type ParseSuccess =
  | {
      success: true;
      contentType: "image";
      data: ImageResult[];
    }
  | {
      success: true;
      contentType: "video";
      data: VideoResult;
    };

type ParseFailure = {
  success: false;
  error: string;
};

export type ParseMediaResult = ParseSuccess | ParseFailure;

export async function parseMedia(url: string): Promise<ParseMediaResult> {
  try {
    if (!url || typeof url !== "string") {
      return { success: false, error: "请提供有效的链接" };
    }

    if (url.includes("/video-sharing")) {
      return { success: false, error: "暂不支持解析视频" };
      // const video = await withRetry(() => parseDoubaoVideo(url), "解析视频");
      // return { success: true, contentType: "video", data: video };
    }

    const isQianwen = url.includes("qianwen.com");
    const images = await withRetry(
      () => (isQianwen ? parseQianwenImage(url) : parseDoubaoImage(url)),
      "解析图片",
    );

    if (images.length === 0) {
      return { success: false, error: "未找到可提取的图片" };
    }

    return { success: true, contentType: "image", data: images };
  } catch (e) {
    const message = e instanceof Error ? e.message : "解析失败，请稍后重试";
    return { success: false, error: message };
  }
}
