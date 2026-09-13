#include "registro.h"
#include "dados.h"
#include "gfx.h"
#include "text.h"
#include "idioma.h"
#include "layout.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// TECLA VERMELHA NO webOS: 486, CONFERIDO no header do SDK que compila o alvo
// ARM (SDL_webOS.h: SDL_WEBOS_SCANCODE_RED 486, na mesma tabela de onde
// layout.h tirou BACK=482 e BLUE=489). Nao esta em layout.h porque este arquivo
// nao e dono dela; se um dia o azul e o vermelho ficarem lado a lado, o lugar
// certo dos dois e la.
//
// O que NAO foi conferido: se a tecla chega ao app no aparelho. O BACK precisou
// de um hint proprio na criacao da janela (SDL_WEBOS_ACCESS_POLICY_KEYS_BACK)
// para nao ser engolido pelo compositor; para as coloridas nao existe hint
// equivalente em SDL_webOS.h, e o atalho do perfil em app.c ja aposta que o
// AZUL chega. Se o vermelho nao abrir o painel na TV da LG, a causa mais
// provavel e essa e nao o numero.
#define REG_SCANCODE_VERMELHA 486

// A MESMA tecla precisa existir sem controle de TV: no Mac nao ha vermelha, e
// no Tizen a vermelha e traduzida pelo shell (keyCode 403 -> F9) porque o
// keyCode das coloridas da Samsung nao existe na tabela do SDL. F9 e nao uma
// letra: o painel e roteado ANTES de todas as telas, e uma letra abriria o
// painel no meio de quem estivesse digitando na busca.
#define REG_TECLA_TECLADO SDLK_F9

// Quantos bytes do FIM do arquivo sao lidos, e quantas linhas ficam guardadas.
// Ler o arquivo inteiro ficaria pior a cada minuto de app aberto, e o que
// interessa e sempre o fim. 40 KB cobrem as 200 linhas do anel mesmo quando
// todas sao longas.
//
// REG_COL e 320 e nao a largura que CABE na tela (~165 caracteres a 21px):
// guardar a linha inteira e o que permite ao ehFalha achar o "<<< SEM
// PERSISTENCIA" que vive no FIM da linha de FPS, que e a mais comprida do app.
// A linha e cortada na EXIBICAO (txt_linha_corta), nao no armazenamento — e
// assim a marca vermelha aparece mesmo quando o texto que a causou nao cabe.
#define REG_JANELA 40960
#define REG_MAX    200
#define REG_COL    320

// Geometria. Margem folgada de proposito: em TV com overscan uma faixa das
// bordas nao aparece, e um painel para FOTOGRAFAR nao pode ter a primeira
// coluna cortada.
#define REG_X    56.0f
#define REG_Y    44.0f
#define REG_W    (NV_TELA_W - REG_X * 2.0f)
#define REG_H    (NV_TELA_H - REG_Y * 2.0f)
#define REG_PAD  26.0f
#define REG_LINHA_H 26.0f
// 32 e nao 34, e a diferenca foi VISTA na tela da C9.
//
// 34 e o numero que o painel DOM do Tizen guarda e cabia na conta da altura —
// mas a conta esquecia o rodape de ajuda, que e desenhado ancorado na BASE do
// cartao. Com 34 a ultima linha de log terminava 4 px antes dele: nao chega a
// sobrepor, e na foto da TV os dois se leem como um borrao unico, que e
// justamente o que um painel para fotografar nao pode fazer. 32 devolve 52 px
// de folga e custa duas linhas.
//
// 21px de corpo com 26 de entrelinha continua sendo o menor que ainda da para
// ler numa foto da TV — isso a medida original acertou.
#define REG_VISIVEIS 32

