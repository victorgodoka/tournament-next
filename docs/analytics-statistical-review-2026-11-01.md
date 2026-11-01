# Revisão estatística do analytics (2026-11-01)

Escopo: `GET /statistics` e tudo que ele alimenta (omega-server-v3 `src/modules/analytics/*`, front `app/statistics/*`, `utils/statistics.ts`, `utils/power-tier.ts`, `scripts/wiki-tier-list.ts`), mais `/top-decks` e as estatísticas de torneio. Dados usados: o `/statistics` de produção de 2026-11-01 (TCG `tcg-3`, 13 dias, 645 070 deck-games; Genesys `genesys-1`, 42 dias, 214 454 deck-games), lido com `?archetypes=100`.

## Veredito

**Não refazer. Trocar a camada de inferência, manter a de contagem.**

O pipeline (varredura → estado somado por dia → build → corte) está correto no que conta e cuidadoso onde costuma dar errado: espelhos fora do win rate e dentro do share, taxas `null` quando a cobertura dos dias não é completa (nunca uma taxa misturada), "com vs sem carta" ponderado dentro de cada arquétipo (evita Simpson), matriz de matchups perfeitamente simétrica (0 pares com `wins(A×B) ≠ losses(B×A)` nos dois ladders). Isso não se joga fora.

O que está fraco é a parte que **interpreta** as contagens: intervalos, tiers, rankings, eventos e a chamada "favorável/desfavorável". Essa camada tem umas 200 linhas (`metaTiers`, `wilsonLower` como score, `consistencyOf`, `sleeperScoreOf`, o laço de `metaEvents`, `matchupStatus` no front) e dá para substituir sem mexer no sweep nem no formato dos dias guardados. Os problemas, em ordem de gravidade, com a evidência medida.

## 1. Os intervalos são estreitos demais: os games não são independentes

Wilson assume ensaios de Bernoulli independentes. Aqui a amostra é um deck-game, mas um Bo3 tem até 3 games dos mesmos dois jogadores, e os 5 pilotos mais ativos respondem pela mediana de 31% (TCG) a 39% (Genesys) dos games de um deck.

Medi a sobredispersão φ das taxas diárias (variância observada ÷ variância binomial esperada) nos 40 decks mais jogados:

| Ladder | φ mediana | q25 | q75 |
|---|---|---|---|
| TCG | 1.48 | 1.11 | 2.10 |
| Genesys | 1.48 | 0.87 | 1.77 |

φ = 1.5 significa que os ± mostrados deveriam ser ~22% mais largos (√1.5), e um deck com φ = 2 tem na prática metade da amostra que o site diz. Angelechy no TCG deu φ = 8.8: não é só ruído, é tendência real (60.8% no dia 1 caindo para ~55%), o que também mostra que o win rate agregado da temporada mistura regimes diferentes do mesmo deck.

Ressalva: produção ainda não manda `games` por ponto da tendência, então aproximei o n diário por share × volume médio do dia. O sinal é grande o bastante para não depender disso.

**Correção:** estimar φ por deck no build (os tallies diários já existem em `dayTallies`), usar n_eff = n/φ em todo intervalo e score do deck, e expor φ (ele é, aliás, a medida de "consistência" certa, ver item 5). Para matchups, que não têm série diária, usar o φ do deck.

## 2. O tier depende do tamanho da amostra, não só da força

`metaTiers` ordena pelo limite inferior de Wilson e mede a distância até o melhor deck. O limite inferior cai com n, então dois decks com o mesmo win rate caem em tiers diferentes só pela popularidade:

| Win rate do líder do TCG (55.17%) em n games | Wilson inferior | Pontos atrás do melhor | Tier |
|---|---|---|---|
| 68 330 (o próprio líder) | 0.5480 | 0.0 | 1 |
| 10 000 | 0.5419 | 0.6 | 1.5 |
| 2 000 | 0.5296 | 1.8 | 2 |
| 500 | 0.5082 | 4.0 | 3 |

Com as mesmas bandas sobre o win rate pontual, 5 de 33 decks mudam de tier no TCG e 12 de 55 no Genesys (Angelechy/Ashtra e Artmage, ambos a 60.0% em ~1 500 games, caem de T1.5 para T2 só por n). O texto da página promete "popularity doesn't count": hoje conta.

