"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { HELP_TOPICS, MESSAGE_MAX, SOS_TOPICS } from "@/lib/support";

/* Central de ajuda e SOS (decisão de 22/10/2026). */

export type SupportState = { error?: "messageRequired" | "messageTooLong" | "topicRequired" | "unexpected" | "tooMany"; done?: boolean };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function checkBody(body: string): SupportState["error"] {
  if (!body) return "messageRequired";
  if (body.length > MESSAGE_MAX) return "messageTooLong";
  return undefined;
}

/** "Falar com a equipe": abre o atendimento e leva para a conversa. */
export async function openTicket(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const topic = text(formData, "topic");
  const body = text(formData, "message");
  const booking = text(formData, "booking") || null;
  if (!(HELP_TOPICS as readonly string[]).includes(topic)) return { error: "topicRequired" };
  const bodyError = checkBody(body);
  if (bodyError) return { error: bodyError };
  if (!supabaseConfigured()) redirect("/help/atendimento-exemplo-1?sent=1");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_support_ticket", { p_topic: topic, p_body: body, p_booking: booking });
  if (error || !data) return { error: error?.message === "too_many" ? "tooMany" : "unexpected" };
  redirect(`/help/${data}`);
}

/** Nova mensagem no atendimento (a pessoa ou a equipe). A equipe pode encerrar. */
export async function sendMessage(ticketId: string, _prev: SupportState, formData: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const body = text(formData, "message");
  const close = formData.get("close") === "on" && user.is_admin;
  if (!close) {
    const bodyError = checkBody(body);
    if (bodyError) return { error: bodyError };
  } else if (body.length > MESSAGE_MAX) return { error: "messageTooLong" };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("send_support_message", { p_ticket: ticketId, p_body: body, p_close: close });
    if (error) return { error: "unexpected" };
  }
  revalidatePath(`/help/${ticketId}`);
  revalidatePath(`/admin/support/${ticketId}`);
  return { done: true };
}

/** SOS durante o uso: avisa a equipe e o Host na hora. */
export async function reportSos(bookingId: string, _prev: SupportState, formData: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const topic = text(formData, "topic");
  const body = text(formData, "message");
  if (!(SOS_TOPICS as readonly string[]).includes(topic)) return { error: "topicRequired" };
  if (body.length > MESSAGE_MAX) return { error: "messageTooLong" };
  const lat = Number(text(formData, "latitude"));
  const lng = Number(text(formData, "longitude"));
  const hasPoint = text(formData, "latitude") !== "" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!supabaseConfigured()) redirect("/help/atendimento-exemplo-1?sos=1");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_sos", {
    p_booking: bookingId,
    p_topic: topic,
    p_body: body,
    p_lat: hasPoint ? lat : null,
    p_lng: hasPoint ? lng : null,
  });
  if (error || !data) return { error: "unexpected" };
  redirect(`/help/${data}?sos=1`);
}
