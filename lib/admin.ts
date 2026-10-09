import { exampleIdentityQueue, exampleListingQueue } from "@/lib/mock/admin";
import type { EquipmentType } from "@/lib/equipment";
import { supabaseConfigured } from "@/lib/supabase/config";
import { equipmentPhotoUrl } from "@/lib/supabase/photos";
import { createClient } from "@/lib/supabase/server";

export { REASON_MAX, REASON_MIN, validateReason } from "@/lib/admin-rules";

/*
 * Painel do administrador (inventário de ações):
 * - Anúncios pendentes: Motivo + Rejeitar / Aprovar.
 * - Cadastros pendentes: Ver documento enviado + Motivo + Rejeitar / Aprovar.
 * Decisões de 09/10/2026:
 * - O Motivo é obrigatório para recusar (ele vai para a pessoa e ensina a corrigir).
 * - Edições de anúncio também passam por aqui; o anúncio antigo segue no ar até a decisão.
 * - As filas mostram o pedido mais antigo primeiro.
 *
 * SEGURANÇA: só a equipe entra. O servidor confere em cada tela E em cada
 * ação; esconder o link não protege nada. Documento e carta são dado sensível
 * (LGPD): só a equipe de verificação vê.
 */

export type ListingChange = {
  field: "title" | "type" | "daily_price" | "description" | "photos" | "city" | "area" | "times" | "pickup_address" | "location";
  before: string;
  after: string;
};

export type AdminListing = {
  id: string;
  kind: "new" | "edit";
  title: string;
  type: EquipmentType;
  description: string;
  daily_price: number;
  area: string;
  city: string;
  photos_count: number;
  host: { id: string; name: string; verified: boolean };
  /** Data e hora do envio (ISO). */
  sent_at: string;
  /** Só nas edições: o que mudou. */
  changes?: ListingChange[];
  /** Só nas edições: o número da edição (a decisão vale para ela). */
  edit_id?: string;
  /** Fotos para conferir (nas edições com fotos novas, as novas). */
  photos?: string[];
};

export type AdminIdentity = {
  id: string;
  user_id: string;
  /** Nome completo do cadastro, para comparar com o documento. */
  full_name: string;
  sent_at: string;
  /** Documento (frente e verso) ou carta com nome social e CPF. */
  kind: "document" | "letter";
  /** Recusas anteriores (na 2ª, o cadastro é bloqueado). */
  rejections: number;
  /** Links temporários (5 minutos) para a equipe ver os arquivos. */
  files?: { part: "front" | "back" | "letter"; url: string }[];
};

const oldestFirst = <T extends { sent_at: string }>(items: T[]) => [...items].sort((a, b) => a.sent_at.localeCompare(b.sent_at));

const money = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

type QueueEquipment = {
  id: string;
  type: EquipmentType;
  title: string;
  description: string;
  daily_price: number;
  city: string;
  area: string;
  pickup_time: string;
  return_time: string;
  last_sent_at: string;
  host_id: string;
  equipment_photos: { path: string; position: number }[];
  equipment_private: { pickup_address: string; latitude: number; longitude: number } | null;
  host: { display_name: string; identity_status: string } | null;
};

const EQUIPMENT_FIELDS =
  "id, type, title, description, daily_price, city, area, pickup_time, return_time, last_sent_at, host_id, equipment_photos(path, position), equipment_private(pickup_address, latitude, longitude), host:profiles!equipment_host_id_fkey(display_name, identity_status)";

function baseItem(e: QueueEquipment): Omit<AdminListing, "kind" | "sent_at"> {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    description: e.description,
    daily_price: Number(e.daily_price),
    area: e.area,
    city: e.city,
    photos_count: e.equipment_photos.length,
    photos: [...e.equipment_photos].sort((a, b) => a.position - b.position).map((p) => equipmentPhotoUrl(p.path)),
    host: { id: e.host_id, name: e.host?.display_name ?? "", verified: e.host?.identity_status === "approved" },
  };
}

