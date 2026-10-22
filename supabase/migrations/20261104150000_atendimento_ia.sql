-- =============================================================================
-- Assistente virtual (IA) na Central de ajuda (decisão de 22/10/2026)
-- -----------------------------------------------------------------------------
-- As respostas automáticas do assistente (Google Gemini) ficam salvas na mesma
-- conversa, marcadas como "da IA". Só o servidor do site grava essas mensagens
-- (chave secreta); ninguém consegue se passar pela IA nem pela equipe.
-- SOS não passa pela IA.
-- =============================================================================

alter table public.support_messages add column from_ai boolean not null default false;
