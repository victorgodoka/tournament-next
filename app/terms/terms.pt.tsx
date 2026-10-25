import Link from 'next/link'
import { Section, type LegalDoc } from '@omega/legal/legal-page'

const CONTACT = 'admin@duelistsunite.org'

export const pt: LegalDoc = {
  title: 'Termos de Serviço',
  description: 'As regras de uso do hub do YGO Omega: contas, conduta, o que você publica, moderação, VIP e responsabilidade.',
  eyebrow: 'Legal',
  updatedLabel: 'Última atualização:',
  Body: () => (
    <>
      <p>
        Esta tradução existe para sua conveniência. Se ela divergir da versão em inglês, vale a versão em inglês.
      </p>
      <p>
        Estes termos são um acordo entre você e a Duelists Unite (&quot;nós&quot;), o projeto de fãs que mantém o YGO Omega, sobre o uso do
        next.duelistsunite.org e da API por trás dele (o &quot;Hub&quot;). Ao usar o Hub, você os aceita. Se não aceitar, por favor não use o
        Hub. Nossa <Link href="/privacy">Política de Privacidade</Link> explica como tratamos seus dados.
      </p>

      <Section id="eligibility" title="Quem pode usar o Hub">
        <ul>
          <li>
            Você precisa ter pelo menos 13 anos. Se o seu país exige uma idade maior para aceitar estes termos sozinho, você precisa da
            permissão de um responsável.
          </li>
          <li>
            Qualquer pessoa pode ler o Hub. Para entrar, você precisa de uma conta do Discord ligada a uma conta do YGO Omega, e essa conta não
            pode estar suspensa ou banida.
          </li>
        </ul>
      </Section>

      <Section id="account" title="Sua conta">
        <p>
          Você entra com o Discord, então manter a sua conta do Discord segura mantém a sua conta do Hub segura. Você responde pelo que
          acontece na sua conta. Se achar que outra pessoa está usando, saia e nos avise.
        </p>
      </Section>

      <Section id="conduct" title="Regras de conduta">
        <p>No Hub, incluindo seu perfil, mensagens, edições na wiki e comentários, não:</p>
        <ul>
          <li>assedie, ameace, insulte ou se passe por ninguém, nem publique discurso de ódio;</li>
          <li>compartilhe dados pessoais de alguém sem permissão;</li>
          <li>publique conteúdo sexual, violência explícita ou qualquer coisa ilegal;</li>
          <li>publique conteúdo que você não tem o direito de compartilhar;</li>
          <li>faça spam, propaganda ou envie mensagens não solicitadas;</li>
          <li>vandalize a wiki ou adicione conteúdo que você sabe que é falso;</li>
          <li>
            ataque, teste ou sobrecarregue o Hub, contorne seus limites ou sua segurança, faça scraping num ritmo que pese nos nossos
            servidores, ou use o Hub para trapacear no YGO Omega;
          </li>
          <li>fuja de uma suspensão ou banimento com outra conta.</li>
        </ul>
      </Section>

      <Section id="content" title="O que você publica">
        <p>
          Os direitos sobre o que você publica continuam seus. Você nos dá uma licença mundial, não exclusiva e gratuita para hospedar,
          armazenar, copiar, exibir, adaptar e distribuir esse conteúdo para operar e divulgar o Hub. A licença termina quando o conteúdo sai
          do Hub, exceto o conteúdo que fica no histórico da wiki e o que outras pessoas já compartilharam ou citaram.
        </p>
        <p>
          A wiki é colaborativa. Outros editores e a equipe podem editar, reorganizar ou remover suas contribuições, e suas revisões ficam no
          histórico do artigo. Só publique o que você tem o direito de compartilhar. Não revisamos tudo antes da publicação e não respondemos
          pelo que os usuários publicam.
        </p>
      </Section>

      <Section id="moderation" title="Moderação">
        <p>
          Podemos remover conteúdo, limitar recursos ou suspender e banir contas que violem estes termos ou coloquem outras pessoas ou o Hub
          em risco. Quando possível, diremos o motivo. Se achar que erramos, envie um e-mail para{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>

      <Section id="ip" title="Projeto de fãs e propriedade intelectual">
        <p>
          O YGO Omega e o Hub são um projeto de fãs gratuito. Não temos ligação com a Konami, nem seu endosso ou patrocínio. Yu-Gi-Oh!, os
          nomes, textos e artes das cartas pertencem à Konami e aos respectivos donos. Capas de álbuns, artes e músicas pertencem aos seus
          artistas e gravadoras. O código, o design e os textos do próprio Hub pertencem à Duelists Unite.
        </p>
        <p>
          Se você tem direitos sobre algo no Hub e quer que seja removido, envie um e-mail para <a href={`mailto:${CONTACT}`}>{CONTACT}</a>{' '}
          com a página, a obra em questão e como falar com você. Removemos conteúdo que viola direitos e banimos contas que reincidem.
        </p>
      </Section>

      <Section id="vip" title="Anúncios e VIP">
        <ul>
          <li>O Hub é gratuito. Os anúncios pagam os servidores.</li>
          <li>
            O VIP vem com uma doação pelo PayPal e remove os anúncios, entre outras vantagens. As vantagens podem mudar. Reembolsos seguem as
            regras do PayPal e a lei que se aplica a você. Dúvidas sobre uma doação: envie um e-mail.
          </li>
        </ul>
      </Section>

      <Section id="availability" title="Disponibilidade">
        <p>
          Mantemos o Hub com tempo voluntário e dinheiro doado. Recursos podem mudar, pausar ou acabar, e o Hub pode ficar fora do ar às
          vezes. Tentamos não perder seus dados, mas não podemos garantir: guarde sua própria cópia do que for importante, como seus decks.
        </p>
      </Section>

      <Section id="disclaimer" title="Isenção de garantias">
        <p>
          O Hub é oferecido &quot;no estado em que se encontra&quot; e &quot;conforme disponível&quot;. Na medida em que a lei permite, não
          damos garantias sobre ele, inclusive de que será preciso, ininterrupto, livre de erros ou adequado a um propósito específico. Textos
          de cartas, rulings, estatísticas e artigos da wiki podem conter erros.
        </p>
      </Section>

      <Section id="liability" title="Limitação de responsabilidade">
        <p>
          Na medida em que a lei permite, não respondemos por danos indiretos, incidentais, especiais ou consequentes, nem por perda de dados,
          lucros ou reputação. Nossa responsabilidade total por qualquer reclamação sobre o Hub se limita ao maior valor entre 50 dólares
          americanos e o que você nos pagou nos 12 meses anteriores à reclamação. Nada nestes termos limita a responsabilidade que a lei não
          nos deixa limitar, nem tira direitos que você tem como consumidor.
        </p>
      </Section>

      <Section id="termination" title="Fim do acordo">
        <p>
          Você pode parar de usar o Hub quando quiser e pedir a exclusão da sua conta, como explica a{' '}
          <Link href="/privacy#rights">Política de Privacidade</Link>. Podemos suspender ou encerrar seu acesso se você violar estes termos. As
          seções sobre o que você publica, propriedade intelectual, isenção de garantias, responsabilidade e lei aplicável continuam valendo
          depois disso.
        </p>
      </Section>

      <Section id="law" title="Lei aplicável">
        <p>
          Estes termos são regidos pelas leis de Ontário e pelas leis federais do Canadá que se aplicam lá. Disputas vão para os tribunais de
          Toronto, Ontário. Se você é consumidor em outro país, mantém as proteções da sua lei local que não podem ser renunciadas e pode
          entrar com uma ação nos tribunais do seu país.
        </p>
      </Section>

      <Section id="changes" title="Mudanças nestes termos">
        <p>
          Quando estes termos mudam, a data no topo muda junto. Antes de uma mudança importante entrar em vigor, avisamos no Hub ou no nosso{' '}
          <a href="https://discord.gg/duelistsunite">Discord</a>. Se você continuar usando o Hub depois que uma mudança entrar em vigor, aceita
          os novos termos. Se alguma parte destes termos não puder ser aplicada, o resto continua valendo.
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
