import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { VideoPlayer } from "@/components/scoot-world/video-player";
import { WorldHeading } from "@/components/scoot-world/world-heading";
import { listWorldVideos } from "@/lib/scoot-world";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld.tv");
  return { title: t("title"), description: t("subtitle") };
}

/** HiTV: canal de vídeos da Hi Scoot (YouTube). */
export default async function HiTvPage() {
  const t = await getTranslations("scootWorld.tv");
  const videos = (await listWorldVideos()).filter((v) => v.active);

  return (
    <div className="flex flex-col gap-6">
      <WorldHeading title={t("title")} subtitle={t("subtitle")} />
      {videos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoPlayer video={video} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
