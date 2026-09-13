// Resolucao LOCAL de torrent via debrid (Real-Debrid), como o
// directDebridResolver.js do app web.
//
// Addons como Torrentio/Comet sem chave de debrid na URL devolvem streams so
// com `infoHash`, sem `url`. O web pega a chave de debrid da CONTA
// (sync_pull_provider_credentials, provider "debrid:realdebrid") e transforma
// o hash num link direto na hora de tocar. Sem isto o app nativo descartava
// todos esses streams e a lista vinha vazia — "addon streams don't work".
//
// ponytail: so Real-Debrid. Torbox e Premiumize tem API propria; entram aqui
// quando alguem com conta neles aparecer.
#ifndef NV_DEBRID_H
#define NV_DEBRID_H

// Chave vinda da conta. `servico` e o sufixo de "debrid:<servico>".
void debrid_definir_chave(const char *servico, const char *chave);
int  debrid_ativo(void);          // ha chave de um servico que sabemos resolver
void debrid_esquecer(void);       // logout

// Episodio alvo da proxima resolucao (0,0 = filme). Serve para escolher o
// arquivo certo dentro de um torrent de temporada inteira.
void debrid_definir_episodio(int temporada, int episodio);

// BLOQUEIA. Devolve 1 e grava em `url` um link direto que toca; 0 se nao deu.
int  debrid_resolver(const char *infoHash, int fileIdx, char *url, unsigned n);

#endif
