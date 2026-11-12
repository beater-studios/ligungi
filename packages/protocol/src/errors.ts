/**
 * Stable error codes sent by the server. Clients translate them; `ERROR_MESSAGES` is the
 * Portuguese fallback sent alongside the code.
 */
export const ERROR_MESSAGES = {
  invalidSettings: 'Configuração inválida.',
  invalidMode: 'Modo inválido.',
  invalidRated: 'Informe se a partida vale rating.',
  invalidColor: 'Cor inválida.',
  invalidFirstPlayer: 'Primeiro jogador inválido.',
  invalidInitialTime: 'Tempo inicial deve ficar entre 1 e 180 minutos.',
  invalidIncrement: 'Incremento deve ficar entre 0 e 180 segundos.',
  unlimitedNotRated: 'Partidas sem relógio não valem rating.',
  invalidDraftOption: 'Opção de draft inválida.',
  ratedNeedsOfficialDraft: 'Partidas ranqueadas seguem a regra oficial do draft.',
  tooManyAttempts: 'Muitas tentativas. Aguarde um minuto.',
  invalidUsername: 'Nome de usuário: 3 a 20 caracteres, letras, números, _ ou -.',
  invalidPassword: 'A senha precisa ter pelo menos 8 caracteres.',
  usernameTaken: 'Esse nome de usuário já existe.',
  wrongCredentials: 'Usuário ou senha incorretos.',
  userNotFound: 'Usuário não encontrado.',
  gameNotFound: 'Partida não encontrada.',
  challengeNotFound: 'Desafio não encontrado.',
  seekNotFound: 'Busca não encontrada.',
  routeNotFound: 'Rota não encontrada.',
  invalidJson: 'JSON inválido.',
  requestTooLarge: 'Requisição grande demais.',
  forbidden: 'Requisição recusada.',
  internal: 'Erro interno.',
  loginForRated: 'Entre na sua conta para jogar partidas ranqueadas.',
  seekUnavailable: 'Essa busca não está mais disponível.',
  ownSeek: 'Você não pode aceitar a própria busca.',
  tooManySeeks: 'Você já tem buscas demais abertas.',
  connectionRequired: 'Sem conexão com o servidor. Recarregue a página e tente de novo.',
  challengeUnavailable: 'Esse desafio não está mais disponível.',
  ownChallenge: 'Envie o link para outra pessoa.',
  gameOver: 'A partida já terminou.',
  notYourTurn: 'Não é sua vez.',
  staleMove: 'Lance desatualizado.',
  invalidMove: 'Lance inválido.',
  illegalMove: 'Lance ilegal.',
  cannotAbort: 'A partida não pode mais ser abortada.',
  cannotClaim: 'Ainda não é possível reivindicar a vitória.',
  drawUnavailable: 'Empate indisponível agora.',
  noDrawOffer: 'Não há proposta de empate.',
  rematchUnavailable: 'Revanche indisponível.',
  noRematchOffer: 'Não há proposta de revanche.',
  invalidTopic: 'Tópico inválido.',
  tooManySubscriptions: 'Assinaturas demais nesta conexão.',
  invalidGame: 'Partida inválida.',
  notAPlayer: 'Você não está nesta partida.',
  invalidAction: 'Ação inválida.',
  unknownMessage: 'Mensagem desconhecida.',
  loginRequired: 'Entre na sua conta para continuar.',
  cannotFollowSelf: 'Você não pode seguir a si mesmo.',
  tooManyFollows: 'Você já segue o máximo de jogadores.',
  invalidFilter: 'Filtro inválido.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const ERROR_CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[];

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && Object.hasOwn(ERROR_MESSAGES, value);
