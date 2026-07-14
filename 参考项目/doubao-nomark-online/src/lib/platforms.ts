export type ContentType = "image" | "video";

export interface Platform {
  id: string;
  name: string;
  domain: string;
  contentType: ContentType;
  detect: (url: string) => boolean;
  exampleUrl: string;
  contentLabel: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: "doubao-image",
    name: "豆包",
    domain: "doubao.com",
    contentType: "image",
    detect: (url: string) => url.includes("/thread/"),
    exampleUrl: "https://www.doubao.com/thread/...",
    contentLabel: "图片",
  },
  {
    id: "qianwen-image",
    name: "千问",
    domain: "qianwen.com",
    contentType: "image",
    detect: (url: string) => url.includes("qianwen.com/share/chat/"),
    exampleUrl: "https://www.qianwen.com/share/chat/...",
    contentLabel: "图片",
  },
];

export function detectPlatform(url: string): Platform | null {
  if (!url) return null;
  for (const platform of PLATFORMS) {
    if (platform.detect(url)) return platform;
  }
  return null;
}
