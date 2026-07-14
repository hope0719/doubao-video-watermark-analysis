import type { Metadata } from "next";
import { HomePage } from "../components/home";

export const metadata: Metadata = {
  title: "豆包 · 千问 — 无水印素材提取",
  description: "粘贴豆包或千问的分享链接，提取无水印图片，支持预览与一键下载。",
};

export default function Page() {
  return <HomePage />;
}
