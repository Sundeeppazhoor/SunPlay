#include "debrid.h"
#include "rede.h"
#include "js.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <ctype.h>
#include <unistd.h>

#define RD "https://api.real-debrid.com/rest/1.0"

static char chave[200];
static int  alvoT, alvoE;

void debrid_definir_chave(const char *servico, const char *k) {
  if (!servico || !k || !*k) return;
  if (strcasecmp(servico, "realdebrid") && strcasecmp(servico, "real-debrid")) {
    printf("[debrid] %s: servico sem resolvedor aqui, ignorado\n", servico);
    return;
  }
  snprintf(chave, sizeof chave, "%s", k);
  printf("[debrid] chave do Real-Debrid vinda da conta\n");
}
int  debrid_ativo(void) { return chave[0] != 0; }
void debrid_esquecer(void) { memset(chave, 0, sizeof chave); alvoT = alvoE = 0; }
void debrid_definir_episodio(int t, int e) { alvoT = t; alvoE = e; }

// ---------------------------------------------------------------- http

static void urlenc(char *dst, unsigned n, const char *s) {
  unsigned k = 0;
  for (; *s && k + 4 < n; s++) {
    unsigned char c = (unsigned char)*s;
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') dst[k++] = (char)c;
    else k += (unsigned)snprintf(dst + k, n - k, "%%%02X", c);
  }
  dst[k] = 0;
}

static char *post(const char *rota, const char *corpo, int *st) {
  char url[300], auth[260];
  const char *cab[3];
  snprintf(url, sizeof url, RD "/%s", rota);
  snprintf(auth, sizeof auth, "Authorization: Bearer %s", chave);
  cab[0] = auth; cab[1] = "Content-Type: application/x-www-form-urlencoded"; cab[2] = NULL;
  return rede_postar_st(url, 15, cab, corpo, st);
}
static char *get(const char *rota, int *st) {
  char url[300], auth[260];
  const char *cab[2];
  snprintf(url, sizeof url, RD "/%s", rota);
  snprintf(auth, sizeof auth, "Authorization: Bearer %s", chave);
  cab[0] = auth; cab[1] = NULL;
  return rede_baixar_st(url, 15, cab, st);
}
static int ok2xx(const char *r, int st) { return r && st >= 200 && st < 300; }

// ---------------------------------------------------------------- arquivo