static int aberto;
static int aviso;
static int avisoDecidido;
// A soltura do MESMO toque que abriu/fechou algo aqui. ARMADILHA JA PAGA NESTE
// REPO: a barra lateral (menu.c) decide no KEYDOWN e se fecha ali mesmo; o
// KEYUP do mesmo toque chega quando ela ja fechou e vaza para a home, que abria
// um filme (issue #8). Toda vez que este modulo age num KEYDOWN ele guarda a
// tecla e engole o KEYUP correspondente.
//
// SYM E SCANCODE, os dois. As coloridas do webOS chegam por SCANCODE e o sym
// delas provavelmente e SDLK_UNKNOWN (0) — guardar so o sym deixaria justamente
// o toque da tecla vermelha vazando, que e o unico toque que este modulo trata
// em todas as telas.
static SDL_Keycode soltarSym;
static int soltarScan = -1;

static void engolirSoltura(const SDL_Event *e) {
  soltarSym  = e->key.keysym.sym;
  soltarScan = e->key.keysym.scancode;
}

static char anel[REG_MAX][REG_COL];
static int  nLin, ini;
static int  desloc;          // primeira linha visivel
static int  semFonte;        // 1 = nao existe de onde ler nesta compilacao

static char cru[REG_JANELA + 1];

const char *registro_arquivo(void) {
#ifdef __EMSCRIPTEN__
  // Nao ha arquivo util no navegador: o "sistema de arquivos" e MEMFS, morre a
  // cada recarga, e o log ja esta no console. Devolver NULL faz main.c pular o
  // freopen, que e exatamente o que ele ja fazia por NV_SEM_WEBOS.
  return NULL;
#else
  static char caminho[256];
  static int resolvido;
  if (!resolvido) {
    const char *env = getenv("NUVIO_LOG");
    resolvido = 1;
    if (env && env[0]) snprintf(caminho, sizeof caminho, "%s", env);
#ifdef __APPLE__
    // No Mac o log vai para o TERMINAL e continua assim: redirecionar por
    // padrao deixaria a previa muda para quem esta rodando tools/mac.sh, que e
    // o jeito normal de trabalhar aqui. Para exercitar o painel na previa:
    //     NUVIO_LOG=/tmp/nuvio.log bash tools/mac.sh
    else caminho[0] = 0;
#else
    else snprintf(caminho, sizeof caminho, "/tmp/nuvio.log");
#endif
  }
  return caminho[0] ? caminho : NULL;
#endif
}

// Corta a URL no HOST. Ver a nota de privacidade no topo de registro.h: a chave
// do debrid viaja no CAMINHO da URL, e este painel aparece na TV da sala.
//
// So mascara quando o caminho tem 4 bytes ou mais, que e o tamanho de "/…" em
// UTF-8: assim a substituicao nunca cresce a linha e o memmove anda sempre para
// a esquerda. Caminho de 1 a 3 bytes nao guarda credencial nenhuma.
static void mascarar(char *s) {
  char *p = s;
  while ((p = strstr(p, "://")) != NULL) {
    char *h = p + 3, *fim;
    while (*h && *h != '/' && *h != '?' && *h != ' ') h++;
    if (*h != '/' && *h != '?') { p = h; continue; }
    fim = h;
    while (*fim && *fim != ' ') fim++;
    if (fim - h < 4) { p = fim; continue; }
    memmove(h + 4, fim, strlen(fim) + 1);
    memcpy(h, "/\xe2\x80\xa6", 4);
    p = h + 4;
  }
}

// Corta lixo de UTF-8 no FIM. snprintf trunca por BYTE, e uma linha de log
// carrega titulo com acento ("[app] assistido marcado: Coração..."): cortada no
// meio de um caractere, a sequencia invalida chega ao SDL_ttf, que devolve linha
// VAZIA — perde-se a linha inteira para economizar um caractere.
static void aparaUtf8(char *s) {
  size_t n = strlen(s), i;
  unsigned char c;
  int quer;
  if (!n) return;
  i = n;
  while (i > 0 && ((unsigned char)s[i - 1] & 0xC0) == 0x80 && n - i < 3) i--;
  if (i == 0) return;
  c = (unsigned char)s[i - 1];
  quer = c < 0x80 ? 1
       : (c & 0xE0) == 0xC0 ? 2
       : (c & 0xF0) == 0xE0 ? 3
       : (c & 0xF8) == 0xF0 ? 4 : 1;
  if ((int)(n - i + 1) < quer) s[i - 1] = 0;
}

