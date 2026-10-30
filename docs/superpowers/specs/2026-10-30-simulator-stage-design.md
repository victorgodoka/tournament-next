# Simulador em palco 3D com a identidade da Omega

## Contexto

O Victor quer um `/simulator` mais elegante e completo, com animações bem feitas e um campo mais bonito. O ygolab é **inspiração de layout e de ritmo**, não um modelo a copiar. Quem manda no visual é a identidade da Omega. O simulador continua manual: sem motor de regras e sem nada automático.

Hoje ele é uma página normal do site, com Header, um grid plano de 7×3 e cartas de no máximo 84px.

Referências:
- Brand book: `project/README.md` do design system.
- `app/styles.css`.
- `public/SCREEN_1.png`, o campo do cliente Omega.
- `public/omega-hero.png`.
- Para composição e ritmo, o vídeo `C:\Users\marti\Videos\2026-10-30 11-23-14.mp4` e o CSS público do ygolab. O Solo deles não foi visto ao vivo, porque exige conta.

Decisões do Victor:
- Campo completo, com a metade do rival vazia e só como cenário.
- LP e fases manuais, gravados no replay.
- Cenário original.
- Tela cheia sem Header, sem VipPromo e sem anúncios.

## Conceito

O brand book pede "o lobby do cliente, refeito por um estúdio atual". Aqui vale o mesmo: **o campo do cliente Omega, refeito por um estúdio atual**.

Do cliente vêm a mesa flutuante, as zonas de vidro com aresta fina, o triângulo nas zonas de monstro, os losangos de Pendulum (azure à esquerda, crimson à direita) e o núcleo TURN no centro da mesa.

Do `omega-hero.png` vem a linguagem de luz: veios de circuito com dobras chanfradas e estilhaços de vidro à deriva. Do ygolab vêm a composição (mesa inclinada, mão plana embaixo, coluna à direita) e o ritmo.

## Regras da identidade

**Cromo (coluna, HUD, menus, diálogos): 100% design system.**
- Reusar `Panel`, `Button`, `Dialog`, `Chip`, `Segmented`, `RailHead`, `Alert`, `.cut` e `.notch`.
- Anton nos números (`stat-lg` no LP), Space Mono nos rótulos (`signal`), Figtree em nomes e frases. Sem fonte nova.
- Controles cortam canto superior esquerdo e inferior direito. Painéis e zonas têm o notch no canto superior direito.
- Seleção é aresta `cyan` de 2px. `cyan` no botão primário sobre a placa `azure`, e só nele a sombra dura.
- `gold` só para valor e prestígio, então sai da ativação, que hoje é dourada e passa a `cyan`. `crimson` para destruição.
- `steel` é a única superfície em destaque: a sua placa de LP, como "sua linha" no leaderboard.
- Sem círculos: núcleo do turno e medalhão de chain são hexágonos, herdados da moeda hexagonal do cliente.
- O Mark nunca é recolorido e só fica sobre `space-000`, `surface-100` ou `surface-200`.
- Texto em "you", botões em Title Case com verbo primeiro, termos do jogo como impressos, sem emoji.

**Exceções que o simulador pede ao brand book.** Luz e animação longa só existem **dentro do campo, durante um efeito**. O cromo fica plano, com transições de 120ms. Tudo para sob `prefers-reduced-motion`. Sem SiteNav nesta tela, como decidido.

**Limite legal.** Nada de copiar arte ou código do ygolab. Do lado da Omega, o `back.webp` e os assets oficiais seguem como estão.

## A tela

- **Fundo.** `space-000` com o `omega-hero.png` em `mix-blend-mode: screen` atrás do topo da mesa. Os raios e veios descem até o núcleo. Estilhaços de vidro à deriva e pulso lento nos veios, em CSS e sem JS. O encaixe `--room-art` fica para uma arte futura.
- **Mesa.** Placa flutuante em `surface-100` com notch, grade de hairlines em `line`, aresta `line-strong` e face frontal dando espessura. Veios finos em SVG correm sob as zonas, do núcleo às bordas.
- **Zonas.** Vidro `ground-soft` com aresta `line-mid` e notch. Espelhadas no lado do rival. O hover sobe um degrau de superfície e o alvo de drop ganha aresta `cyan`. Mantém os marks de GY, Banished, Pendulum e Field, e ganha o triângulo de monstro.
- **Núcleo.** Hexágono no centro da fileira dos EMZ, com o turno em Anton e a fase em `signal`. Clique avança a fase.
- **HUD.** Home e nome do deck no topo à esquerda. Sua placa de LP (`steel`) embaixo à esquerda, com a doca: Draw, Shuffle, Undo, Redo. Placa do rival (`surface-100`) no topo, à direita do palco.
- **Mão.** Plana, fora da mesa, em leque, cortada pela borda da tela. O hover levanta a carta e afasta as vizinhas. 5 versos do rival no topo, como cenário.
- **Coluna direita, 340px.**
  - Comandos: New Hand, Choose Hand, Deck, Save, More.
  - `01 Card`, com arte, stats e texto.
  - `02 Duel log`, narrado e agrupado por turno, com clique para voltar ao passo e campo de legenda.
  - `03 Zones`, com Deck, Extra, GY e Banished com contagem, abrindo a pile.
  - Base: replay com linha do tempo e velocidades, e End Turn como botão primário (atalho E).
