/*
 * Verificação de identidade: a equipe confere se o nome no documento
 * (frente e verso) é o mesmo informado no cadastro.
 *
 * Regra aprovada em 08/10/2026: se não bater, a pessoa pode reenviar uma vez.
 * Na segunda recusa, o cadastro é bloqueado.
 */

export const MAX_DOCUMENT_REJECTIONS = 2;

export type IdentityStatus = "pending" | "rejected" | "blocked" | "approved";

export const identityStatuses: IdentityStatus[] = ["pending", "rejected", "blocked", "approved"];

export type IdentityCheck = {
  status: IdentityStatus;
  /** Quantas vezes o documento já foi recusado. */
  rejections: number;
  /** Motivo escrito pela equipe na última recusa. */
  reason?: string;
};

/** Situação a partir do número de recusas (a regra que o servidor vai aplicar). */
export function statusAfterRejection(rejections: number): IdentityStatus {
  return rejections >= MAX_DOCUMENT_REJECTIONS ? "blocked" : "rejected";
}
