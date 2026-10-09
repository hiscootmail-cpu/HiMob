import type { Booking } from "@/lib/bookings";
import { addDays, todayInSaoPaulo } from "@/lib/booking";
import { exampleEquipment } from "@/lib/mock/equipment";

/*
 * RESERVAS DE EXEMPLO, uma em cada situação, só para conferir as telas.
 * O endereço de retirada é inventado e só aparece depois do pagamento.
 */

const byId = (id: string) => {
  const equipment = exampleEquipment.find((item) => item.id === id);
  if (!equipment) throw new Error(`Equipamento de exemplo não encontrado: ${id}`);
  return equipment;
};

const today = todayInSaoPaulo();
const RIDER = "rider-exemplo";

export const exampleBookings: Booking[] = [
  {
    id: "rv-1001",
    equipment: byId("eq-pro-pinheiros"),
    rider_id: RIDER,
    start_date: addDays(today, 6),
    end_date: addDays(today, 8),
    days: 2,
    host_daily_price: 55,
    status: "pending",
    pickup_address: null,
    rider_reviewed: false,
  },
  {
    id: "rv-1002",
    equipment: byId("eq-aro10-jardins"),
    rider_id: RIDER,
    start_date: addDays(today, 3),
    end_date: addDays(today, 5),
    days: 2,
    host_daily_price: 45,
    status: "accepted",
    pickup_address: null,
    rider_reviewed: false,
  },
  {
    id: "rv-1003",
    equipment: byId("eq-bike-vila-nova"),
    rider_id: RIDER,
    start_date: today,
    end_date: addDays(today, 1),
    days: 1,
    host_daily_price: 60,
    status: "confirmed",
    pickup_address: "Rua Joaquim Floriano, 100 (exemplo), Vila Nova Conceição, São Paulo",
    rider_reviewed: false,
  },
  {
    id: "rv-1004",
    equipment: byId("eq-dobravel-paulista"),
    rider_id: RIDER,
    start_date: addDays(today, -1),
    end_date: addDays(today, 1),
    days: 2,
    host_daily_price: 50,
    status: "active",
    pickup_address: "Avenida Paulista, 1000 (exemplo), Bela Vista, São Paulo",
    rider_reviewed: false,
  },
  {
    id: "rv-1005",
    equipment: byId("eq-leve-vila-madalena"),
    rider_id: RIDER,
    start_date: addDays(today, -12),
    end_date: addDays(today, -10),
    days: 2,
    host_daily_price: 35,
    status: "completed",
    pickup_address: "Rua Aspicuelta, 200 (exemplo), Vila Madalena, São Paulo",
    rider_reviewed: false,
  },
  {
    id: "rv-1006",
    equipment: byId("eq-aro10-jardins"),
    rider_id: RIDER,
    start_date: addDays(today, -30),
    end_date: addDays(today, -29),
    days: 1,
    host_daily_price: 45,
    status: "completed",
    pickup_address: "Rua Oscar Freire, 300 (exemplo), Jardins, São Paulo",
    rider_reviewed: true,
  },
  {
    id: "rv-1007",
    equipment: byId("eq-pro-pinheiros"),
    rider_id: RIDER,
    start_date: addDays(today, -20),
    end_date: addDays(today, -18),
    days: 2,
    host_daily_price: 55,
    status: "rejected",
    pickup_address: null,
    rider_reviewed: false,
  },
];
