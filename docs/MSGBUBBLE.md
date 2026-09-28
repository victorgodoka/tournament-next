# Balões do messenger (`MSGBUBBLE`) — contrato front ↔ back

> **Para quem é:** quem mexe no `omega-server-v3` (loja, painel, import da planilha).
> **Fonte da verdade no front:** `utils/bubble.ts` (`parseBubble`). Se este arquivo e o código divergirem, o código ganha.

---

## 1. Resumo

- O visual de um balão fica no `data` do item (`shop_items.data`, JSON ≤ 4000 chars), que já existe. A imagem do item (`assetId` → `assetUrl`) é o **sticker** (a capivara na borda).
- **Nenhuma rota nova e nenhuma mudança obrigatória na API.** O painel já grava `data` e `assetId`, e o messenger já recebe `cosmetics.MSGBUBBLE` com `data` e `assetUrl` (SHOP_API.md §5).
- O front **não aceita CSS pronto**. O `data` guarda valores (cores, forma, posição), e o front valida cada um antes de virar estilo. Valor inválido cai no padrão, e o balão continua aparecendo.

## 2. Formato do `data`

```json
{
  "bg": "#ff5fa2",
  "bg2": "#ffb3d1",
  "text": "#ffffff",
  "border": "#ffffff",
  "shape": "pill",
  "sticker": { "at": "top-right", "size": 40, "dx": -8, "dy": -6, "animate": "bob" }
}
```

| Campo | Regra | Padrão |
|---|---|---|
| `bg` | cor hex `#rgb`, `#rrggbb` ou `#rrggbbaa` | `#1e2a4a` |
| `bg2` | hex ou `null`. Com valor, o fundo vira um gradiente 135° de `bg` até `bg2` | `null` |
| `text` | hex | `#ffffff` |
| `border` | hex ou `null` (sem borda) | `null` |
| `shape` | `square` \| `round` \| `pill` | `round` |
| `sticker.at` | `top-left` \| `top-right` \| `bottom-left` \| `bottom-right` | `top-right` |
| `sticker.size` | inteiro, 16–64 (px) | `40` |
| `sticker.dx`, `sticker.dy` | inteiro, −32–32 (px, ajuste a partir do canto) | `0` |
| `sticker.animate` | `none` \| `bob` \| `wiggle` (desligado com `prefers-reduced-motion`) | `none` |

- Chave desconhecida é ignorada. Número fora da faixa é limitado à faixa. Um `data` `{}` gera o balão padrão.
- O sticker só aparece quando o item tem imagem. O ideal é um PNG ou WebP com fundo transparente e pelo menos 128 px de lado.
- Nas mensagens do próprio duelista o balão fica à direita e o sticker é espelhado (`top-right` vira `top-left`).

## 3. Onde o front usa

| Tela | O que desenha |
|---|---|
| Messenger | Cada mensagem com o balão equipado de quem a enviou: `me.cosmetics.MSGBUBBLE` nas suas, `cosmetics.MSGBUBBLE` do contato nas dele. Sem balão equipado, fica o estilo padrão do messenger. |
| Loja (`/shop`) | O card de um item `MSGBUBBLE` mostra uma mensagem de exemplo com o próprio `data` e a imagem, no lugar de `/items/{id}.png`. |
| Painel (`/admin/shop`) | Com `type = MSGBUBBLE`, um formulário (cores, forma, canto, tamanho, ajuste e animação do sticker) escreve o `data`, com preview ao vivo. O campo JSON continua lá para edição manual. |

## 4. Pedidos ao back (opcionais)

1. **Validar `data` de `MSGBUBBLE` na escrita** (`POST`/`PUT /panel/shop/items`, e no import da planilha) com as regras do §2 e responder `400` com o campo na mensagem. Hoje um erro de digitação só aparece como "balão padrão" no front. Não é bloqueante: o front já descarta o que for inválido.
2. **Mais de uma imagem por item** — só se quisermos balões com **padrão de ícones personalizado** além do sticker (o próximo passo previsto). Proposta: `data.assets: string[]` com ids de `POST /panel/shop/assets/sign`, e o back resolvendo cada um em `data.assetUrls` na leitura, como já faz com `assetId` → `assetUrl`. Enquanto os padrões usarem só ícones do próprio front, isso não é necessário.
