"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Cliente da Supabase no navegador, com a sessão da pessoa conectada.
 * Usado só para enviar arquivos direto para a pasta da pessoa (sem passar pelo
 * servidor do site, que tem limite de tamanho de envio). As regras das pastas
 * continuam valendo: cada pessoa só grava na própria pasta.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

/** Envia arquivos para <bucket>/<id da pessoa>/<prefixo>-<n>.<ext>. Devolve os caminhos. */
export async function uploadOwnFiles(
  bucket: "equipment-photos" | "identity-documents" | "handoff-photos",
  prefix: string,
  files: File[],
): Promise<string[] | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const stamp = Date.now();
  const paths: string[] = [];
  for (const [index, file] of files.entries()) {
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/heic" ? "heic" : "jpg";
    const path = `${user.id}/${prefix}-${stamp}-${index}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) return null;
    paths.push(path);
  }
  return paths;
}
