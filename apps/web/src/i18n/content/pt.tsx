import { Ext, LINKS, Mail, REPO, STUDIO, type Content } from './shared.tsx';

const sources = (
  <>
    <p>As regras do ligungi seguem, nesta ordem de autoridade:</p>
    <ol>
      <li>O livro de regras oficial (軍儀解説書), lançado em 2022 pela Universal Music junto com o tabuleiro físico.</li>
      <li>
        O <Ext href={LINKS.rulebookFaq}>FAQ oficial da Universal Music</Ext> (perguntas Q1 a Q30), que esclarece casos e corrige
        um erro do livro.
      </li>
      <li>
        A <Ext href={LINKS.rulebookEnglish}>tradução do livro para o inglês</Ext>, conferida página a página com o original.
      </li>
      <li>
        O <Ext href={LINKS.gungiWeb}>軍儀Web</Ext>, site japonês que segue as regras oficiais, usado só onde o livro é omisso.
      </li>
    </ol>
    <p>
      A Universal Music é a Universal Music Japan, braço japonês da gravadora Universal Music Group, que também lança
      produtos licenciados de anime e mangá. O Gungi saiu como produto oficial licenciado de HUNTER×HUNTER, ou seja, com
      autorização dos detentores da obra: as regras foram escritas por uma equipe dedicada ao jogo (HUNTER×HUNTER 軍儀
      特別チーム), com supervisão da Shueisha, editora do mangá de Yoshihiro Togashi.
    </p>
    <p>
      Quando o livro deixa dúvida, a interpretação adotada e o motivo estão na{' '}
      <Ext href={LINKS.spec}>especificação completa das regras</Ext>, no código-fonte do projeto.
    </p>
  </>
);

