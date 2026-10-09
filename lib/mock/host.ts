import { addDays, todayInSaoPaulo } from "@/lib/booking";
import type { BookingStatus } from "@/lib/bookings";
import type { HostBooking, HostListing } from "@/lib/host";
import { exampleEquipment } from "@/lib/mock/equipment";

/*
 * DADOS DE EXEMPLO da área do Host, só para conferir as telas.
 * O Host de exemplo é o Rafael S., dono do "Patinete Aro 10" e do "Patinete Pro".
 * Nomes de Riders, endereços e códigos são inventados.
 */

const today = todayInSaoPaulo();

const byId = (id: string) => {
  const equipment = exampleEquipment.find((item) => item.id === id);
  if (!equipment) throw new Error(`Equipamento de exemplo não encontrado: ${id}`);
  return equipment;
};

const aro10 = byId("eq-aro10-jardins");
const pro = byId("eq-pro-pinheiros");

export const exampleHostListings: HostListing[] = [
  {
    ...aro10,
    review_status: "approved",
    review_reason: null,
    // Editado há 10 dias: a próxima edição só daqui a 20 dias.
    last_edit_at: addDays(today, -10),
    edit_in_review: false,
    pickup_address: "Rua Oscar Freire, 300 (exemplo), Jardins, São Paulo",
    label_code: "HS-4821",
  },
  {
    ...pro,
    review_status: "approved",
    review_reason: null,
    last_edit_at: null,
    edit_in_review: false,
    pickup_address: "Rua dos Pinheiros, 500 (exemplo), Pinheiros, São Paulo",
    label_code: "HS-1946",
  },
  {
    ...aro10,
    id: "eq-bike-moema",
    type: "ebike",
    title: "Bike elétrica dobrável",
    description: "Bike elétrica dobrável, cabe no porta-malas. Bateria para cerca de 40 km.",
    daily_price: 40,
    area: "Moema",
    latitude: -23.6009,
    longitude: -46.6622,
    is_available: false,
    rating: { average: 4.8, count: 6 },
    review_status: "approved",
    review_reason: null,
    last_edit_at: addDays(today, -40),
    // Uma edição foi enviada e espera a análise: o anúncio antigo segue no ar.
    edit_in_review: true,
    pickup_address: "Avenida Ibirapuera, 2000 (exemplo), Moema, São Paulo",
    label_code: "HS-3378",
  },
  {
    ...aro10,
    id: "eq-novo-itaim",
    title: "Patinete Aro 8,5",
    description: "Patinete leve, ótimo para trajetos curtos. Autonomia de cerca de 20 km.",
    daily_price: 32,
    area: "Itaim Bibi",
    latitude: -23.5846,
    longitude: -46.6787,
    rating: null,
    review_status: "pending",
    review_reason: null,
    last_edit_at: null,
    edit_in_review: false,
    pickup_address: "Rua Joaquim Floriano, 50 (exemplo), Itaim Bibi, São Paulo",
    label_code: "HS-5590",
  },
  {
    ...aro10,
    id: "eq-recusado-centro",
    title: "Patinete urbano",
    description: "Patinete para o centro.",
    daily_price: 38,
    area: "República",
    latitude: -23.5432,
    longitude: -46.6425,
    rating: null,
    review_status: "rejected",
    review_reason: "As fotos não mostram o equipamento inteiro. Envie fotos de frente, de lado e do painel.",
    last_edit_at: null,
    edit_in_review: false,
    pickup_address: "Praça da República, 10 (exemplo), República, São Paulo",
    label_code: "HS-8813",
  },
];

const riders = {
  ana: { id: "rider-ana", full_name: "Ana P.", verified: true },
  lucas: { id: "rider-lucas", full_name: "Lucas T.", verified: true },
  marina: { id: "rider-marina", full_name: "Marina L.", verified: true },
  joao: { id: "rider-joao", full_name: "João V.", verified: true },
  beatriz: { id: "rider-beatriz", full_name: "Beatriz R.", verified: true },
  pedro: { id: "rider-pedro", full_name: "Pedro A.", verified: true },
  carla: { id: "rider-carla", full_name: "Carla D.", verified: true },
  diego: { id: "rider-diego", full_name: "Diego S.", verified: true },
  fernanda: { id: "rider-fernanda", full_name: "Fernanda C.", verified: true },
};

function booking(
  id: string,
  equipment: typeof aro10,
  rider: HostBooking["rider"],
  start: number,
  days: number,
  status: BookingStatus,
  host_reviewed = false,
): HostBooking {
  const paid = ["confirmed", "active", "completed"].includes(status);
  return {
    id,
    equipment,
    rider_id: rider.id,
    rider,
    start_date: addDays(today, start),
    end_date: addDays(today, start + days),
    days,
    host_daily_price: equipment.daily_price,
    pickup_time: equipment.pickup_time,
    return_time: equipment.return_time,
    status,
    pickup_address: paid ? (exampleHostListings.find((l) => l.id === equipment.id)?.pickup_address ?? null) : null,
    rider_reviewed: false,
    host_reviewed,
  };
}

export const exampleHostBookings: HostBooking[] = [
  booking("hb-2001", aro10, riders.ana, 11, 2, "pending"),
  booking("hb-2002", pro, riders.lucas, 9, 1, "pending"),
  booking("hb-2003", aro10, riders.marina, 3, 2, "accepted"),
  booking("hb-2004", pro, riders.joao, 0, 1, "confirmed"),
  booking("hb-2005", aro10, riders.beatriz, 7, 2, "confirmed"),
  booking("hb-2006", aro10, riders.pedro, -1, 2, "active"),
  booking("hb-2007", pro, riders.carla, -8, 2, "completed"),
  booking("hb-2008", aro10, riders.diego, -20, 1, "completed", true),
  booking("hb-2009", pro, riders.fernanda, -15, 1, "cancelled"),
];
