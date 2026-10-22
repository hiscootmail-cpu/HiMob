import { Suspense } from "react";

import { ExploreSkeleton } from "@/components/explore/explore-skeleton";
import { ExploreView } from "@/components/explore/explore-view";
import { HowItWorks } from "@/components/explore/how-it-works";
import { todayInSaoPaulo } from "@/lib/booking";
import { listEquipment } from "@/lib/equipment-db";
import { isSignedIn } from "@/lib/session";
import { currentTrip, listMyTrips } from "@/lib/trips";

async function ExploreData({ signedIn }: { signedIn: boolean }) {
  const today = todayInSaoPaulo();
  const [items, trips] = await Promise.all([listEquipment(), listMyTrips(today)]);
  // Rider em viagem (aba Rider): da ida até a volta, o Explorar abre na cidade da viagem.
  const travel = currentTrip(trips, today);
  return <ExploreView items={items} signedIn={signedIn} travelCity={travel ? { city: travel.city, uf: travel.uf } : null} />;
}

/** Home: busca de equipamentos, com lista e mapa. Sem conta: "Como funciona" em cima. */
export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <>
      {signedIn ? null : <HowItWorks />}
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreData signedIn={signedIn} />
      </Suspense>
    </>
  );
}
