# Convex — TechProt Web

Backend para persistência de redes (`networks`).

## Rodar local

```bash
npx convex dev
```

Usa `CONVEX_URL`/`CONVEX_DEPLOYMENT` de `.env.local` (já configurado para `http://127.0.0.1:3210`).

O comando sincroniza `convex/schema.ts` e `convex/networks.ts`, e abre o dashboard local (ex.: `http://127.0.0.1:3210` / porta exibida no terminal).

## Testar via Dashboard

1. Com `npx convex dev` rodando, abra a URL do dashboard mostrada no terminal.
2. Em **Data** verifique a tabela `networks`.
3. Em **Functions** teste:
   - `networks:list` — lista todas as redes
   - `networks:get` — `{ id: "<id>" }`
   - `networks:upsert` — `{ name, xml }` cria; `{ id, name, xml }` atualiza se existir
   - `networks:remove` — `{ id: "<id>" }`

## Deploy

```bash
npx convex deploy
```

(Equivalente ao script `npm run prod`)
