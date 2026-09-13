#include "marco.h"
#include <stdio.h>
#include <pthread.h>
#include <time.h>

// RELOGIO PROPRIO, e nao SDL_GetTicks.
//
// MEDIDO, com rastro de pilha: `montar` -> `marco` -> `SDL_GetTicks_REAL` ->
// salto para 0x0, EXC_BAD_ACCESS. O SDL resolve as funcoes por uma tabela
// dinamica preenchida no SDL_Init, e os testes que ligam o app inteiro
// (tests/conta_logout.c e companhia) nunca inicializam o SDL — nao ha video.
// Enquanto so o fio principal carimbava marcos, ninguem via; assim que um fio
// de fundo (a descoberta) alcancou um marco antes do fim do processo, o teste
// passou a falhar cerca de uma vez em vinte, DEPOIS de ja ter impresso "TUDO
// APAGADO". Um teste que passa e depois segfalta e pior que um que falha: nao
// da para saber se o que ele afirmou vale.
//
// clock_gettime(CLOCK_MONOTONIC) nao depende de inicializacao nenhuma, e
// monotonico como o SDL_GetTicks e, e existe tanto no macOS quanto na TV. De
// quebra sai a unica dependencia de SDL deste modulo.
static unsigned long long t0;
static pthread_mutex_t trava = PTHREAD_MUTEX_INITIALIZER;

static unsigned long long agoraMs(void) {
  struct timespec ts;
  if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return 0ULL;
  return (unsigned long long)ts.tv_sec * 1000ULL +
         (unsigned long long)(ts.tv_nsec / 1000000L);
}

void marco_iniciar(void) {
  FILE *f;
  t0 = agoraMs();
  f = fopen("/tmp/nuvio-marcos.txt", "w");
  if (f) { fprintf(f, "ms\tevento\n"); fclose(f); }
}

void marco(const char *nome) {
  FILE *f;
  unsigned long long ms;
  if (!nome) return;
  // O relogio e seguro entre fios; o que precisa de trava e o arquivo, para
  // dois fios nao intercalarem meia linha cada.
  ms = agoraMs() - t0;
  pthread_mutex_lock(&trava);
  f = fopen("/tmp/nuvio-marcos.txt", "a");
  if (f) { fprintf(f, "%llu\t%s\n", ms, nome); fclose(f); }
  pthread_mutex_unlock(&trava);
  printf("[t] %llu %s\n", ms, nome);
  fflush(stdout);
}
