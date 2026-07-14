"use client";

import {
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFileImageLine,
  RiLink,
  RiSparkling2Line,
  RiZoomInLine,
} from "@remixicon/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseMedia } from "@/app/actions";
import type { ImageResult, VideoResult } from "@/lib/parsers";
import { detectPlatform, PLATFORMS } from "@/lib/platforms";
import RotatingText from "./ui/RotatingText";

export function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageResult[] | null>(null);
  const [video, setVideo] = useState<VideoResult | null>(null);

  const platform = detectPlatform(url);
  const hasResult = Boolean((images && images.length > 0) || video);

  async function handleParse() {
    setError(null);
    setImages(null);
    setVideo(null);

    if (!platform) {
      setError("无法识别此链接，请粘贴豆包或千问的对话分享链接");
      return;
    }

    setLoading(true);
    try {
      const result = await parseMedia(url);

      if (!result.success) {
        setError(result.error);
      } else if (result.contentType === "image") {
        setImages(result.data);
      } else {
        setVideo(result.data);
      }
    } catch {
      setError("请求失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-8 sm:gap-10 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,7fr)_minmax(380px,5fr)] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-surface-card px-3.5 py-2 text-xs font-medium text-body-strong sm:mb-5 sm:px-4 sm:text-[13px]">
              <RiSparkling2Line size={16} />
              <RotatingText
                texts={["豆包", "千问"]}
                staggerFrom="last"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-120%" }}
                staggerDuration={0.025}
                splitLevelClassName="overflow-hidden"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                rotationInterval={2000}
                splitBy="characters"
                auto
                loop
              />{" "}
              — 无水印素材提取
            </span>
            <h2 className="mt-2 font-display text-2xl font-medium leading-tight text-ink sm:text-4xl">
              我们本该日日相逢 👋
            </h2>
            <div className="mt-7 rounded-2xl bg-surface-soft p-2 sm:mt-8 sm:rounded-3xl sm:p-3">
              <form
                className="rounded-[18px] border border-hairline bg-canvas p-3 sm:rounded-2xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleParse();
                }}
              >
                {platform && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-ink">
                    已识别：{platform.name} · {platform.contentLabel}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative flex-1">
                    <span className="sr-only">分享链接</span>
                    <RiLink
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="粘贴豆包或千问的分享链接"
                      className="h-12 w-full rounded-xl border border-hairline bg-canvas py-3 pl-11 pr-4 text-[16px] text-ink outline-none transition placeholder:text-muted-soft focus:border-ink"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading || !url}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled disabled:text-muted sm:w-auto"
                  >
                    {loading ? "正在解析" : "开始解析"}
                    {!loading && <RiArrowRightLine size={17} />}
                  </button>
                </div>

                {error && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm text-error">
                    <RiErrorWarningLine size={17} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </form>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              {PLATFORMS.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1.5 text-xs font-medium text-body-strong sm:gap-2 sm:text-[13px]"
                >
                  {item.name}
                  <span className="h-1 w-1 rounded-full bg-muted-soft" />
                  {item.contentLabel}
                </span>
              ))}
            </div>
          </div>

          <ClayHeroArtifact loading={loading} hasResult={hasResult} />
        </section>

        {hasResult && (
          <ResultSection images={images} platformName={platform?.name} />
        )}
        <DocSection />
      </main>
      <Footer />
    </div>
  );
}

