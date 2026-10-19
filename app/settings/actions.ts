"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_SESSION_COOKIE, getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient, createSecretClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: "ongoing" | "failed" };

/**
 * "Excluir minha conta" (decisão de 19/10/2026). Só sem reservas em andamento.
 * A conta deixa de funcionar e some da plataforma; os dados ficam guardados
 * por segurança e só podem ser fornecidos à Justiça brasileira.
 */
export async function deleteAccount(): Promise<DeleteAccountState> {
  if (!supabaseConfigured()) {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
    redirect("/");
  }
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: error.message === "ongoing_bookings" ? "ongoing" : "failed" };

  // Com a chave da equipe, o login também é travado no provedor de login.
  const admin = createSecretClient();
  if (admin) await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  await supabase.auth.signOut();
  redirect("/");
}
