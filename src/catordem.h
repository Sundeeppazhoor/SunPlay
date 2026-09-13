// A ordem das fileiras da home, como a pessoa deixou no app web.
//
// O app ja chamava `sync_pull_home_catalog_settings` e so CONTAVA a resposta:
// quem organizou a home no celular via a TV ignorar tudo. Aqui a resposta vira
// uma lista de chaves ordenada e um conjunto de chaves desligadas, que a
// descoberta consome no mesmo ponto onde ja aplicava art/fileiras.txt.
//
// SO LEITURA, de proposito. Nao existe tela de reordenar no nativo e, sem ela,
// empurrar de volta mandaria a lista que o aparelho conseguiu montar — que e
// menor que a real sempre que um addon demora a responder — e apagaria a
// configuracao da pessoa nos outros aparelhos. A trava esta em PLANO-CONTA-SYNC.md.
//
// A REGRA QUE NAO PODE SER ESQUECIDA: uniao, nao substituicao. O remoto so
// conhece os catalogos que existiam quando foi gravado; aplicar a ordem crua
// APAGA os que apareceram depois. Medido na OLED65C9 como
// `{"localItems":54,"remoteItems":43}` em todo arranque — 54 nunca igualava 43,
// a home era reescrita e reinvalidada a cada boot e nunca convergia. Por isso
// quem aplica (descoberta.c) poe a ordem remota primeiro, ignorando o que nao
// existe local, e mantem os locais desconhecidos no FIM, na ordem que ja tinham.
#ifndef NV_CATORDEM_H
#define NV_CATORDEM_H

// 64 como PREF_MAX de descoberta.c: a home desenha 16 fileiras (CAT_FIL_MAX) e
// a ordem salva pode citar catalogos que este aparelho nem tem instalados.
#define CATORD_MAX   64
#define CATORD_CHAVE 192

// Le a resposta crua da RPC. Aceita `[{"settings_json":{...}}]`, o objeto
// solto, e as duas formas do blob (moderna com `items[]`, legada com arrays de
// chaves). Devolve 1 quando o que foi lido MUDA o que ja estava aplicado — e o
// unico caso em que vale remontar a home; uma resposta igual a da volta
// anterior nao pode custar uma remontagem a cada ciclo de sync.
//
// Resposta vazia (sem ordem e sem ocultos) NAO derruba o que ja havia: um blob
// vazio e "a pessoa nunca configurou", nao "a pessoa apagou tudo".
int catordem_ler(const char *respostaJson);

int         catordem_tem_ordem(void);
int         catordem_n(void);
const char *catordem_chave(int i);        // "" fora da faixa

// 1 quando a conta desligou esta fileira. Confere as DUAS chaves como o web:
// a curta (<addonId>_<tipo>_<catalogoId>) e a de desativar, que carrega a URL
// base e o nome do catalogo.
int catordem_oculta(const char *chave, const char *chaveDesativar);

// A REGRA, num lugar so. Recebe as chaves locais na ordem em que ja estavam e
// escreve em `saida` os INDICES delas na ordem final: primeiro as que o remoto
// conhece, na ordem do remoto; depois todas as outras, no fim, na ordem
// original. Nada e descartado — a contagem devolvida e sempre `nLocais`
// (limitada por `max`), e chave remota que nao existe local nao entra.
//
// Devolve quantos indices escreveu. Sem ordem remota, e a identidade.
int catordem_unir(const char *const *locais, int nLocais, int *saida, int max);

// Os dois booleanos do blob. `tem_*` responde se a chave EXISTIA: ausente nao e
// `false`, e "mantem o que esta na TV".
int catordem_tem_ocultar_nao_lancados(void);
int catordem_ocultar_nao_lancados(void);
int catordem_tem_ocultar_sublinhado(void);
int catordem_ocultar_sublinhado(void);

// Esquece a configuracao lida. Chamar no logout junto com o resto: a ordem da
// home e da conta de quem saiu.
void catordem_esquecer(void);

#endif
