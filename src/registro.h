// PAINEL DE LOG NA TELA, e o aviso que ensina o gesto de abri-lo.
//
// POR QUE EM C E NAO NO SHELL HTML. No alvo Tizen ja existe um painel de
// diagnostico feito em DOM (tools/tizen-shell.html), e ele nasceu de uma
// necessidade real: a TV dava tela preta e nao havia DevTools a mao. Mas no
// webOS NAO EXISTE SHELL NENHUM — o app e um binario ARM nativo, o printf vai
// para /tmp/nuvio.log por causa do freopen do arranque, e ler esse arquivo
// exige telnet ou fotografar a tela. Ou seja: sem uma versao em C o dono teria
// o log numa TV e nao teria na outra, com dois gestos diferentes. Este modulo e
// o MESMO gesto (tecla vermelha) nas duas.
//
// DE ONDE SAEM AS LINHAS: do log que o app JA produz, nao de um mecanismo novo.
// O app tem centenas de printf espalhados; reescreve-los para passar por um
// macro proprio seria a mudanca mais arriscada possivel e, pior, um anel
// alimentado so pelos printf CONVERTIDOS mostraria um log pela metade — e um
// painel de diagnostico que esconde metade das linhas mente sobre o que
// aconteceu. Entao:
//   - webOS (e Mac com NUVIO_LOG): le o FIM do arquivo quando o painel abre.
//     Com o painel fechado nao custa nada: nenhum arquivo e aberto, nenhuma
//     linha e formatada.
//   - Tizen: nao ha arquivo util (o freopen nem acontece la). O printf vai para
//     Module.print, que o shell manda para o console E guarda em texto puro em
//     window.__nvLinhas — e dali que este painel le. Mesma fonte, sem um
//     segundo mecanismo de captura.
//
// O QUE E CORTADO NA EXIBICAO. O log de um app de video carrega titulo
// assistido e URL de fonte, e as URLs de addon/debrid levam a chave do debrid
// embutida no CAMINHO (ver debrid.c: "[debrid] %s -> %.60s"). Um painel na TV
// da sala expoe isso para quem estiver na sala. Decisao: o TITULO fica (ele ja
// esta na tela do app e e a informacao que faz o log servir para algo), a URL
// e cortada no HOST — de "https://casa.exemplo/d/CHAVE/arquivo.mkv" sobra
// "https://casa.exemplo/…". O host importa para diagnosticar ("qual addon
// respondeu"), o caminho e credencial.
#ifndef NV_REGISTRO_H
#define NV_REGISTRO_H
#include <SDL2/SDL.h>

// Caminho do arquivo para onde o app despeja stdout/stderr, ou NULL quando esta
// compilacao nao redireciona nada. main.c usa ISTO no freopen do arranque: um
// lugar so decide o caminho, e e o mesmo que o painel le. Sem isso os dois
// lados combinariam "/tmp/nuvio.log" por coincidencia.
const char *registro_arquivo(void);

// 1 quando o evento foi CONSUMIDO. O chamador tem de devolver na hora — e a
// mesma convencao das outras camadas de app.c.
int  registro_evento(const SDL_Event *e);

// Desenha por cima de TUDO. Com painel fechado e sem aviso pendente, custa um
// teste de inteiro: nada de leitura de arquivo nem de formatacao por quadro.
void registro_desenhar(void);

// Abre o aviso de primeira execucao, se esta instalacao nunca o mostrou. Pode
// ser chamada em todo quadro: a decisao acontece uma vez e fica em cache.
void registro_aviso_primeira_vez(void);

// 1 enquanto o painel esta aberto. app.c usa para nao pintar a interface por
// baixo de um painel opaco.
int  registro_aberto(void);

#endif
