import { Suspense } from "react";

import { ExploreSkeleton } from "@/components/explore/explore-skeleton";
import { ExploreView } from "@/components/explore/explore-view";
import { todayInSaoPaulo } from "@/lib/booking";
import { listEquipment } from "@/lib/equipment-db";
import { currentTrip, listMyTrips } from "@/lib/trips";

async function ExploreData() {
  const today = todayInSaoPaulo();
  const [items, trips] = await Promise.all([listEquipment(), listMyTrips(today)]);
  // Rider em viagem (aba Rider): da ida até a volta, o Explorar abre na cidade da viagem.
  const travel = currentTrip(trips, today);
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