static void empurrar(const char *s) {
  int i = (ini + nLin) % REG_MAX;
  if (nLin == REG_MAX) { i = ini; ini = (ini + 1) % REG_MAX; }
  else nLin++;
  snprintf(anel[i], REG_COL, "%s", s);
  aparaUtf8(anel[i]);
  mascarar(anel[i]);
}

static const char *linhaDe(int k) { return anel[(ini + k) % REG_MAX]; }

// Quebra o bloco lido em linhas. `parcial` = a primeira linha pode estar
// cortada no meio (o arquivo foi lido do fim, nao do comeco) e por isso e
// descartada — meia linha de log confunde mais do que ajuda.
static void fatiar(char *texto, int parcial) {
  char *p = texto, *q;
  nLin = 0; ini = 0;
  if (parcial) {
    q = strchr(p, '\n');
    if (!q) return;
    p = q + 1;
  }
  while (*p) {
    q = strchr(p, '\n');
    if (q) *q = 0;
    { char *fim = p + strlen(p);
      while (fim > p && (fim[-1] == '\r' || fim[-1] == ' ')) *--fim = 0; }
    if (*p) empurrar(p);
    if (!q) break;
    p = q + 1;
  }
}

#ifdef __EMSCRIPTEN__
// As linhas que o shell (tools/tizen-shell.html) guarda em texto puro. E a
// mesma lista que alimenta o painel DOM: aqui nao ha uma segunda captura, so
// uma segunda forma de MOSTRAR.
//
// slice(-180) porque o que interessa e o fim, e porque stringToUTF8 corta o
// FINAL quando o buffer nao cabe — cortar o comeco em JS deixa no C exatamente
// as ultimas linhas, que sao as do defeito.
// Devolve -1 quando a lista nem existe (shell antigo, ou a pagina servida sem
// tools/tizen-shell.html) e 0 quando existe e esta vazia: sao dois estados
// diferentes e o painel escreve mensagens diferentes para cada um.
EM_JS(int, nv_registro_js, (char *dst, int tam), {
  try {
    var a = (typeof window !== "undefined") ? window.__nvLinhas : null;
    if (!a) return -1;
    if (!a.length) return 0;
    var t = a.slice(-180).join("\n");
    if (t.length > tam - 8) t = t.slice(-(tam - 8));
    stringToUTF8(t, dst, tam);
    return 1;
  } catch (e) { return 0; }
});
#endif

static void carregar(void) {
  nLin = 0; ini = 0; desloc = 0; semFonte = 0;
#ifdef __EMSCRIPTEN__
  { int r;
    cru[0] = 0;
    r = nv_registro_js(cru, (int)sizeof cru);
    if (r <= 0) { semFonte = (r < 0); return; }
    fatiar(cru, 0); }
#else
  { const char *caminho = registro_arquivo();
    FILE *f;
    long tam, comeco;
    size_t n;
    if (!caminho) { semFonte = 1; return; }
    f = fopen(caminho, "rb");
    if (!f) { semFonte = 1; return; }
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); semFonte = 1; return; }
    tam = ftell(f);
    if (tam < 0) { fclose(f); semFonte = 1; return; }
    comeco = tam > (long)REG_JANELA ? tam - (long)REG_JANELA : 0;
    fseek(f, comeco, SEEK_SET);
    n = fread(cru, 1, REG_JANELA, f);
    cru[n] = 0;
    fclose(f);
    fatiar(cru, comeco > 0); }
#endif
  // Abre no FIM. O defeito esta na ultima linha, nunca na primeira, e rolar 200
  // linhas com o D-pad para chegar la seria o painel inteiro jogado fora.
  desloc = nLin > REG_VISIVEIS ? nLin - REG_VISIVEIS : 0;
}