Segundo problema do mesmo desenho: a banda é relativa ao melhor deck. No Genesys o líder está em 60%, então Hecahands e Invoked (54–55%, claramente acima da média) são "Tier 4" e a faixa T1.5 ficou vazia. Qualquer oscilação do líder move todos os outros.

**Correção:** usar Wilson (ou o IC com φ) só como **elegibilidade** (pisos de share, pilotos e n), e como **score** uma estimativa encolhida (Beta-binomial empírica: prior em 50% com força ajustada no próprio ladder, que puxa amostra pequena para o meio sem puni-la como o limite inferior pune). Ancorar as bandas em pontos acima de 50% (escala absoluta, já que o win rate é soma zero) em vez da distância ao líder, ou pelo menos ao líder encolhido. O cap de 2 decks em T1 é editorial e pode ficar.

## 3. Os "eventos de meta" são indistinguíveis de ruído

A regra desliza uma janela dia a dia por 100 decks × 2 tipos e aceita um evento quando dois IC 95% não se cruzam. Simulei o nulo (win rate constante por deck, mesmos n diários) 100 vezes com a regra exata:

| Ladder | Eventos de win rate falsos por build (média) | Builds com ≥1 falso | Eventos reais no build de hoje |
|---|---|---|---|
| TCG | 2.3 | 94% | 3 |
| Genesys | 3.8 | 96% | 10 |

