// WebP por dlopen da libwebp DO APARELHO. O SDL2_image da TV nao foi compilado
// com WebP ("WEBP images are not supported"), mas /usr/lib/libwebp.so.7 existe
// no sistema. As colecoes da conta vem do CDN do Xperience em .webp — 149 de
// 169 pastas — e sem isto a home inteira delas era cartao vazio.
#ifndef NV_WEBP_H
#define NV_WEBP_H
#include <SDL2/SDL.h>
// Superficie ABGR8888 nova (o chamador libera) ou NULL quando nao e WebP, a
// lib nao existe ou a decodificacao falhou. Nunca imprime em caso "nao e WebP".
SDL_Surface *webp_carregar(const char *caminho);
#endif