static void rolar(int n) {
  int max = nLin > REG_VISIVEIS ? nLin - REG_VISIVEIS : 0;
  desloc += n;
  if (desloc > max) desloc = max;
  if (desloc < 0) desloc = 0;
}

int registro_aberto(void) { return aberto; }

static void fecharAviso(void) {
  if (!aviso) return;
  aviso = 0;
  // Grava DEPOIS de ter sido visto, nao ao abrir: se o app morrer com o cartao
  // na tela, a pessoa ve o aviso de novo — que e o certo. Sem pasta gravavel
  // (dados_dir() vazio) isto e no-op e o aviso volta no proximo arranque; e
  // honesto, e o log ja disse por que nao ha pasta.
  dados_gravar("aviso-log.txt", "1\n");
}

void registro_aviso_primeira_vez(void) {
  char *s;
  if (avisoDecidido) return;
  avisoDecidido = 1;
  s = dados_ler("aviso-log.txt");
  if (s) { free(s); return; }
  aviso = 1;
}

static int ehAlternar(const SDL_Event *e) {
  if (e->key.repeat) return 0;
  if (e->key.keysym.sym == REG_TECLA_TECLADO) return 1;
  // A AZUL (489) fica de fora de proposito: ela ja e o atalho do perfil em
  // app.c, e roubar a tecla aqui mataria aquele atalho em silencio.
  if (e->key.keysym.scancode == REG_SCANCODE_VERMELHA) return 1;
  return 0;
}

static int ehVoltar(const SDL_Event *e) {
  SDL_Keycode k = e->key.keysym.sym;
  // O BACK do webOS ja chega normalizado como AC_BACK (main.c), e o Return do
  // controle Samsung tambem — o shell traduz 10009 em Escape e main.c converte.
  return k == SDLK_AC_BACK || k == SDLK_ESCAPE || k == SDLK_BACKSPACE ||
         e->key.keysym.scancode == NV_SCANCODE_BACK;
}

int registro_evento(const SDL_Event *e) {
  int ehTecla = (e->type == SDL_KEYDOWN || e->type == SDL_KEYUP ||
                 e->type == SDL_TEXTINPUT);

  if (e->type == SDL_KEYUP &&
      ((soltarSym && e->key.keysym.sym == soltarSym) ||
       (soltarScan >= 0 && (int)e->key.keysym.scancode == soltarScan))) {
    soltarSym = 0;
    soltarScan = -1;
    return 1;
  }

  if (e->type == SDL_KEYDOWN && ehAlternar(e)) {
    // Quem faz o gesto nao precisa mais do aviso que o ensina.
    fecharAviso();
    if (aberto) aberto = 0;
    else { aberto = 1; carregar(); }
    engolirSoltura(e);
    return 1;
  }

  if (!aberto && aviso) {
    // CARTAO, nao tela: QUALQUER tecla o dispensa, e a tecla morre aqui. Uma
    // tecla perdida uma vez na vida e menos atrapalho que um cartao que fica
    // enquanto o foco se move atras dele.
    if (e->type == SDL_KEYDOWN) { fecharAviso(); engolirSoltura(e); return 1; }
    return ehTecla;
  }

  if (!aberto) return 0;

  // Daqui para baixo o painel e MODAL: nenhuma tecla chega a tela de tras.
  if (e->type == SDL_KEYDOWN) {
    SDL_Keycode k = e->key.keysym.sym;
    if (k == SDLK_UP) rolar(-1);
    else if (k == SDLK_DOWN) rolar(1);
    else if (k == SDLK_LEFT || k == SDLK_PAGEUP) rolar(-REG_VISIVEIS);
    else if (k == SDLK_RIGHT || k == SDLK_PAGEDOWN) rolar(REG_VISIVEIS);
    else if (k == SDLK_RETURN || k == SDLK_KP_ENTER || k == SDLK_SPACE) {
      carregar();
      engolirSoltura(e);
    } else if (ehVoltar(e)) {
      aberto = 0;
      engolirSoltura(e);
    }
    return 1;
  }
  return ehTecla;
}

