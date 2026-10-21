import { Suspense } from "react";

import { ExploreSkeleton } from "@/components/explore/explore-skeleton";
import { ExploreView } from "@/components/explore/explore-view";
import { todayInSaoPaulo } from "@/lib/booking";
import { listEquipment } from "@/lib/equipment-db";
import { activeTravel, getCurrentUser } from "@/lib/session";

async function ExploreData() {
  const [items, user] = await Promise.all([listEquipment(), getCurrentUser()]);
  // Rider em viagem (aba Rider): o Explorar abre na cidade da viagem.
  const travel = activeTravel(user, todayInSaoPaulo());
  return <ExploreView items={items} travelCity={travel ? { city: travel.city, uf: travel.uf } : null} />;
}

/** Home: busca de patinetes e bikes elétricas, com lista e mapa. */
export default function HomePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreData />
    </Suspense>
  );
}
