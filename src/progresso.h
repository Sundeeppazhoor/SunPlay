// Progresso de reproducao: o registro local, com identidade e tempo.
//
// Ate agora o progresso vivia em progresso.txt como "imdb pos dur [temp ep]",
// escrito por catalogo.c. Faltavam tres coisas, e cada uma custava dado
// (PLANO-PROGRESSO.md, Parte 1):
//
//   1. A CHAVE. O web e o tvOS identificam a linha no servidor por
//      `progress_key` = "tt123_s4e9"; este app mandava "tt123:4:9". O servidor
//      faz upsert por essa chave, entao a mesma cena virava DUAS linhas.
//   2. O TEMPO. Sem `last_watched` nao ha como saber se o que veio do servidor
//      e mais novo que o que esta no disco. O ciclo de sync puxa antes de
//      empurrar (certo) e aplicava o remoto ANTIGO por cima do local recem-
//      assistido — a posicao voltava ate o ciclo seguinte.
//   3. O PENDENTE. Uma linha que ESTE aparelho escreveu e ainda nao empurrou
//      vence qualquer coisa que o servidor devolva. E a regra do tvOS
//      (`isPendingPush`), e e o que fecha o item 2 sem relogio sincronizado.
//
// O arquivo continua sendo UM (progresso.txt em dados_dir()), agora com coluna
// de perfil: puxar o perfil 2 nao pode escrever por cima do que o perfil 1
// gravou, e o logout apaga tudo de uma vez sem precisar enumerar perfis.
//
// O formato antigo e lido e migrado na primeira gravacao. As linhas antigas
// entram como PENDENTES: nunca foram empurradas com a chave certa, e empurrar
// de novo e o que conserta as linhas paralelas no servidor.
//
// Este modulo nao conhece catalogo nem rede. catalogo.c so recebe o resultado
// para atualizar itens[]; syncprog.c so le pendentes e aplica remotos.
// Seguro entre fios: toda chamada publica toma um mutex.
#ifndef NV_PROGRESSO_H
#define NV_PROGRESSO_H

#define PROG_MAX 480   // todas as linhas, todos os perfis

typedef struct {
  int  perfil;
  char chave[48];       // progress_key, igual ao web: "tt123_s4e9" ou "tt123"
  char contentId[24];   // titulo puro, sem ":temp:ep"
  char tipo[8];         // "movie" | "series"
  int  temporada, episodio;   // 0 quando filme
  double posSeg, durSeg;
  long long lastWatchedMs;    // 0 = desconhecido (linha migrada)
  int  pendente;              // 1 = escrito aqui, ainda nao empurrado
} ProgRegistro;

// Chave no formato do web (toProgressKey): "%s_s%de%d" quando temporada >= 0 e
// episodio > 0; senao so o contentId. `contentId` pode vir com ":temp:ep" no
// fim (id composto do Trakt) — e cortado.
void prog_chave(char *dst, unsigned n, const char *contentId, int temporada, int episodio);

// Corta um id composto ("tt123:4:9") no primeiro ':'. Se `temporada`/`episodio`
// nao forem NULL e o id trouxer os dois numeros, preenche-os.
void prog_content_id(char *dst, unsigned n, const char *imdb, int *temporada, int *episodio);

// Registros do PERFIL ATIVO, do mais recente para o mais antigo. Devolve quantos.
int  prog_ler(ProgRegistro *saida, int max);

// Copia para `saida` o registro do perfil ativo com essa chave. 1 se havia.
// Copia, e nao ponteiro: dois fios leem aqui, e um ponteiro para o cache
// interno valeria so ate a proxima escrita do outro.
int  prog_por_chave(const char *chave, ProgRegistro *saida);

// Escrita LOCAL (player ao fechar, botao do olho, pos-play). `imdb` pode ser
// composto; temporada/episodio explicitos ganham dos que vierem no id.
// Marca pendente e lastWatched = agora. Recusa durSeg <= 1 (ruido do player).
// Devolve 1 quando gravou.
int  prog_gravar_local(const char *imdb, int temporada, int episodio,
                       double posSeg, double durSeg);

// Aplicacao de uma linha REMOTA (pull). Regra: local pendente vence; senao o
// mais novo vence; empate mantem o local. `r->perfil` e ignorado — vale o
// perfil ativo. Devolve 1 quando aplicou (o chamador entao atualiza o catalogo).
int  prog_aplicar_remoto(const ProgRegistro *r);

// Pendentes do perfil ativo, para o push. Devolve quantos.
int  prog_pendentes(ProgRegistro *saida, int max);

// Depois de um push com sucesso: as chaves deixam de ser pendentes. So elas —
// o player pode ter gravado outra linha durante a viagem.
void prog_marcar_empurrados(const char *const *chaves, int n);

void prog_remover(const char *chave);

// Apaga o arquivo inteiro, todos os perfis. Chamar no logout, junto de
// sync_esquecer_usuario.
void prog_esquecer_tudo(void);

// Descarta o cache; a proxima leitura relê o disco. Chamar quando dados_dir()
// ou o perfil ativo mudam.
void prog_invalidar(void);

// Relogio, em ms desde a epoca. Substituivel para teste.
long long prog_agora_ms(void);
void prog_definir_relogio(long long (*relogio)(void));

#endif
