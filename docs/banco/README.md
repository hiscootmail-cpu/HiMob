# Banco de dados (Supabase)

- `supabase/migrations/`: estrutura do banco. Cada arquivo roda uma única vez, em ordem,
  quando chega ao ramo `main` (integração Supabase + GitHub).
- `docs/banco/testes-seguranca-etapa-1.sql`: testes das regras de segurança (quem vê e
  quem mexe em cada dado). Rodam num Postgres local com `supabase-simulada.sql`, que imita
  o que a Supabase já tem pronto (login, pastas de arquivos e papéis anon/authenticated).

Como rodar os testes num Postgres 16 local:

```sh
createdb hs
psql -d hs -f docs/banco/supabase-simulada.sql
psql -d hs -v ON_ERROR_STOP=1 -f supabase/migrations/20261009140000_estrutura_inicial.sql
psql -d hs -v ON_ERROR_STOP=1 -f docs/banco/testes-seguranca-etapa-1.sql
```

Chaves e senhas NUNCA entram no repositório: ficam em `.env.local` (fora do Git) e nas
configurações da hospedagem.

Etapa 4 (reservas): rode todas as migrações, em ordem, e depois
`docs/banco/testes-etapa-4.sql` num banco novo.
Etapa 5 (conversas, avaliações e avisos): `docs/banco/testes-etapa-5.sql`, também
depois de todas as migrações.
Aviso de disponível e confirmação dupla: `docs/banco/testes-aviso-disponivel.sql` e
`docs/banco/testes-confirmacao-dupla.sql`, também depois de todas as migrações.
Telefone no cadastro: `docs/banco/testes-telefone.sql`, também depois de todas as migrações.
Mercado Pago: `docs/banco/testes-mercado-pago.sql`, também depois de todas as migrações.
Excluir conta: `docs/banco/testes-excluir-conta.sql`, também depois de todas as migrações.
Verificação para alugar e anunciar: `docs/banco/testes-verificacao.sql`, também depois de todas as migrações.
Mundo Scoot (loja, HiTV, lojas parceiras e oficinas): `docs/banco/testes-mundo-scoot.sql`, também depois de todas as migrações.
Compra na loja (estoque, frete, PIX, envio e devolução): `docs/banco/testes-loja.sql`, também depois de todas as migrações.
Anúncio com no mínimo 2 fotos: `docs/banco/testes-duas-fotos.sql`, também depois de todas as migrações.
Cupons de aluguel: `docs/banco/testes-cupons.sql`, também depois de todas as migrações.
A equipe cadastra equipamentos da Hi Scoot: `docs/banco/testes-equipe-anuncia.sql`, também depois de todas as migrações.
Dias disponíveis e aluguel por horas: `docs/banco/testes-horarios.sql`, também depois de todas as migrações.
Painel → Operação (números por cidade): `docs/banco/testes-operacao.sql`, também depois de todas as migrações.
Cidade onde mora e cidade secundária: `docs/banco/testes-cidades.sql`, também depois de todas as migrações.
Viagens do Rider e demanda: `docs/banco/testes-viagens.sql`, também depois de todas as migrações.
Novos tipos e jetboard para maiores de 21: `docs/banco/testes-novos-tipos.sql`, também depois de todas as migrações.
Prazos de resposta e pagamento: `docs/banco/testes-prazos.sql`, também depois de todas as migrações.
Cidade sem oferta: `docs/banco/testes-cidade-sem-oferta.sql`, também depois de todas as migrações.
Dias que se repetem e simulador: `docs/banco/testes-dias-semanais.sql`, também depois de todas as migrações.
Central de ajuda e SOS: `docs/banco/testes-atendimento.sql`, também depois de todas as migrações.
