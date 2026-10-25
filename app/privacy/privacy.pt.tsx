import Link from 'next/link'
import { Section, type LegalDoc } from '@omega/legal/legal-page'

const CONTACT = 'admin@duelistsunite.org'

export const pt: LegalDoc = {
  title: 'Política de Privacidade',
  description: 'O que o hub do YGO Omega coleta, por quê, quem mais recebe, por quanto tempo guarda e como ver, corrigir ou apagar seus dados.',
  eyebrow: 'Legal',
  updatedLabel: 'Última atualização:',
  Body: () => (
    <>
      <p>
        Esta tradução existe para sua conveniência. Se ela divergir da versão em inglês, vale a versão em inglês.
      </p>
      <p>
        Esta política explica o que a Duelists Unite (&quot;nós&quot;) coleta quando você usa o next.duelistsunite.org (o &quot;Hub&quot;)
        e a API por trás dele, por que coletamos, quem mais recebe esses dados e o que você pode fazer a respeito. A Duelists Unite é o
        projeto de fãs que mantém o YGO Omega. Não temos ligação com a Konami. O fórum em forum.duelistsunite.org tem a própria política.
      </p>
      <p>
        Em resumo: você entra com o Discord, e recebemos só o seu ID, nome de usuário e avatar do Discord. Guardamos o que você cria no Hub
        para mostrar a você e a quem você compartilhar. Os anúncios pagam os servidores, e nosso parceiro de anúncios usa cookies para
        exibi-los. Nunca vendemos seus dados por dinheiro. Você pode pedir uma cópia dos seus dados ou a exclusão deles a qualquer momento.
      </p>

      <Section id="collect" title="O que coletamos">
        <p>
          <strong>Quando você navega sem entrar</strong>
        </p>
        <ul>
          <li>Seu idioma, em um cookie, se você escolher um.</li>
          <li>
            O que todo servidor web recebe em uma requisição: seu endereço IP, o user agent do navegador, a página pedida e o horário. Nossos
            servidores gravam isso nos logs.
          </li>
          <li>
            Uma contagem diária de visualizações dos artigos da wiki. Para quem não entrou, a contagem usa um hash com chave do endereço IP.
            Não guardamos o IP em si para isso.
          </li>
          <li>
            O que nosso parceiro de anúncios coleta. Veja <a href="#ads">Anúncios</a>.
          </li>
        </ul>

        <p>
          <strong>Quando você entra com o Discord</strong>
        </p>
        <p>
          Só entra uma conta do Discord que já tenha conta no YGO Omega. Pedimos ao Discord apenas a permissão <code>identify</code>, que nos
          dá seu ID de usuário, nome de usuário e avatar do Discord. Nunca vemos sua senha, e-mail, servidores ou mensagens do Discord, e não
          guardamos o token de acesso que o Discord nos entrega. Cada login cria uma sessão. Para cada sessão guardamos um hash do token, o
          endereço IP e o user agent de onde você entrou, e quando ela foi criada, usada pela última vez e quando expira.
        </p>

        <p>
          <strong>Seus dados do jogo YGO Omega</strong>
        </p>
        <p>
          Sua conta no Hub é a sua conta do YGO Omega. O Hub lê os servidores do jogo e mostra seu nome no jogo, rating, rank e status VIP, os
          duelos que você jogou (oponente, região, resultados, os decks usados e as cartas jogadas em cada partida) e seus resultados de
          temporada e de torneios.
        </p>

        <p>
          <strong>O que você adiciona no Hub</strong>
        </p>
        <ul>
          <li>
            Seu perfil: bio, região, mensagem de status, imagem de capa, carta e deck favoritos, links de redes sociais, um vídeo do YouTube
            em &quot;tocando agora&quot;, quem pode ver o seu perfil e se você aparece online.
          </li>
          <li>
            O messenger: seus contatos (amigo ou rival, com o apelido e a nota privados que você der a eles), as pessoas que você bloqueia e
            as mensagens que envia e recebe, com o status de leitura.
          </li>
          <li>Decks e combos que você salva no deck builder e no simulador, com o histórico de revisões.</li>
          <li>Artigos da wiki e suas revisões, imagens que você envia, comentários e curtidas.</li>
          <li>Inscrições em torneios.</li>
        </ul>
        <p>
          Quando a equipe usa as ferramentas de administração, registramos cada ação, o alvo e o resultado, e o endereço IP e o user agent de
          quem agiu.
        </p>

        <p>
          <strong>O que fica no seu dispositivo</strong>
        </p>
        <p>
          Rascunhos não salvos (deck builder, simulador, editor da wiki) e pequenas preferências (a visualização da banlist que você escolheu,
          se terminou o tour da calculadora) ficam no armazenamento do seu navegador. Só recebemos um rascunho quando você o salva.
        </p>

        <p>
          <strong>Doações</strong>
        </p>
        <p>
          O VIP vem com uma doação feita pelo PayPal. O PayPal processa o pagamento sob a própria declaração de privacidade. Nunca vemos os
          dados do seu cartão ou da sua conta bancária.
        </p>
      </Section>

      <Section id="use" title="Como usamos">
        <ul>
          <li>
            Para operar o Hub: fazer seu login, mostrar seu perfil, entregar suas mensagens, salvar seus decks, publicar suas edições na wiki.
          </li>
          <li>Para mostrar resultados do jogo: leaderboards, histórico de partidas, páginas de torneio e perfis de jogadores.</li>
          <li>
            Para gerar estatísticas: relatórios de meta, uso de cartas e arquétipos, taxas de vitória. As estatísticas gerais do site são
            agregadas. As estatísticas de cada jogador aparecem no perfil dele.
          </li>
          <li>Para manter o Hub seguro: limitar requisições, detectar abuso, investigar denúncias e aplicar nossos Termos.</li>
          <li>Para exibir os anúncios que pagam os servidores, a menos que você seja VIP.</li>
        </ul>
        <p>
          Não vendemos seus dados pessoais por dinheiro. Algumas leis estaduais dos EUA consideram &quot;venda&quot; ou
          &quot;compartilhamento&quot; deixar parceiros de anúncios coletarem dados para anúncios personalizados. Você pode recusar isso; veja{' '}
          <a href="#ads">Anúncios</a>.
        </p>
      </Section>

      <Section id="legal-bases" title="Bases legais">
        <p>Se você está no Brasil, no Espaço Econômico Europeu ou no Reino Unido, usamos estas bases legais:</p>
        <ul>
          <li>
            <strong>Execução de contrato:</strong> para oferecer a conta e os recursos que você pede (login, perfil, messenger, decks, wiki).
          </li>
          <li>
            <strong>Legítimo interesse:</strong> segurança e prevenção de abuso, logs do servidor, contagem de visualizações da wiki,
            estatísticas e resultados públicos do jogo. Você pode se opor a esses usos; veja <a href="#rights">Seus direitos</a>.
          </li>
          <li>
            <strong>Consentimento:</strong> anúncios personalizados e os cookies por trás deles, onde a lei exige consentimento. Você pode
            retirá-lo quando quiser em &quot;Manage consent&quot;, no rodapé da página.
          </li>
          <li>
            <strong>Obrigação legal:</strong> quando a lei nos obriga a guardar ou divulgar dados.
          </li>
        </ul>
      </Section>

      <Section id="sharing" title="Quem recebe seus dados">
        <ul>
          <li>
            <strong>Outros jogadores</strong> veem o que o seu perfil mostra, dentro da visibilidade que você escolheu, além das suas
            contribuições na wiki com o seu nome, dos resultados no leaderboard e nas partidas e das mensagens que você envia a eles.
          </li>
          <li>
            <strong>Discord</strong>, para fazer seu login (<a href="https://discord.com/privacy">política de privacidade</a>).
          </li>
          <li>
            <strong>Cloudinary</strong> guarda e entrega as capas de perfil e as imagens da wiki, e verifica as capas enviadas com moderação
            automática (<a href="https://cloudinary.com/privacy">política de privacidade</a>).
          </li>
          <li>
            <strong>Nitro</strong> (NitroPay, da Overwolf Ltd) e seus parceiros de publicidade exibem os anúncios (
            <a href="https://nitropay.com/privacy">política de privacidade</a>).
          </li>
          <li>
            <strong>YouTube</strong> (Google) recebe seu endereço IP quando você dá play em um vídeo incorporado. Os players carregam do
            youtube-nocookie.com, o modo de privacidade aprimorada do YouTube, e só quando você dá play. Antes disso, uma página da wiki carrega
            apenas a miniatura do vídeo do servidor de imagens do YouTube (<a href="https://policies.google.com/privacy">política de
            privacidade</a>).
          </li>
          <li>
            <strong>PayPal</strong>, para doações (<a href="https://www.paypal.com/legalhub/privacy-full">declaração de privacidade</a>).
          </li>
          <li>
            <strong>Provedores de hospedagem</strong> que rodam nossos servidores e bancos de dados, só para prestar esse serviço.
          </li>
          <li>
            <strong>Autoridades</strong>, quando a lei exigir, ou quando precisarmos proteger a segurança de alguém.
          </li>
          <li>
            <strong>Um sucessor</strong>, se o projeto mudar de mãos. Esta política continuaria valendo para os seus dados.
          </li>
        </ul>
      </Section>

      <Section id="ads" title="Anúncios">
        <p>
          O Hub exibe anúncios pela Nitro. A Nitro e seus parceiros usam cookies e tecnologias parecidas para exibir anúncios, limitar quantas
          vezes você vê o mesmo, medi-los e, com o seu consentimento onde a lei exigir, personalizá-los.
        </p>
        <ul>
          <li>
            <strong>Espaço Econômico Europeu, Reino Unido e Suíça:</strong> a ferramenta de consentimento da Nitro pergunta antes de qualquer
            anúncio personalizado. Mude sua escolha quando quiser em &quot;Manage consent&quot;, no rodapé da página.
          </li>
          <li>
            <strong>Estados dos EUA com leis de privacidade</strong> (como a Califórnia): use &quot;Do Not Sell or Share My Personal
            Information&quot;, no rodapé da página, para recusar.
          </li>
        </ul>
        <p>
          Esses links só aparecem onde a lei cobre você. Contas VIP não veem anúncios, e algumas páginas nunca têm: login, messenger,
          edição de perfil, editor da wiki e as páginas de administração.
        </p>
      </Section>

      <Section id="cookies" title="Cookies e armazenamento local">
        <ul>
          <li>
            <code>omega_session</code>: definido pela nossa API em duelistsunite.org quando você entra. Mantém você conectado. Os scripts da
            página não conseguem lê-lo, e ele dura 30 dias. Estritamente necessário.
          </li>
          <li>
            Cookies de login: definidos pela nossa API durante o login com o Discord, para protegê-lo contra falsificação. Expiram em 10
            minutos. Estritamente necessários.
          </li>
          <li>
            <code>NEXT_LOCALE</code>: o idioma que você escolheu. Dura um ano. Funcional.
          </li>
          <li>
            Nitro e parceiros: cookies de publicidade e de consentimento. Veja <a href="#ads">Anúncios</a>.
          </li>
          <li>
            Armazenamento local e de sessão: rascunhos, preferências e a página para onde voltar depois do login. Ficam no seu navegador.
          </li>
        </ul>
        <p>
          O Hub não funciona sem os cookies estritamente necessários. Você pode apagar qualquer cookie no seu navegador; apagar o{' '}
          <code>omega_session</code> desconecta você.
        </p>
      </Section>

      <Section id="retention" title="Por quanto tempo guardamos">
        <ul>
          <li>Sua conta, perfil, decks, combos, contatos e mensagens: enquanto a sua conta existir.</li>
          <li>Limpar uma conversa no messenger esconde a conversa para você. A outra pessoa mantém a cópia dela até limpar também.</li>
          <li>
            As sessões param de funcionar depois de 30 dias ou quando você sai. O registro da sessão, com o endereço IP e o user agent, fica
            com a sua conta até a conta ser excluída.
          </li>
          <li>
            Artigos e revisões da wiki fazem parte do histórico da wiki e continuam publicados. Se a sua conta for excluída, eles continuam
            creditados a uma conta excluída.
          </li>
          <li>Logs do servidor: só pelo tempo de que precisamos para segurança e depuração.</li>
        </ul>
        <p>
          Quando você pede a exclusão da sua conta, apagamos ou anonimizamos seus dados em até 30 dias. Guardamos só o que a lei exigir, ou o
          que precisarmos para manter um banimento. As cópias em backups desaparecem conforme os backups são substituídos.
        </p>
      </Section>

      <Section id="rights" title="Seus direitos">
        <p>
          Dependendo de onde você mora (por exemplo, pela LGPD, pelo GDPR, pelo UK GDPR, pela PIPEDA do Canadá ou pela CCPA), você pode nos
          pedir para:
        </p>
        <ul>
          <li>confirmar quais dados temos sobre você e entregar uma cópia, em formato portável;</li>
          <li>corrigir dados errados;</li>
          <li>apagar seus dados ou a sua conta;</li>
          <li>interromper ou restringir um uso dos seus dados, ou se opor a ele;</li>
          <li>retirar um consentimento que você deu;</li>
          <li>parar de vender ou compartilhar seus dados para anúncios personalizados.</li>
        </ul>
        <p>
          Muita coisa você mesmo pode fazer: editar seu perfil e quem pode vê-lo, apagar decks e combos, remover contatos e sair. Para o
          resto, envie um e-mail para <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Para confirmar que o pedido é seu, podemos pedir que você
          nos mande uma mensagem pela conta do Discord ligada à sua conta do YGO Omega. Respondemos em até 30 dias, ou antes se a sua lei
          exigir. Não custa nada, e exercer esses direitos nunca muda como o Hub trata você.
        </p>
        <p>
          Você também pode reclamar à autoridade de proteção de dados do seu país, como a ANPD no Brasil, a autoridade do seu país na UE, o
          ICO no Reino Unido, o Office of the Privacy Commissioner do Canadá ou a California Privacy Protection Agency.
        </p>
      </Section>

      <Section id="children" title="Crianças">
        <p>
          O Hub é para quem tem 13 anos ou mais. Se o seu país exige uma idade maior para aceitar isto sozinho (até 16 anos em partes da UE),
          você precisa da permissão de um responsável. Se você acha que uma criança com menos de 13 anos tem uma conta, envie um e-mail e nós
          a excluiremos.
        </p>
      </Section>

      <Section id="transfers" title="Transferências internacionais">
        <p>
          Nossos servidores e os provedores acima podem tratar seus dados fora do seu país, inclusive no Canadá, nos Estados Unidos, na UE e
          em Israel. Onde a lei exige, contamos com as salvaguardas dos nossos provedores para essas transferências, como cláusulas
          contratuais padrão.
        </p>
      </Section>

      <Section id="security" title="Segurança">
        <p>
          O Hub funciona em HTTPS. O cookie de sessão fica fora do alcance dos scripts da página e só trafega por HTTPS, e guardamos apenas um
          hash de cada token de sessão. O login com o Discord usa PKCE, e nunca lidamos com a sua senha do Discord. Toda ação de
          administração é registrada. As mensagens não têm criptografia de ponta a ponta. Nenhum sistema é perfeitamente seguro: se um
          incidente afetar seus dados, avisaremos você como a lei exige.
        </p>
      </Section>

      <Section id="changes" title="Mudanças nesta política">
        <p>
          Quando esta política muda, a data no topo muda junto. Antes de uma mudança importante entrar em vigor, avisamos no Hub ou no nosso{' '}
          <a href="https://discord.gg/duelistsunite">Discord</a>. Os <Link href="/terms">Termos de Serviço</Link> trazem as demais regras de
          uso do Hub.
        </p>
      </Section>

      <Section id="contact" title="Contato">
        <p>
          Duelists Unite: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>
    </>
  ),
}
