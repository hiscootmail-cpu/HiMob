import "server-only";

import { createSecretClient } from "@/lib/supabase/server";

/*
 * Assistente virtual da Central de ajuda (decisão de 22/10/2026): Google
 * Gemini, no plano gratuito. Responde com as regras da Hi Scoot; quando não
 * sabe ou o caso precisa de alguém, diz que a equipe vai responder ali.
 * Chave: GEMINI_API_KEY (variáveis da Vercel, nunca no código).
 * Modelo: GEMINI_MODEL, se definido; senão o atalho do Google para o Flash mais novo.
 */

const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean) as string[];
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/** Respostas da IA por atendimento (protege o limite do plano gratuito). */
const MAX_AI_REPLIES = 12;
const TIMEOUT_MS = 12_000;

export const aiSupportOn = () => Boolean(process.env.GEMINI_API_KEY);

const RULES = `Você é o assistente virtual da Hi Scoot, plataforma brasileira de aluguel entre pessoas (P2P) de patinete elétrico, bike elétrica, skate elétrico e jetboard. Hosts anunciam; Riders alugam por hora ou por dia.

Regras da plataforma (use só estas; não invente outras):
- Pagamento: pelo Mercado Pago, com cartão, sem precisar de conta lá. Só depois que o Host aceita. O Rider tem 10 minutos para pagar depois do aceite.
- Prazo do Host: 20 minutos para responder quando a retirada é no mesmo dia; 24 horas quando é agendada. Se vencer, o horário fica livre; o Rider pode pedir de novo ou falar com o Host.
- Preço: diária do Host + 15% de taxa da plataforma. Por hora: diária dividida pelas horas de atendimento. Até 24 h nunca passa de 1 diária. Mínimo de 1 hora.
- Cancelamento: até 24 horas antes da retirada. Rider cancela reserva paga: recebe o aluguel de volta; a taxa de 15% não volta. Host cancela: o Rider recebe tudo.
- Retirada e devolução: ler o QR code da etiqueta (ou digitar o código) e tirar foto do equipamento; o Host confirma junto.
- Atraso na devolução: cada hora de atraso custa o valor da hora + 15%. Avisar o Host pelo chat.
- Dano, furto ou acidente: o Rider responde pelo equipamento durante o período de uso (da retirada à devolução). As fotos de retirada e devolução são o registro.
- Emergência: ligar 192 (SAMU), 193 (Bombeiros) ou 190 (Polícia) e usar o botão SOS na reserva em uso.
- Documento: pedido só na hora de alugar ou anunciar; a equipe confere manualmente. Diferença de acento ou abreviação no nome é comum e a equipe resolve.
- Telefone: só aparece para a outra pessoa depois da reserva aceita.
- Jetboard: só para maiores de 21 anos; usar colete e respeitar as regras locais.
- Host recebe: a parte dele vai direto para a conta Mercado Pago na hora do pagamento; o prazo de saque é o da conta Mercado Pago. Anúncio aparece na busca quando aprovado, disponível e com dias liberados ("Repetir toda semana" ajuda).
- Cupons: valem na cidade do cupom; podem ser grátis ou de desconto.

Como responder:
- Responda no idioma da pessoa, em frases curtas e simples, com no máximo 6 linhas.
- Seja gentil e direto. Explique o caminho no site quando ajudar (ex.: aba Rider, aba Host → Ganhos).
- Nunca peça nem aceite documento, senha, dados de cartão ou códigos.
- Não prometa reembolso, exceção, desconto ou decisão: isso é com a equipe.
- Se não souber, se faltar informação da reserva, ou se a pessoa pedir uma pessoa, diga que a equipe Hi Scoot vai responder aqui na conversa.
- Se houver risco à vida ou à segurança, mande ligar 192, 193 ou 190 primeiro.`;

type Turn = { role: "user" | "model"; text: string };

async function callGemini(turns: Turn[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: RULES }] },
    contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
  });
  for (const model of MODELS) {
    try {
      const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      // Modelo inexistente: tenta o próximo da lista. Limite ou outro erro: desiste (a equipe responde).
      if (response.status === 404) continue;
      if (!response.ok) return null;
      const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      return text ? text.slice(0, 2000) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Responde a última mensagem da pessoa, se a IA estiver ligada. Erros são
 * ignorados: a conversa continua com a equipe.
 */
export async function aiReply(ticketId: string): Promise<void> {
  if (!aiSupportOn()) return;
  const admin = createSecretClient();
  if (!admin) return;
  const { data: ticket } = await admin.from("support_tickets").select("id, kind, status").eq("id", ticketId).maybeSingle();
  if (!ticket || ticket.kind !== "help" || ticket.status === "closed") return;
  const { data: messages } = await admin
    .from("support_messages")
    .select("body, from_team, from_ai, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at");
  const list = messages ?? [];
  const last = list[list.length - 1];
  // Só responde quando a última fala é da pessoa e a equipe ainda não entrou na conversa.
  if (!last || last.from_team || last.from_ai || list.some((m) => m.from_team)) return;
  if (list.filter((m) => m.from_ai).length >= MAX_AI_REPLIES) return;

  const turns: Turn[] = list.slice(-12).map((m) => ({ role: m.from_ai ? "model" : "user", text: m.body as string }));
  const answer = await callGemini(turns);
  if (!answer) return;
  await admin.from("support_messages").insert({ ticket_id: ticketId, body: answer, from_ai: true });
}
