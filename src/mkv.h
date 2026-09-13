// Leitura do CABECALHO de um Matroska, so para descobrir o idioma das faixas.
//
// POR QUE ISTO EXISTE. O pipeline da LG devolve, no sourceInfo, o idioma de
// cada faixa de AUDIO ("en", "es", "fr", "it") e NENHUM idioma de legenda:
// medido num arquivo do dono com 43 legendas, todas com
// "language":"(null)", e os unicos campos do subtitleTrackInfo sao trackNum,
// language, type e periodStart. Nao ha outro campo para ler — a informacao
// simplesmente nao sai do pipeline.
//
// O app web mostra os idiomas porque o NAVEGADOR demuxa o arquivo por conta
// propria e expoe textTracks. Este modulo faz a mesma coisa em pequeno: baixa
// os primeiros megabytes por Range e le o elemento Tracks do EBML.
//
// NAO E UM DEMUXER. Nao decodifica nada, nao segue Cues, nao le Clusters. Anda
// pela arvore de elementos ate Segment > Tracks e para. Qualquer coisa que nao
// case com o esperado faz a leitura desistir em silencio — o chamador continua
// com "Legenda N", que e o que havia antes.
#ifndef NV_MKV_H
#define NV_MKV_H

#define MKV_MAX_FAIXAS 64

typedef struct {
  int  numero;        // TrackNumber, o mesmo `trackNum` do sourceInfo da LG
  int  tipo;          // 1 video, 2 audio, 17 legenda (TrackType do Matroska)
  char idioma[8];     // "por", "eng"... vazio quando o arquivo nao etiqueta
  char nome[48];      // Name, quando existe ("Forced", "SDH", "Full")
  char codec[24];     // CodecID ("S_TEXT/UTF8", "S_HDMV/PGS")
} MkvFaixa;

#define MKV_MAX_CAPS 64

// CAPITULO. Existe pelo pos-reproducao: sem marcador, "quando comecam os
// creditos" vira chute, e um chute erra em minutos. Muitos lancamentos trazem
// um capitulo final chamado "End Credits"/"Creditos" — quando ele esta la, e a
// resposta exata, de graca, no cabecalho que ja baixamos para as faixas.
typedef struct {
  double inicio;      // segundos desde o inicio do arquivo
  char   nome[64];    // ChapString, quando o arquivo nomeia
} MkvCap;

// Le o cabecalho de `url` e preenche `saida`. Devolve quantas faixas achou, 0
// quando nao deu (nao e MKV, servidor sem Range, cabecalho maior que o trecho).
// BLOQUEIA: chamar de um fio proprio.
int mkv_faixas(const char *url, MkvFaixa *saida, int max);

// Mesma leitura, UMA viagem so, devolvendo tambem os capitulos. `caps` pode ser
// NULL. O numero de capitulos sai por `nCaps`.
//
// UMA VIAGEM E O PONTO: a nota no topo de mkv.c registra que esta leitura
// acontece com o video JA TOCANDO, pela mesma conexao — uma segunda descida de
// 320 KB para buscar capitulos custaria exatamente o engasgo que aquela nota
// descreve.
int mkv_faixas_e_caps(const char *url, MkvFaixa *saida, int max,
                      MkvCap *caps, int maxCaps, int *nCaps);

// Segundo do capitulo que se IDENTIFICA como creditos pelo nome, ou 0. Nao
// chuta pela posicao: quem sabe a duracao do filme e quem chama, e sem ela
// "ultimo capitulo" nao distingue creditos de cena final.
double mkv_creditos_nomeados(const MkvCap *caps, int n);

#endif