export const pt: Content = {
  updated: 'Última atualização: 14 de novembro de 2026.',

  about: (
    <>
      <p>
        O ligungi é uma plataforma gratuita para jogar Gungi (軍儀), o jogo de tabuleiro de HUNTER×HUNTER, online, com as
        regras oficiais publicadas pela Universal Music (2022). Não tem anúncios, não exige conta e o código é aberto.
      </p>
      <p>
        É feito pela <Ext href={STUDIO}>Beater Studios</Ext> e inspirado no lichess.org: a interface reaproveita o visual do
        lila, o código aberto do lichess.
      </p>
      <h2>Regras</h2>
      {sources}
      <h2>Código aberto</h2>
      <p>
        Todo o código do ligungi está no <Ext href={REPO}>GitHub</Ext>, sob a licença{' '}
        <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext> ou posterior. Correções de regras, traduções e código são bem-vindos.
      </p>
      <h2>Créditos</h2>
      <ul>
        <li>
          Visual: <Ext href={LINKS.lila}>lila</Ext>, o código aberto do lichess.org (AGPL-3.0).
        </li>
        <li>
          Sons: conjunto "sfx" de Enigmahack e fonte de ícones, ambos do lila (veja o{' '}
          <Ext href={LINKS.lilaCopying}>COPYING.md do lila</Ext>).
        </li>
        <li>
          Fontes Noto Sans e Roboto, do Google, sob a <Ext href={LINKS.ofl}>SIL Open Font License</Ext>.
        </li>
      </ul>
      <h2>Aviso</h2>
      <p>
        Gungi e HUNTER×HUNTER pertencem aos seus detentores (Yoshihiro Togashi, Shueisha e Universal Music). O ligungi é um
        projeto de fãs, sem afiliação oficial, e não usa personagens, artes nem logos da obra.
      </p>
    </>
  ),

  faq: [
    {
      q: 'O que é Gungi?',
      a: (
        <p>
          Um jogo de estratégia para dois jogadores, criado para o mangá HUNTER×HUNTER e lançado como jogo de verdade em 2022.
          Lembra o shogi, mas as peças podem ser empilhadas em torres de até três, e a altura da torre aumenta o alcance da
          peça de cima. Veja <a href="/learn">como jogar</a>.
        </p>
      ),
    },
    {
      q: 'As regras são mesmo as oficiais?',
      a: (
        <p>
          Sim. Seguimos o livro de regras de 2022 e o FAQ oficial da Universal Music. As fontes estão na página{' '}
          <a href="/about">Sobre</a>, e cada ponto ambíguo, com a interpretação escolhida, está na{' '}
          <Ext href={LINKS.spec}>especificação das regras</Ext>.
        </p>
      ),
    },
    {
      q: 'É grátis? Preciso de conta?',
      a: (
        <p>
          É grátis, sem anúncios. Dá para jogar sem conta; com uma conta você joga partidas ranqueadas, entra no ranking,
          segue amigos e guarda o histórico no perfil.
        </p>
      ),
    },
    {
      q: 'Como funciona o rating?',
      a: (
        <p>
          Usamos o Glicko-2, com um rating separado para cada modo. Enquanto o rating ainda é incerto, ele aparece com "?" e
          o jogador não entra no ranking. Partidas casuais não mudam o rating.
        </p>
      ),
    },
    {
      q: 'Por que não consigo fazer um lance que deixa meu Marechal em perigo?',
      a: (
        <p>
          Pelo livro, quem deixa o Marechal ser capturado perde. Em vez de permitir o lance e esperar a captura, o site
          simplesmente não oferece esse lance. Se você não tem nenhum lance que deixe o Marechal a salvo, a partida acaba em
          mate, mesmo que ele não esteja sendo atacado naquele momento.
        </p>
      ),
    },
    {
      q: 'O que é o draft e o "済み"?',
      a: (
        <p>
          Nos modos Intermediário e Avançado, cada jogador monta o próprio exército colocando peças no seu território, uma
          por vez, começando pelo Marechal. "済み" quer dizer "pronto": quem declara não coloca mais peças. Pela regra do
          livro, quando o segundo jogador declara pronto, o draft termina para os dois. Em partidas casuais existe a opção
          "draft livre", em que cada um termina o seu.
        </p>
      ),
    },
    {
      q: 'O que é FEN?',
      a: (
        <p>
          Uma linha de texto que descreve uma posição inteira: as torres no tabuleiro, as peças na mão, de quem é a vez, o
          modo e a fase. No tabuleiro de análise você pode copiar e colar posições com ela.
        </p>
      ),
    },
    {
      q: 'O ligungi tem ligação com HUNTER×HUNTER ou com a Universal Music?',
      a: <p>Não. É um projeto de fãs, sem afiliação oficial.</p>,
    },
    {
      q: 'Encontrei um erro. Como aviso?',
      a: (
        <p>
          Abra uma <Ext href={LINKS.issues}>issue no GitHub</Ext> ou escreva para <Mail />. Para falhas de segurança, use o{' '}
          <Ext href={LINKS.security}>reporte privado</Ext>, nunca uma issue pública.
        </p>
      ),
    },
    {
      q: 'Posso ajudar?',
      a: (
        <p>
          Pode. O código é aberto e aceita contribuições: correções de regras com fonte, traduções, código e relatos de erro.
          Comece pelo <Ext href={REPO}>repositório</Ext>.
        </p>
      ),
    },
  ],

  contact: (
    <>
      <p>
        Para dúvidas, sugestões, parcerias ou pedidos sobre seus dados, escreva para <Mail />.
      </p>
      <ul>
        <li>
          Erros e sugestões técnicas: <Ext href={LINKS.issues}>issues no GitHub</Ext>.
        </li>
        <li>
          Falhas de segurança: <Ext href={LINKS.security}>reporte privado no GitHub</Ext>, nunca em público.
        </li>
        <li>
          Privacidade e dados pessoais: <Mail />, veja a <a href="/privacy">política de privacidade</a>.
        </li>
      </ul>
    </>
  ),

  terms: (
    <>
      <p>
        Estas condições valem para o uso do site ligungi.org, mantido pela <Ext href={STUDIO}>Beater Studios</Ext>. Ao usar o
        site, você concorda com elas.
      </p>
      <h2>O serviço</h2>
      <p>
        O ligungi é gratuito e oferecido como está, sem garantia de disponibilidade contínua. Podemos mudar, suspender ou
        encerrar recursos a qualquer momento.
      </p>
      <h2>Conta</h2>
      <ul>
        <li>Você é responsável pela sua senha e por tudo o que é feito com a sua conta.</li>
        <li>Use um nome de usuário que não seja ofensivo nem se passe por outra pessoa.</li>
        <li>Menores de 13 anos só podem criar conta com autorização dos responsáveis.</li>
      </ul>
      <h2>Conduta</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>usar programas ou ajuda de terceiros durante partidas contra outras pessoas;</li>
        <li>manipular o rating, por exemplo com contas múltiplas ou partidas combinadas;</li>
        <li>assediar, ofender ou ameaçar outros jogadores;</li>
        <li>atacar, sobrecarregar ou tentar contornar as proteções do site.</li>
      </ul>
      <p>Contas que violarem estas regras podem ser suspensas ou removidas.</p>
      <h2>Partidas e perfil</h2>
      <p>
        Partidas, resultados, ratings e o nome de usuário são públicos: qualquer pessoa pode ver e exportar as partidas
        jogadas no site.
      </p>
      <h2>Código e marcas</h2>
      <p>
        O código do ligungi é aberto sob a <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext>, que tem regras próprias para quem copia
        ou modifica o código. Gungi e HUNTER×HUNTER pertencem aos seus detentores; o ligungi é um projeto de fãs, sem
        afiliação oficial.
      </p>
      <h2>Responsabilidade</h2>
      <p>
        Na medida permitida pela lei, a Beater Studios não se responsabiliza por perdas decorrentes do uso ou da
        indisponibilidade do site, como partidas interrompidas ou dados perdidos.
      </p>
      <h2>Mudanças e contato</h2>
      <p>
        Podemos atualizar estas condições; a data no topo indica a versão em vigor. Estas condições seguem a legislação
        brasileira. Dúvidas: <Mail />.
      </p>
    </>
  ),

  privacy: (
    <>
      <p>
        Esta política explica quais dados o ligungi.org trata e por quê, em linha com a Lei Geral de Proteção de Dados
        (LGPD). A controladora dos dados é a <Ext href={STUDIO}>Beater Studios</Ext>. Contato: <Mail />.
      </p>
      <h2>Resumo</h2>
      <ul>
        <li>Sem anúncios, sem rastreadores e sem cookies de terceiros.</li>
        <li>Só guardamos o necessário para o jogo funcionar.</li>
        <li>Seus dados não são vendidos nem compartilhados para marketing.</li>
      </ul>
      <h2>O que tratamos</h2>
      <ul>
        <li>
          <b>Conta (se você criar uma):</b> nome de usuário e senha. A senha é guardada só em forma criptografada (hash), e
          nem nós conseguimos lê-la.
        </li>
        <li>
          <b>Partidas e atividade:</b> lances, resultados, ratings, jogadores que você segue e a data de criação da conta.
          Esses dados aparecem no seu perfil público. A opção de quem pode desafiar você pelo perfil fica salva na conta. Os
          desafios para partidas em tempo real ficam só na memória do servidor enquanto esperam resposta. Os desafios e as
          partidas abertas por correspondência, que esperam até 7 dias, ficam guardados no banco de dados para não se
          perderem quando o servidor reinicia: as partidas abertas são apagadas quando expiram e os desafios 14 dias depois de
          criados, ou antes, se você excluir a conta, e entram na cópia dos seus dados.
        </li>
        <li>
          <b>Cookie de sessão (sid):</b> um cookie essencial que identifica o seu navegador para manter o login e as suas
          partidas. Não é usado para rastreamento. Sessões sem conta expiram após 30 dias sem uso; com conta, após um ano.
          Nas sessões com login guardamos também a descrição do navegador (o "user agent", por exemplo "Chrome no Windows") e as datas de
          entrada e de último uso, para você ver na página Conta onde a sua conta está aberta.
        </li>
        <li>
          <b>Endereço IP:</b> usado no momento da requisição para limitar tentativas de login e proteger o site contra
          abusos. Não fica guardado no nosso banco de dados.
        </li>
        <li>
          <b>Estatísticas de visita:</b> o Cloudflare Web Analytics conta, de forma agregada, as páginas visitadas, o país,
          o tipo de navegador e o tempo de carregamento. Ele não usa cookies, não guarda nada no seu navegador e não
          identifica você. Só é ativado se você aceitar no aviso de cookies, e você pode mudar a escolha no fim desta
          página.
        </li>
        <li>
          <b>Preferências:</b> idioma, tema, som e tamanho do tabuleiro ficam só no seu navegador (armazenamento local) e não
          são enviados para nós.
        </li>
      </ul>
      <h2>Por que tratamos (bases legais)</h2>
      <ul>
        <li>Conta, partidas e sessão: para prestar o serviço que você pediu (execução de contrato).</li>
        <li>IP e proteções: legítimo interesse em manter o site seguro e funcionando.</li>
        <li>Estatísticas de visita: o seu consentimento, que pode ser retirado a qualquer momento.</li>
      </ul>
      <h2>Com quem compartilhamos</h2>
      <p>
        O tráfego do site passa pela Cloudflare, que fornece rede de distribuição (CDN), proteção contra ataques e as estatísticas de visita, e pode
        tratar dados técnicos, como o IP, inclusive fora do Brasil (veja a{' '}
        <Ext href={LINKS.cloudflarePrivacy}>política da Cloudflare</Ext>). O site roda em um provedor de hospedagem contratado
        pela Beater Studios. Fora isso, só compartilhamos dados se a lei exigir.
      </p>
      <h2>Por quanto tempo</h2>
      <ul>
        <li>Conta e partidas: enquanto a conta existir. As partidas compõem o histórico público do site.</li>
        <li>Sessões: até expirarem, como descrito acima.</li>
        <li>Cópias de segurança: até 14 dias.</li>
      </ul>
      <h2>Seus direitos</h2>
      <p>
        Pela LGPD, você pode pedir acesso, correção ou exclusão dos seus dados, além de informações sobre o tratamento.
        Na página <a href="/account">Conta</a> você mesmo pode baixar uma cópia dos seus dados, encerrar sessões em outros
        aparelhos, trocar a senha e excluir a conta; para o resto, escreva para <Mail /> com o assunto "Privacidade", informando o seu nome de usuário. A exclusão da conta remove
        os seus dados pessoais; as partidas já jogadas podem continuar no histórico de forma anônima.
      </p>
      <h2>Mudanças</h2>
      <p>Podemos atualizar esta política; a data no topo indica a versão em vigor.</p>
    </>
  ),

  sources,
};
