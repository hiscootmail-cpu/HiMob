# Mercado Pago na Hi Scoot

Decisões de 19/10/2026:

- Todo cadastro (Host ou Rider) conecta a conta Mercado Pago antes de usar a plataforma.
- O Rider paga com PIX ou cartão de crédito à vista, no formulário seguro do Mercado Pago.
- O Mercado Pago divide o pagamento: a parte da Hi Scoot fica com a Hi Scoot e as diárias vão para o Host.
- A Hi Scoot paga a taxa do Mercado Pago. Taxa da conta (Checkout Transparente, recebimento em 30 dias):
  cartão à vista 3,98%; PIX: falta informar (o PIX fica desligado até lá).
- Host que cancela reserva paga: o Rider recebe tudo de volta e a taxa de 15% fica pendente,
  descontada na próxima reserva paga do Host.

## Chaves (configurações da Vercel, nunca no Git nem no chat)

| Nome | Onde pegar |
|---|---|
| `NEXT_PUBLIC_MP_CLIENT_ID` | Mercado Pago Developers → HiScoot → Informações gerais → Número da aplicação |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Credenciais de teste (depois, de produção) → Public Key |
| `MP_CLIENT_SECRET` | Credenciais → Client Secret |
| `MP_WEBHOOK_SECRET` | Webhooks → Assinatura secreta |
| `MP_TEST_MODE` | `true` durante os testes; apagar para usar dinheiro de verdade |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key |

## Endereços cadastrados no Mercado Pago

- URL de redirecionamento (OAuth, com PKCE): `https://hi-mob.vercel.app/mercado-pago/callback`
- Webhooks (evento "Pagamentos"): `https://hi-mob.vercel.app/api/mercado-pago/webhook`

## Ligar

Depois das chaves na Vercel e de um novo deploy, no SQL Editor da Supabase:

```sql
update public.app_settings set value = 'on' where key = 'mercado_pago';
```

Para desligar (volta o pagamento de teste): `value = 'off'`.

## Conferir no primeiro teste

- A devolução quando o Rider cancela é tirada pelo Mercado Pago das duas partes, na proporção
  de cada uma. A taxa pendente do Host nesse caso é uma estimativa (lib/payment-split.ts).
- Se um pagamento for aprovado depois que a reserva foi cancelada, ele aparece no painel do
  Mercado Pago e precisa ser devolvido por lá.
