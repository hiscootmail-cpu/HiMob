# Hi Scoot

A cidade se move. Vem no Flow.

Site da Hi Scoot, plataforma P2P de micromobilidade urbana.

## Tecnologia

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + peças no formato shadcn/ui
- Ícones oficiais em `components/icons.tsx` (Lucide quando faltar)
- Idiomas PT/EN com `next-intl` (textos em `messages/pt.json` e `messages/en.json`)

## Comandos

```bash
npm install
npm run dev          # site em http://localhost:3000
npm run build        # versão final
npm run lint         # verificação de qualidade
npm run typecheck    # verificação de tipos
npm run check:i18n   # confere se PT e EN têm os mesmos textos
```

## Páginas

- `/` página inicial (provisória até o Lote 3)
- `/design-system` página de conferência com todas as peças

Senhas e chaves nunca entram no repositório: ficam em `.env.local`, fora do Git.