// Linha que merece cor de erro. Seis buscas por linha VISIVEL, e so com o
// painel aberto — o painel DOM do Tizen ja marca erro em vermelho e a leitura
// de uma FOTO da tela depende disso: numa parede de 34 linhas monocromaticas
// ninguem acha a que importa.
//
// E heuristica, nao classificacao: o C nao sabe qual printf era erro. Um titulo
// com "erro" no nome ("Homem de Ferro") sai vermelho sem ser falha. Falso
// positivo aqui custa uma linha colorida a mais; falso negativo custaria a
// linha do defeito passar batida numa foto.
static int ehFalha(const char *s) {
  return strstr(s, "<<<") || strstr(s, "FALH") || strstr(s, "falh") ||
         strstr(s, "erro") || strstr(s, "Erro") || strstr(s, "ERRO");
}

static void desenhaPainel(void) {
  GfxRect cartao = { REG_X, REG_Y, REG_W, REG_H };
  float x = REG_X + REG_PAD;
  float larg = REG_W - REG_PAD * 2.0f;
  float y;
  TxtLinha l;
  char t[96];
  int i, fim;

  // Alpha 0.94 e nao 1.0: da para ver que ha app atras sem que o texto perca
  // contraste. app.c NAO pinta a interface por baixo enquanto isto esta aberto
  // (duas camadas de tela cheia derrubam a GPU da TV), entao o que aparece por
  // tras e a cor de limpeza do quadro.
  gfx_cor(cartao, 0.02f, 0.0f, 0.0f, 0.0f, 0.94f);

  l = txt_linha(TXT_CAPTION2, "Registro do app", 184, 245, 192, 255);
  txt_desenhar(l, x, REG_Y + 20.0f);

  fim = desloc + REG_VISIVEIS;
  if (fim > nLin) fim = nLin;
  snprintf(t, sizeof t, i18n("linhas %d-%d de %d"),
           nLin ? desloc + 1 : 0, fim, nLin);
  { TxtLinha p = txt_linha(TXT_CAPTION2, t, 150, 152, 160, 255);
    txt_desenhar(p, REG_X + REG_W - REG_PAD - p.w, REG_Y + 20.0f); }

  y = REG_Y + 20.0f + l.h + 16.0f;

  if (!nLin) {
    // Ausencia aparece como ausencia, e cada ausencia tem a sua frase: "ainda
    // nao ha linha" e "nao ha de onde ler" sao problemas diferentes, e um
    // painel que junta os dois manda procurar no lugar errado.
    const char *msg;
    if (!semFonte) msg = "Nenhuma linha de log ainda.";
#ifdef __EMSCRIPTEN__
    else msg = "A página não expôs as linhas do log. O log completo continua "
               "no console do navegador.";
#else
    else msg = "Esta versão manda o log para o terminal, não para um arquivo. "
               "Para ler aqui, rode com NUVIO_LOG apontando para um arquivo.";
#endif
    txt_bloco(TXT_CAPTION, msg, 183, 186, 194, x, y, larg, 32.0f, 1.0f, 3);
  }
  for (i = desloc; i < fim; i++) {
    const char *s = linhaDe(i);
    int falha = ehFalha(s);
    // txt_linha_corta e nao txt_linha: uma linha de log nao tem comprimento
    // garantido, e uma textura de 320 caracteres passaria da largura do painel
    // (e do teto de textura de GPU antiga) sem dizer nada.
    l = txt_linha_corta(TXT_CAPTION2, s,
                        falha ? 255 : 184, falha ? 139 : 245, falha ? 122 : 192,
                        255, larg);
    txt_desenhar(l, x, y);
    y += REG_LINHA_H;
  }

  l = txt_linha(TXT_CAPTION2,
                "↑ ↓  rolar   ·   ← →  página   ·   OK  atualizar   ·   Voltar  fechar",
                150, 152, 160, 255);
  txt_desenhar(l, x, REG_Y + REG_H - REG_PAD - l.h);
}