function ClayHeroArtifact({
  loading,
  hasResult,
}: {
  loading: boolean;
  hasResult: boolean;
}) {
  return (
    <div className="hidden sm:block relative min-h-82.5 overflow-hidden rounded-2xl bg-surface-soft p-4 sm:min-h-125 sm:rounded-3xl sm:p-8">
      <div className="absolute left-4 top-4 rounded-full bg-brand-peach px-3 py-1.5 text-xs font-semibold text-ink sm:left-8 sm:top-8 sm:px-4 sm:py-2 sm:text-sm">
        {loading ? "正在连接资源" : hasResult ? "资源已就绪" : "等待链接"}
      </div>
      <div className="absolute right-4 top-16 h-16 w-16 rounded-full bg-brand-lavender shadow-clay sm:right-7 sm:top-20 sm:h-24 sm:w-24" />
      <div className="absolute bottom-5 left-5 right-5 h-20 rounded-[26px] bg-brand-ochre shadow-clay sm:bottom-8 sm:left-8 sm:right-8 sm:h-28 sm:rounded-4xl" />
      <div className="absolute bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-[44%_56%_48%_52%] bg-brand-mint shadow-clay sm:bottom-20 sm:h-48 sm:w-48" />
      <div className="absolute bottom-36 left-[14%] h-20 w-20 rounded-[54%_46%_48%_52%] bg-brand-coral shadow-clay sm:bottom-48 sm:left-[18%] sm:h-28 sm:w-28" />

      <div className="absolute bottom-14 left-1/2 w-[86%] max-w-md -translate-x-1/2 rounded-2xl border border-hairline bg-canvas p-3 shadow-soft sm:bottom-24 sm:w-[78%] sm:rounded-3xl sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div>
            <p className="text-xs font-semibold text-muted"></p>
            <p className="mt-1 text-base font-semibold text-ink sm:text-lg">
              特性
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-pink px-3 py-1 text-xs font-semibold text-white">
            实时
          </span>
        </div>
        <div className="space-y-2">
          {["免费，快速", "不存储任何数据", "即用即走"].map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl bg-surface-card px-3 py-2 sm:rounded-2xl"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-xs font-semibold">
                {index + 1}
              </span>
              <span className="text-sm font-medium text-body-strong">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  images,
  platformName,
}: {
  images: ImageResult[] | null;
  platformName?: string;
}) {
  const [previewImage, setPreviewImage] = useState<
    (ImageResult & { index: number }) | null
  >(null);

  return (
    <section id="result" className="bg-surface-soft py-12 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold text-muted">解析完成</p>
            <h2 className="mt-2 font-display text-3xl font-medium leading-tight text-ink sm:mt-3 sm:text-5xl">
              解析结果
            </h2>
          </div>
          <span className="w-fit rounded-full bg-surface-card px-4 py-2 text-sm font-medium text-body-strong">
            {platformName ?? "已识别平台"} ·{" "}
            {images && `${images.length} 张图片`}
          </span>
        </div>

        {images && images.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img, index) => (
              <article
                key={img.url}
                className="group overflow-hidden rounded-3xl border border-hairline bg-canvas"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-surface-card">
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ ...img, index })}
                    className="relative block h-full w-full cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 text-left"
                    aria-label={`放大预览解析图片 ${index + 1}`}
                  >
                    <Image
                      src={img.url}
                      alt={`解析图片 ${index + 1}`}
                      fill
                      unoptimized
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 shadow-soft backdrop-blur transition group-hover:opacity-100">
                      <RiZoomInLine size={18} />
                    </span>
                  </button>
                </div>
                <div className="flex gap-3 p-4 items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-body">
                    <RiFileImageLine size={17} />
                    {img.width} × {img.height}
                  </span>
                  <ResourceActions
                    href={img.url}
                    downloadLabel="下载原图"
                    filename={getImageFilename(img.url, index)}
                    proxyDownload
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {previewImage && (
        <ImagePreviewDialog
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </section>
  );
}

function ImagePreviewDialog({
  image,
  onClose,
}: {
  image: ImageResult & { index: number };
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/82 px-4 py-6 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label={`解析图片 ${image.index + 1} 放大预览`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out border-0 bg-transparent"
        aria-label="关闭图片预览"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-full w-full max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3 text-white">
          <div>
            <p className="text-sm font-semibold">图片预览</p>
            <p className="mt-1 text-xs text-white/70">
              解析图片 {image.index + 1} · {image.width} × {image.height}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label="关闭图片预览"
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        <div className="relative min-h-[55vh] overflow-hidden rounded-3xl bg-black/30 sm:min-h-[72vh]">
          <Image
            src={image.url}
            alt={`解析图片 ${image.index + 1} 放大预览`}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        <div className="flex justify-end">
          <ResourceActions
            href={image.url}
            downloadLabel="下载原图"
            filename={getImageFilename(image.url, image.index)}
            prominent
            proxyDownload
          />
        </div>
      </div>
    </div>
  );
}

function DocSection() {
  return (
    <section id="doc-section" className="bg-canvas py-12 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(360px,5fr)] lg:items-start lg:px-8">
        <div className="lg:sticky lg:top-8">
          <p className="text-xs font-semibold text-muted">使用指南</p>
          <h2 className="mt-2 font-display text-2xl font-medium leading-tight text-ink sm:text-4xl">
            使用说明与链接获取指南
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-body sm:text-base">
            按图示从豆包或千问页面复制分享链接，再粘贴到上方输入框开始解析。
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Image
            src="/share.png"
            alt="使用说明与链接获取指南"
            width={1412}
            height={1492}
            sizes="(min-width: 1024px) 560px, (min-width: 640px) 72vw, 100vw"
            className="h-auto w-full max-w-140 rounded-3xl border border-hairline bg-surface-soft shadow-soft"
          />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-surface-soft">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-sm font-semibold text-ink">No Mark</p>
          <p className="mt-2 text-sm text-body">干净、直接、即刻下载。</p>
          <p className="mt-2 text-sm text-body">
            <Link
              href="https://www.wankong.top"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-ink no-underline"
            >
              @Wankong
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
          <a
            href="https://github.com/wan-kong/doubao-nomark-online"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-ink no-underline"
          >
            GitHub
            <RiExternalLinkLine size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}

function _StatRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between bg-canvas px-4 py-3 ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function ResourceActions({
  href,
  downloadLabel,
  filename,
  prominent = false,
  proxyDownload = false,
}: {
  href: string;
  downloadLabel: string;
  filename?: string;
  prominent?: boolean;
  proxyDownload?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {proxyDownload ? (
        <ProxyDownloadButton
          href={href}
          label={downloadLabel}
          filename={filename}
        />
      ) : (
        <DownloadLink
          href={href}
          label={downloadLabel}
          filename={filename}
          prominent={prominent}
        />
      )}
      <CopyLinkButton href={href} />
    </div>
  );
}

function ProxyDownloadButton({
  href,
  label,
  filename,
}: {
  href: string;
  label: string;
  filename?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);

    try {
      const response = await fetch(href);

      if (!response.ok) {
        throw new Error("Image download failed");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      triggerDownload(blobUrl, filename ?? "doubao-image.jpg");
      URL.revokeObjectURL(blobUrl);
    } catch {
      openInNewWindow(href);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={resourceActionClassName(
        "border border-hairline bg-canvas disabled:text-muted",
      )}
    >
      <RiDownloadLine size={14} />
      <span className="text-sm font-medium">
        {" "}
        {downloading ? "下载中" : label}
      </span>
    </button>
  );
}

function CopyLinkButton({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={resourceActionClassName(
        "border border-hairline bg-canvas disabled:text-muted",
      )}
      aria-label="复制下载地址"
    >
      {copied ? <RiCheckLine size={14} /> : <RiFileCopyLine size={14} />}
      <span className="text-sm font-medium"> {copied ? "已复制" : "复制"}</span>
    </button>
  );
}

function DownloadLink({
  href,
  label,
  filename,
  prominent = false,
}: {
  href: string;
  label: string;
  filename?: string;
  prominent?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      download={filename}
      rel="noopener noreferrer"
      className={resourceActionClassName(
        prominent
          ? "bg-primary text-white hover:bg-primary-active"
          : "border border-hairline bg-canvas text-ink hover:border-ink",
      )}
    >
      <RiDownloadLine size={14} />
      {label}
    </a>
  );
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");

  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openInNewWindow(href: string) {
  const link = document.createElement("a");

  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function resourceActionClassName(variantClassName: string) {
  return `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold no-underline transition ${variantClassName}`;
}

function getImageFilename(url: string, index: number) {
  const extension = getFileExtension(url) ?? "jpg";

  return `doubao-image-${index + 1}.${extension}`;
}

function getFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const matched = pathname.match(/\.([a-zA-Z0-9]+)$/);

    return matched?.[1]?.toLowerCase();
  } catch {
    const matched = url.split("?")[0]?.match(/\.([a-zA-Z0-9]+)$/);

    return matched?.[1]?.toLowerCase();
  }
}