static int ehVideo(const char *nome) {
  static const char *ext[] = { ".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".ts", ".m2ts", ".wmv", NULL };
  size_t L = strlen(nome); int i;
  for (i = 0; ext[i]; i++) {
    size_t e = strlen(ext[i]);
    if (L > e && !strcasecmp(nome + L - e, ext[i])) return 1;
  }
  return 0;
}
static void minusc(char *s) { for (; *s; s++) *s = (char)tolower((unsigned char)*s); }

// Mesma ordem do selectDebridFile do web: padrao SxxEyy > fileIdx > maior video.
// `files` e o array JSON do torrents/info; devolve o id do arquivo ou -1.
static int escolherArquivo(const char *files, int fileIdx) {
  char pad1[16] = "", pad2[16] = "", pad3[16] = "";
  const char *p; int idx = 0, melhor = -1; double melhorTam = -1;
  if (alvoT > 0 && alvoE > 0) {
    snprintf(pad1, sizeof pad1, "s%02de%02d", alvoT, alvoE);
    snprintf(pad2, sizeof pad2, "%dx%02d", alvoT, alvoE);
    snprintf(pad3, sizeof pad3, "e%02d", alvoE);
  }
  for (p = files; p && *p == '{'; p = js_prox(js_fim(p)), idx++) {
    const char *f = js_fim(p);
    char path[600]; double tam; int id;
    if (!js_texto(p, f, "path", path, sizeof path)) continue;
    id  = (int)js_num(p, f, "id", -1);
    tam = js_num(p, f, "bytes", 0);
    minusc(path);
    if (!ehVideo(path)) continue;
    if (pad1[0] && (strstr(path, pad1) || strstr(path, pad2))) return id;
    if (idx == fileIdx && fileIdx >= 0) { melhor = id; melhorTam = 1e18; continue; }
    if (tam > melhorTam) { melhor = id; melhorTam = tam; }
  }
  (void)pad3;
  return melhor;
}

// ---------------------------------------------------------------- resolver

int debrid_resolver(const char *infoHash, int fileIdx, char *url, unsigned n) {
  char corpo[700], enc[600], rota[120], tid[64], status[32], link[600];
  char *r; int st = 0, id, tent;
  const char *files, *links;
  if (!chave[0] || !infoHash || !*infoHash) return 0;

  snprintf(corpo, sizeof corpo, "magnet:?xt=urn:btih:%s", infoHash);
  urlenc(enc, sizeof enc, corpo);
  snprintf(corpo, sizeof corpo, "magnet=%s", enc);
  r = post("torrents/addMagnet", corpo, &st);
  if (!ok2xx(r, st) || !js_texto(r, NULL, "id", tid, sizeof tid)) {
    printf("[debrid] addMagnet: HTTP %d\n", st); free(r); return 0;
  }
  free(r);

  snprintf(rota, sizeof rota, "torrents/info/%s", tid);
  r = get(rota, &st);
  if (!ok2xx(r, st) || !(files = js_array(r, NULL, "files"))) {
    printf("[debrid] info: HTTP %d\n", st); free(r); return 0;
  }
  id = escolherArquivo(files, fileIdx);
  free(r);
  if (id < 0) { printf("[debrid] torrent sem video utilizavel\n"); return 0; }

  snprintf(rota, sizeof rota, "torrents/selectFiles/%s", tid);
  snprintf(corpo, sizeof corpo, "files=%d", id);
  r = post(rota, corpo, &st);
  free(r);
  if (!(st == 204 || st == 202 || (st >= 200 && st < 300))) {
    printf("[debrid] selectFiles: HTTP %d\n", st); return 0;
  }

  // Em cache o RD marca "downloaded" quase na hora; fora de cache ele
  // comecaria a BAIXAR — e isso nao e "tocar agora". Tres olhadas e desiste.
  link[0] = 0;
  for (tent = 0; tent < 3 && !link[0]; tent++) {
    snprintf(rota, sizeof rota, "torrents/info/%s", tid);
    r = get(rota, &st);
    if (ok2xx(r, st) && js_texto(r, NULL, "status", status, sizeof status)
        && !strcmp(status, "downloaded") && (links = js_array(r, NULL, "links"))
        && *links == '"') {
      const char *fim = strchr(links + 1, '"');
      if (fim && (size_t)(fim - links - 1) < sizeof link) {
        memcpy(link, links + 1, (size_t)(fim - links - 1)); link[fim - links - 1] = 0;
      }
    }
    free(r);
    if (!link[0]) sleep(1);
  }
  if (!link[0]) {
    printf("[debrid] %s nao esta em cache no Real-Debrid\n", infoHash);
    // ponytail: o torrent fica na lista do RD (apagar exige HTTP DELETE, que
    // rede.c nao tem). Limpar quando incomodar.
    return 0;
  }

  urlenc(enc, sizeof enc, link);
  snprintf(corpo, sizeof corpo, "link=%s", enc);
  r = post("unrestrict/link", corpo, &st);
  if (!ok2xx(r, st) || !js_texto(r, NULL, "download", url, n)) {
    printf("[debrid] unrestrict: HTTP %d\n", st); free(r); return 0;
  }
  free(r);
  // O CAMINHO DESTA URL E A CREDENCIAL: e o link direto que o Real-Debrid
  // devolve, e quem o tem baixa usando a conta de quem pediu. Ver
  // rede_url_publica em rede.h. Os 60 caracteres que estavam aqui incluiam o
  // segmento /d/<chave>/ inteiro.
  { char seg[120];
    printf("[debrid] %s -> %s\n", infoHash,
           rede_url_publica(url, seg, sizeof seg)); }
  return 1;
}