- **Completa.**
  - Estado vazio com a mesa e Choose Deck no centro.
  - Pile viewer com busca.
  - Opener com 5 slots, Fill at random, grupos por tipo e detalhe à direita.
  - Ajuda de atalhos em `?`.
  - Avisos em pilha flutuante, em vez de empurrar a tela.

## Animações

Curva da marca: `cubic-bezier(0.2, 0.8, 0.2, 1)`. Durações no campo entre 300 e 700ms, calibradas contra o vídeo na etapa 0. Efeitos em WAAPI, numa camada plana sobre a mesa.

| Momento | Animação |
|---|---|
| Mover | Voo em arco: sobe, viaja e assenta com sombra. Pouso com ondulação quadrada de aresta `cyan` e flash curto da zona |
| Special Summon | Coluna de luz sobe da zona, estilhaços saem e o rótulo aparece em Anton |
| Normal Summon | Pouso com ondulação e rótulo, sem coluna |
| Set e Flip | Giro real em `rotateY` entre a arte e o `back.webp` |
| ATK/DEF | Giro suave de 90° |
| Draw e New Hand | Sai do deck, vira e entra no leque, em cascata |
| Shuffle | Deck tremula e os cards se embaralham |
| GY | Carta escurece, voa e a contagem da pile pulsa |
| Destruir | Rachadura `crimson`, depois a arte se parte em estilhaços |
| Banish | Carta se comprime em linhas `azure-lift` e some |
| Activate | Varredura `cyan`, pulso nos veios e hexágono de chain carimbado |
| Alvo | Traço de circuito com dobras chanfradas, do efeito até o alvo, com mira nos cantos |
| Negate | Traço `crimson` riscado na carta, herdado do `animate-strike`, e dessaturação |
| LP | Dígitos rolam, delta sobe com o sinal (`loss` ou `win`) e a barra drena |
| Turno | Faixa fina atravessa a mesa com o turno em Anton, e os veios varrem |

## Técnica

Tudo em DOM e CSS 3D, sem dependência nova.

- **Plano único.** `.mat` com `transform: perspective(var(--P)) rotateX(var(--tilt))`. `--P` é múltiplo de `--card-w`, para escalar de forma linear (`fitCardWidth` depende disso).
- **Fora do plano.** Mão, setas, HUD, menus e a camada de efeitos.
- **Sem mudança.** `elementFromPoint` e `getBoundingClientRect` respeitam 3D, então drag, `data-zone`, `data-card` e menus seguem iguais.
- **O que muda: o FLIP.** O `slide` em `board.tsx:246` usa coordenadas de tela, que erram no plano inclinado. Vira `app/simulator/fx.ts`: um clone voa numa camada plana enquanto a carta real fica oculta. Termina com `opacity: 0` e `fill: forwards`, e a camada limpa no passo seguinte.
- **Gravação de vídeo.** O `seek` em `combo-render.tsx:140` controla tudo que for WAAPI por `document.getAnimations()`, então os efeitos entram no vídeo. Esse `seek` reinicia toda animação a cada passo, então o ambiente fica desligado na página de render, com fundo estático.

## Decisões tomadas

- **MessengerDock.** Ele fica no `app/layout.tsx`, no canto inferior direito, em cima do End Turn. Some no `/simulator`.
- **Celular (abaixo de `lg`).** Sem inclinação e sem a metade do rival. Fluxo com rolagem como hoje, histórico no drawer. Long-press continua.
- **`/simulator/c/[id]`.** Mantém Header e anúncios, com a mesa nova numa caixa limitada e sem ambiente.
- **Fases.** `initial` e `endTurn` deixam a fase em `main1`. Combos antigos abrem sem erro.
- **Chain.** Derivada: `activate` consecutivos até o cursor formam a chain, sem estado novo.
- **Faixa de invocação.** Só via menu, com o novo campo `how`. Arrastar não mostra rótulo.
- **Fora, por serem automáticos.** Chain Auto, lembrete de efeito contínuo e pause automático de resolução.

