/*
 * Endereço e chave pública do projeto Supabase. Vêm do arquivo de chaves
 * (.env.local, fora do Git) ou das configurações da hospedagem.
 * Sem eles, o site roda no modo de demonstração (dados de exemplo).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
