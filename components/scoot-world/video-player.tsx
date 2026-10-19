"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

import { youtubeEmbedUrl, youtubeThumbnail, type WorldVideo } from "@/lib/scoot-world-rules";

/**
 * Vídeo da HiTV. Mostra só a capa até a pessoa tocar em "assistir": a página
 * fica leve e o YouTube só carrega quando ela quer ver.
 */
export function VideoPlayer({ video }: { video: WorldVideo }) {
  const t = useTranslations("scootWorld.tv");
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-hs-black">
        {playing ? (
          <iframe
            src={`${youtubeEmbedUrl(video.youtube_id)}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={t("play", { title: video.title })}
            className="group absolute inset-0 flex items-center justify-center outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/60"
          >
            {/* Capa do próprio YouTube. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={youtubeThumbnail(video.youtube_id)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-hs-white/95 text-hs-black shadow-lg transition group-hover:scale-105">
              <Play className="ml-1 size-7" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="text-base font-semibold text-hs-black">{video.title}</figcaption>
    </figure>
  );
}