## Etapas

Worktree `tournament-next/.worktrees/simulator-stage`, branch `feat/simulator-stage` a partir de `main`, não de `feat/series-cover`. O spec aprovado vai para `docs/superpowers/specs/2026-10-30-simulator-stage-design.md`. Cada etapa fecha com commit, testes e revisão visual no navegador.

0. **Calibragem e protótipo.** Extrair frames de alta taxa do vídeo para tirar ritmo. Montar a mesa estática com dados de exemplo e mostrar ao Victor **antes** de seguir, porque "mais bonito" só se valida vendo.
1. **Palco.**
   - `page.tsx` sem Header e VipPromo; `/simulator` em `NO_ADS` no `ads-mode.ts`, com teste; dock oculto.
   - `simulator.css`, importado no `layout.tsx`; `room.tsx`; mesa em `board.tsx`; `fx.ts` com o voo.
   - `simulator.client.tsx` no grid palco + coluna, com tudo que existe hoje em novo lugar.
2. **Efeitos.** Mão, pousos, invocações, GY, destruir, banish, ativação, alvo, negate, flip, draw e shuffle.
3. **Interação.** Menu com miniatura e atalhos numéricos, modo de escolher zona (reusa `moveOptions` de `utils/simulator/drop.ts`, resto escurece, Esc cancela), opener, pile viewer, ajuda e estado vazio.
4. **LP, fases, chain e log.**
   - Servidor primeiro: `lp`, `phase` e `how` em `combos.validation.ts` (`KINDS` e `parseAction`), testes e `docs/front/COMBOS_API.md`.
   - Front: `types.ts`, `board.ts`, `draft.ts`, `hud.tsx`, núcleo, derivação de chain, log em `messages/pt.json` e `en.json`.
5. **Replay e vídeo.** `combo-player.tsx`, `combo-render.tsx`, `fit.ts` medindo `[data-mat]`; passada em celular.

```ts
| { t: 'lp'; side: 'me' | 'rival'; delta: number }
| { t: 'phase'; to: 'draw' | 'standby' | 'main1' | 'battle' | 'main2' | 'end' }
// em move: how?: 'normal' | 'special' | 'set'
```

## Riscos

- **Ordem de deploy.** O servidor sobe antes do front, senão salvar um combo com `lp` ou `phase` dá 400.
- **Banco.** O `.env` local do `omega-server-v3` aponta para produção. Antes de rodar testes do servidor, confirmar que `combos.test.ts` é puro. Se tocar banco, parar e perguntar.
- **Salvar no dev grava em produção.** Testar save e compartilhamento só com o OK do Victor.
- **Testes.** `simulator.client.test.tsx` tem 76 consultas ao DOM. Rótulos e `data-*` ficam, mas testes de `toolbar`, `history` e drawer vão mudar. happy-dom não faz layout, então o 3D só se verifica no navegador.
- **Element Capture.** O `frame` em `combo-recorder.tsx:192` precisa seguir plano. Só se confirma gravando de verdade.
- **Desempenho.** Com muitos estilhaços e sombras, medir em notebook comum e reduzir o número de partículas se cair de 60 fps.

## Verificação

- `pnpm exec tsc --noEmit` e `pnpm vitest run --exclude ".claude/**"` no worktree.
- Testes de `combos` no servidor, depois do cuidado acima.
- Navegador embutido (`tournament-next`, porta 5173) em 1920×1080, 1280×720 e 375×812.
- Conferir o cromo contra o brand book: fontes, cortes, usos de `gold` e `cyan`, um só `steel`.
- Roteiro manual:
  - Carregar deck e usar o opener.
  - Hover na mão.
  - Invocar pelo menu escolhendo zona.
  - Arrastar até as bordas da mesa inclinada.
  - DEF e Xyz com materiais.
  - Ativar com alvo.
  - Enviar ao GY, destruir e banir.
  - Mudar LP e fase.
  - Undo e redo.
  - Replay nas 4 velocidades.
  - Recarregar e recuperar o rascunho.
  - Abrir um combo antigo.
  - Gravar vídeo em paisagem e em retrato.
- Emular `prefers-reduced-motion`.

## Entrega

Merge local `--no-ff` em `main`, como nas fases anteriores, sem MR e sem atribuição nos commits. Push só com pedido do Victor.