No TCG os 3 eventos mostrados são o que o acaso produz sozinho. No Genesys talvez metade seja real. E como fica "o maior salto" por deck, o `from → to` mostrado é inflado (winner's curse).

**Correção:** teste de duas proporções com controle de multiplicidade (Bonferroni sobre decks × janelas dá z ≈ 4.1; ou BH sobre todas as janelas), delta encolhido no texto, e preferir blocos fixos a janelas deslizantes. Com isso o painel mostra 0–2 eventos por semana e cada um merece ser lido.

## 4. A matriz de matchups chama "favorável" em células sem amostra

| Ladder | Células | < 30 games com resultado | < 100 | Chamadas fav/desfav | Chamadas com < 100 games |
|---|---|---|---|---|---|
| TCG | 8 704 | 71% | 90% | 1 194 | 900 (75%) |
| Genesys | 8 386 | 89% | 99% | 920 | 882 (96%) |

A regra do front (IC inteiro acima/abaixo de 50%) com n = 20 dispara com 16–4, e o filtro de games começa em 1. Sob o nulo, 5% de 8 704 células chamam errado: centenas de "favoráveis" falsos por build. O bloco 10×10 do TCG é confiável (mediana 933 games); fora dele, não.

**Correção:** (a) `minGames` inicial 100 na matriz e no "beats"; (b) encolher o win rate da célula para o win rate geral do deck (Beta-binomial de novo), porque o prior natural de "A contra B" é "A contra todo mundo", não 50%; (c) chamar favorável só quando o IC encolhido e com φ fica inteiro de um lado; (d) opcional, mostrar a célula como desvio do esperado (A×B menos o geral de A), que é o que um jogador quer saber.

## 5. Três rankings diferentes medem a mesma coisa: ser grande

`highestWinRate`, `sleeper` e `consistent` usam o limite inferior de Wilson como score. Correlação de Spearman com games no TCG: `consistencyScore` 0.62 (e 0.84 com o win rate), `sleeperScore` 0.60, `wilsonLower` 0.62. "Consistente" hoje significa "grande e bom"; "sleeper" (pouco jogado e forte) é contradito pelo próprio score, que pune exatamente os decks pouco jogados que ele quer achar.

No front novo (não commitado), a "estabilidade" é o desvio-padrão ponderado do win rate diário sem descontar o ruído binomial: um deck com 70 games por dia tem ±6 pontos de desvio só por acaso e parece instável.

**Correção:** `consistent` = φ (ou o p-valor do qui-quadrado de homogeneidade entre blocos), que é literalmente "variou mais do que a amostra explica"; `sleeper` = estimativa encolhida entre os decks com share < 5%; `highestWinRate` = estimativa encolhida, mantendo Wilson como coluna informativa.

## 6. Confundidores que nada ajusta (hoje só cabe aviso)

- **Mix de oponentes.** O win rate é soma zero e depende de quem o deck enfrentou. Um deck que cresce quando o meta está cheio de presas fáceis parece forte. Bradley–Terry sobre a matriz 100×100 (cabe em ~30 linhas, converge em milissegundos) dá a força ajustada por adversário; é a melhor base para o tier.
- **Concentração de pilotos.** `pilotShare` correlaciona −0.44 com o win rate no TCG: decks carregados por poucos jogadores vão pior, não melhor. O piso de 10 pilotos não captura isso; vale ao menos um aviso na linha e, com Bradley–Terry por jogador, um ajuste.
- **Faixa de rating atual, não da hora do game** (`withRatings`). Quem subiu até Platinum com o deck X leva todos os games de Iron para a faixa Platinum. É vazamento do futuro. A correção pede gravar a faixa na varredura (mudança de schema).
- **Primeiro vs segundo em G2/G3.** No TCG, ir primeiro ganha 56.0% no G1 e 51.8% depois do side. A queda é confundida pela regra "quem perdeu escolhe": em G2/G3 quem vai primeiro é, em média, o jogador mais fraco daquele match. O texto da página trata como efeito do side.
- **"Win rate quando usada"** de hand traps condiciona em ter comprado e tido alvo: Nibiru a 43.6% diz que quem precisou de Nibiru já estava perdendo, não que Nibiru perde. Precisa de nota.

## 7. Bugs e imprecisões menores

| Onde | O quê | Correção |
|---|---|---|
| `MetaTrendsCard.tsx` | dia com win rate `null` desenhado como 0% (`wr ?? 0`) | buraco na linha, não zero |
| `cutStatistics` (`matchupOthers`) | reconstrói vitórias por `Math.round(games × winRate)` de taxas com 4 casas e mascara inconsistências com `Math.max(0, …)` | carregar as contagens de `first/second/game1/postSide` na linha |
| `winRate` | empate conta como derrota (w ÷ (w+l+d)) | é escolha válida, mas dizer na página; ou contar ½ |
| `minSamples = 30` | em n = 30 o IC de Wilson é ±17 pontos | subir para 100 ou mostrar só com φ |
| `unfinishedRate` | 0 em todos os 200 arquétipos dos dois ladders | ou games sem resultado nunca entram, ou o campo está morto; verificar na varredura e tirar da página se for o segundo |
| `topDecks` (`/top-decks`) | score min-max de 0.6 Wilson + 0.2 share + 0.2 pilotos; share e pilotos são quase a mesma variável, e o min-max deixa o score à mercê do maior deck | usar a estimativa encolhida e ranks; só a infográfico e o explorador global leem |
| Torneios (`computeStats`) | nenhuma incerteza e os matches contradizem os standings (#1243, #1269) | corrigir a origem do outcome antes de qualquer número |
| Testes | `metaTiers` tem um caso, `metaEvents` um, nenhum teste de cobertura do IC ou de taxa de falso evento | adicionar testes simulados (cobertura ≈ 95%, eventos sob o nulo ≈ 0) |

## Plano

Quatro entregas, nesta ordem. As três primeiras não mudam a varredura nem o formato dos dias.

1. **`analytics.inference.ts` (omega-server-v3).** Beta-binomial empírica (prior e força ajustados por ladder no build), φ por deck dos tallies diários, n_eff, intervalo com φ, teste de duas proporções com multiplicidade. `buildStatistics` passa a usar isso em `tier`, `rankings`, `metaEvents`, `consistencyScore`, `sleeperScore` e nas células de matchup; `wilsonLower`/`ci` continuam na resposta e ganham campos `adjusted` ao lado. Testes com dados simulados. É a entrega que corrige 1 a 5.
2. **Bradley–Terry (omega-server-v3).** Força ajustada por adversário a partir da matriz; `strength` na linha; tier por ela (ou pela encolhida, decisão de produto). Corrige o primeiro ponto de 6.
3. **Front (tournament-next).** `minGames` 100 por padrão, buraco no gráfico, estabilidade = φ, chamada favorável pelo IC ajustado, notas de método (empate, G2/G3, hand trap quando usada, pilotos). Entra junto com o diff da dashboard que está aberto.
4. **Varredura (depois).** Faixa de rating na hora do game e, se quiserem IC honesto de verdade, agrupamento por match ou por jogador no estado diário.

Mudar o motor inteiro não resolveria nada disso mais rápido: os dados certos já estão contados, só estão sendo lidos com o instrumento errado.
