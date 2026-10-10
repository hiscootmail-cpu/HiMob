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
