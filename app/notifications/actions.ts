"use server";

import { revalidatePath } from "next/cache";

import { markAllNotificationsRead } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export async function markAllRead() {
  if (!(await getCurrentUser())) return;
  await markAllNotificationsRead();
  revalidatePath("/", "layout");
}