/** O que mudou numa edição, para a equipe comparar "antes" e "depois". */
function describeChanges(e: QueueEquipment, c: Record<string, unknown>): ListingChange[] {
  const list: ListingChange[] = [];
  const text = (field: ListingChange["field"], key: string, before: unknown) => {
    if (key in c) list.push({ field, before: String(before ?? ""), after: String(c[key] ?? "") });
  };
  text("title", "title", e.title);
  text("type", "type", e.type);
  if ("daily_price" in c) list.push({ field: "daily_price", before: money(e.daily_price), after: money(c.daily_price) });
  text("description", "description", e.description);
  text("city", "city", e.city);
  text("area", "area", e.area);
  if ("pickup_time" in c || "return_time" in c) {
    list.push({
      field: "times",
      before: `${e.pickup_time.slice(0, 5)} – ${e.return_time.slice(0, 5)}`,
      after: `${String(c.pickup_time ?? e.pickup_time).slice(0, 5)} – ${String(c.return_time ?? e.return_time).slice(0, 5)}`,
    });
  }
  text("pickup_address", "pickup_address", e.equipment_private?.pickup_address);
  if ("latitude" in c || "longitude" in c) {
    const p = e.equipment_private;
    list.push({
      field: "location",
      before: p ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` : "",
      after: `${Number(c.latitude ?? p?.latitude).toFixed(4)}, ${Number(c.longitude ?? p?.longitude).toFixed(4)}`,
    });
  }
  if (Array.isArray(c.photos)) list.push({ field: "photos", before: String(e.equipment_photos.length), after: String(c.photos.length) });
  return list;
}

/*
 * Com a Supabase: consultas que só a equipe consegue fazer (o banco recusa as
 * demais pessoas). Sem a Supabase (demonstração): os exemplos.
 */
export async function listListingQueue(): Promise<AdminListing[]> {
  if (!supabaseConfigured()) return oldestFirst(exampleListingQueue);
  const supabase = await createClient();
  const [{ data: fresh }, { data: edits }] = await Promise.all([
    supabase.from("equipment").select(EQUIPMENT_FIELDS).eq("review_status", "pending"),
    supabase
      .from("equipment_edits")
      .select(`id, changes, created_at, equipment(${EQUIPMENT_FIELDS})`)
      .eq("status", "pending"),
  ]);

  const newItems: AdminListing[] = ((fresh ?? []) as unknown as QueueEquipment[]).map((e) => ({
    ...baseItem(e),
    kind: "new",
    sent_at: e.last_sent_at,
  }));
  const editItems: AdminListing[] = ((edits ?? []) as unknown as { id: string; changes: Record<string, unknown>; created_at: string; equipment: QueueEquipment }[])
    .filter((ed) => ed.equipment)
    .map((ed) => ({
      ...baseItem(ed.equipment),
      kind: "edit",
      edit_id: ed.id,
      sent_at: ed.created_at,
      changes: describeChanges(ed.equipment, ed.changes),
      photos: Array.isArray(ed.changes.photos)
        ? (ed.changes.photos as string[]).map(equipmentPhotoUrl)
        : baseItem(ed.equipment).photos,
    }));
  return oldestFirst([...newItems, ...editItems]);
}

export async function listIdentityQueue(): Promise<AdminIdentity[]> {
  if (!supabaseConfigured()) return oldestFirst(exampleIdentityQueue);
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("identity_submissions")
    .select("id, user_id, kind, front_path, back_path, letter_path, created_at")
    .eq("status", "pending");
  const list = rows ?? [];
  if (!list.length) return [];

  const { data: people } = await supabase
    .from("profile_private")
    .select("id, full_name, identity_rejections")
    .in("id", [...new Set(list.map((r) => r.user_id))]);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  // Links que valem 5 minutos, só para quem é da equipe (regra da pasta privada).
  const paths = list.flatMap((r) => [r.front_path, r.back_path, r.letter_path].filter(Boolean) as string[]);
  const { data: signed } = await supabase.storage.from("identity-documents").createSignedUrls(paths, 300);
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return oldestFirst(
    list.map((r) => {
      const parts: { part: "front" | "back" | "letter"; path: string | null }[] =
        r.kind === "document"
          ? [
              { part: "front", path: r.front_path },
              { part: "back", path: r.back_path },
            ]
          : [{ part: "letter", path: r.letter_path }];
      return {
        id: r.id,
        user_id: r.user_id,
        full_name: byId.get(r.user_id)?.full_name ?? "",
        sent_at: r.created_at,
        kind: r.kind as AdminIdentity["kind"],
        rejections: byId.get(r.user_id)?.identity_rejections ?? 0,
        files: parts.flatMap((p) => {
          const url = p.path ? urlOf.get(p.path) : undefined;
          return url ? [{ part: p.part, url }] : [];
        }),
      };
    }),
  );
}
