import "server-only";

import { countDays } from "@/lib/booking";
import type { Booking, BookingStatus } from "@/lib/bookings";
import { FALLBACK_LOCATION, type EquipmentType } from "@/lib/equipment";
import type { HostBooking } from "@/lib/host";
import { exampleBookings } from "@/lib/mock/bookings";
import { supabaseConfigured } from "@/lib/supabase/config";
import { equipmentPhotoUrl } from "@/lib/supabase/photos";
import { createClient } from "@/lib/supabase/server";

/*
 * Reservas lidas do banco (etapa 4). As regras de segurança do banco só
 * entregam as reservas em que a pessoa conectada é o Rider ou o Host.
 */

const SELECT = `
  id, rider_id, host_id, start_date, end_date, host_daily_price, pickup_time, return_time,
  status, rider_reviewed, host_reviewed,
  equipment(id, host_id, type, title, description, daily_price, city, area, latitude, longitude,
            pickup_time, return_time, is_available, equipment_photos(path, position)),
  host:profiles!bookings_host_id_fkey(display_name, identity_status, host_since),
  rider:profiles!bookings_rider_id_fkey(display_name, identity_status)
`;

type Row = {
  id: string;
  rider_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  host_daily_price: number;
  pickup_time: string;
  return_time: string;
  status: BookingStatus;
  rider_reviewed: boolean;
  host_reviewed: boolean;
  equipment: {
    id: string;
    host_id: string;
    type: EquipmentType;
    title: string;
    description: string;
    daily_price: number;
    city: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
    pickup_time: string;
    return_time: string;
    is_available: boolean;
    equipment_photos: { path: string; position: number }[];
  } | null;
  host: { display_name: string; identity_status: string; host_since: number | null } | null;
  rider: { display_name: string; identity_status: string } | null;
};

const hhmm = (time: string) => time.slice(0, 5);

function fromRow(row: Row): HostBooking {
  const e = row.equipment;
  return {
    id: row.id,
    rider_id: row.rider_id,
    start_date: row.start_date,
    end_date: row.end_date,
    days: countDays(row.start_date, row.end_date),
    host_daily_price: Number(row.host_daily_price),
    pickup_time: hhmm(row.pickup_time),
    return_time: hhmm(row.return_time),
    status: row.status,
    pickup_address: null,
    rider_reviewed: row.rider_reviewed,
    host_reviewed: row.host_reviewed,
    rider: {
      id: row.rider_id,
      full_name: row.rider?.display_name ?? "",
      verified: row.rider?.identity_status === "approved",
    },
    equipment: {
      id: e?.id ?? "",
      host_id: row.host_id,
      type: e?.type ?? "scooter",
      title: e?.title ?? "",
      description: e?.description ?? "",
      daily_price: Number(e?.daily_price ?? row.host_daily_price),
      city: e?.city ?? "",
      area: e?.area ?? "",
      photos: [...(e?.equipment_photos ?? [])].sort((a, b) => a.position - b.position).map((p) => equipmentPhotoUrl(p.path)),
      latitude: e?.latitude ?? FALLBACK_LOCATION.latitude,
      longitude: e?.longitude ?? FALLBACK_LOCATION.longitude,
      is_available: e?.is_available ?? false,
      pickup_time: hhmm(e?.pickup_time ?? row.pickup_time),
      return_time: hhmm(e?.return_time ?? row.return_time),
      rating: null,
      host: {
        id: row.host_id,
        full_name: row.host?.display_name ?? "",
        verified: row.host?.identity_status === "approved",
        host_since: row.host?.host_since ?? new Date().getFullYear(),
        rating: null,
      },
    },
  };
}

/** Reservas da pessoa conectada como Rider ou como Host. */
export async function realBookings(role: "rider" | "host", id?: string): Promise<HostBooking[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return [];
  let query = supabase
    .from("bookings")
    .select(SELECT)
    .eq(role === "rider" ? "rider_id" : "host_id", user.id)
    .order("start_date", { ascending: false });
  if (id) query = query.eq("id", id);
  const { data } = await query;
  return ((data ?? []) as unknown as Row[]).map(fromRow);
}

/*
 * Com a Supabase: as reservas da pessoa conectada.
 * Sem a Supabase (demonstração): os exemplos.
 */
export async function listRiderBookings(): Promise<Booking[]> {
  return supabaseConfigured() ? realBookings("rider") : exampleBookings;
}

export async function getRiderBooking(id: string): Promise<Booking | null> {
  if (!supabaseConfigured()) return exampleBookings.find((booking) => booking.id === id) ?? null;
  const booking = (await realBookings("rider", id))[0];
  if (!booking) return null;
  // Endereço exato: o banco só entrega depois do pagamento.
  if (["confirmed", "active", "completed"].includes(booking.status)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("pickup_address", { b: booking.id });
    booking.pickup_address = (data as string | null) ?? null;
  }
  return booking;
}