// O texto do aviso muda por FABRICANTE, e o app sabe em qual alvo esta: o alvo
// Tizen e sempre Emscripten, e o resto e webOS (ou o Mac, que e a previa dele).
// Mostrar as duas instrucoes juntas obrigaria a pessoa a descobrir qual e a
// dela — e uma instrucao errada sobre o proprio controle e pior que instrucao
// nenhuma.
//
// O QUE ESTAS FRASES AFIRMAM, e por que. No controle da Samsung foi conferido
// que as cores nao sao botoes fisicos nos modelos novos: elas dividem o botao
// que fica abaixo do liga-desliga com os numeros, e aparecem numa fileira na
// tela depois de aperta-lo (as fontes divergem entre "segurar" e "apertar
// varias vezes", entao a frase cobre as duas). No controle da LG NAO foi
// possivel confirmar em quais modelos existe a fileira de coloridas — o Magic
// Remote de cada ano tem um desenho diferente — e por isso a frase diz que o
// vermelho fica nessa fileira "quando o controle tiver", sem prometer que tem.
static void desenhaAviso(void) {
  const float w = 1180.0f, h = 348.0f;
  GfxRect cartao = { (NV_TELA_W - w) * 0.5f, NV_TELA_H - NV_MARGEM_Y - h, w, h };
  float x = cartao.x + 34.0f;
  float larg = w - 68.0f;
  float y = cartao.y + 34.0f;
  TxtLinha l;

  gfx_cor(cartao, 0.05f, 0.043f, 0.047f, 0.055f, 0.97f);

  l = txt_linha(TXT_HEADLINE, "Ver o registro do app na TV", 255, 255, 255, 255);
  txt_desenhar(l, x, y);
  y += l.h + 22.0f;

  y += txt_bloco(TXT_BODY,
#ifdef __EMSCRIPTEN__
                 "Aperte o botão vermelho do controle para abrir e fechar o "
                 "registro. Nos controles Samsung novos o vermelho não é um "
                 "botão: aperte (ou segure) o botão de números e cores, abaixo "
                 "do liga-desliga, até a fileira de cores aparecer na tela.",
#else
                 "Aperte o botão vermelho do controle para abrir e fechar o "
                 "registro. No controle da LG ele fica na fileira de botões "
                 "coloridos, quando o controle tiver essa fileira.",
#endif
                 232, 234, 240, x, y, larg, 34.0f, 1.0f, 4);
  y += 16.0f;

  y += txt_bloco(TXT_CAPTION2,
#ifdef __EMSCRIPTEN__
                 "Na TV da LG é o botão vermelho do controle. Se a tela "
                 "congelar e o vermelho não responder, o botão verde mostra o "
                 "painel de arranque.",
#else
                 "Na TV da Samsung o vermelho sai do botão de números e cores, "
                 "abaixo do liga-desliga.",
#endif
                 150, 152, 160, x, y, larg, 28.0f, 1.0f, 3);
  y += 16.0f;

  l = txt_linha(TXT_CAPTION2, "OK ou Voltar para fechar este aviso",
                183, 186, 194, 255);
  txt_desenhar(l, x, y);
}

void registro_desenhar(void) {
  if (!aberto && !aviso) return;
  // RECORTE DESLIGADO ANTES DE DESENHAR. Todo chamador de gfx_recorte equilibra
  // com gfx_sem_recorte, mas isso e uma invariante que ninguem verifica — e
  // main.c ja paga uma chamada por quadro pelo mesmo motivo antes do glClear.
  // Aqui vale ainda mais: se uma tela esquecer o recorte ligado, o unico
  // sintoma seria o painel de DIAGNOSTICO nao aparecer, o que manda procurar o
  // defeito no lugar errado. Uma chamada, e so com o painel em pe.
  gfx_sem_recorte();
  if (aberto) desenhaPainel();
  else desenhaAviso();
}
