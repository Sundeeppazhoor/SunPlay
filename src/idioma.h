// Idioma da interface.
//
// POR QUE A TRADUCAO MORA NA CAMADA DE TEXTO, e nao em cada tela: todo texto
// que chega na tela passa por text.c. Traduzir ali e UM ponto; traduzir na
// origem seriam ~400 lugares, e o proximo texto escrito por alguem que nao
// conhece esta regra nasceria fora do sistema. O custo desta escolha esta
// medido em i18n(): uma busca binaria por linha desenhada, e as linhas ja sao
// cacheadas por text.c.
//
// A CHAVE E O PROPRIO PORTUGUES. Nao ha catalogo de simbolos ("home.title"),
// porque o portugues ja e escrito em toda a base e trocar tudo por simbolo era
// a refatoracao que impediria isto de existir. Consequencia aceita e conhecida:
// um texto DINAMICO que por acaso seja identico a uma chave tambem e traduzido
// — um filme chamado exatamente "Fontes" viraria "Sources". Nenhum titulo do
// catalogo colide com as chaves de hoje; se um dia colidir, a saida e tirar a
// chave da tabela, nao traduzir na origem.
//
// O QUE NAO PASSA POR AQUI: texto montado com snprintf ("Temporada %d"). A
// string final nunca casa com uma chave. Esses ficam em portugues ate serem
// tratados um a um, e a lista deles esta em FERRAMENTAS.md.
#ifndef NV_IDIOMA_H
#define NV_IDIOMA_H

// Devolve `s` traduzido quando o idioma e ingles e a chave existe; senao
// devolve o proprio `s`. Nunca devolve NULL se `s` nao for NULL, e o ponteiro
// devolvido vive tanto quanto o programa (tabela estatica).
const char *i18n(const char *s);

// Levantamento das strings que REALMENTE chegam na tela, para montar a tabela
// sem adivinhar. Ligado por ambiente:
//     NUVIO_TEXTO_DUMP=/tmp/textos.txt bash tools/mac.sh
// Cada string nova e anexada uma vez. Sem a variavel nao custa nada alem de um
// teste de ponteiro nulo.
void idioma_registrar(const char *s);

#endif
