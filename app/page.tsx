import { Suspense } from "react";

import { ExploreSkeleton } from "@/components/explore/explore-skeleton";
import { ExploreView } from "@/components/explore/explore-view";
import { listEquipment } from "@/lib/equipment-db";

async function ExploreData() {
  const items = await listEquipment();
  return <ExploreView items={items} />;
}

/** Home: busca de patinetes e bikes elétricas, com lista e mapa. */
export default function HomePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreData />
    </Suspense>
  );
}
