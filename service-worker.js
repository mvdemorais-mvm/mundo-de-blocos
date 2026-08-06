// Service worker do Mundo de Blocos
// Funciona sem internet depois de aberto uma vez — guarda o jogo em cache.

// Carimbada pelo build a cada `npm run build`, a partir do conteúdo do jogo.
// Fixa no código ela nunca mudava, e a cache antiga vencia para sempre: o
// tablet ficava preso na primeira versão instalada.
const VERSION = 'e7196d22068a'
const CACHE_NAME = `mundo-blocos-${VERSION}`
const URLS_CACHE = ['.', './index.html']

// Instala o service worker e guarda o arquivo na cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_CACHE)
    })
  )
  self.skipWaiting()
})

// Ativa o novo service worker e limpa caches antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Intercepta requisições: tenta a rede, se falhar usa cache
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') {
    return
  }

  // Abrir o jogo vai na REDE primeiro, e só cai na cache se não houver
  // internet. É o que faz uma versão nova chegar ao tablet: com cache
  // primeiro, o jogo do Matheus congelaria na versão do dia da instalação e
  // nada que fosse publicado depois apareceria para ele.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copia = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia))
          return response
        })
        .catch(() =>
          caches.match(event.request).then((cacheado) =>
            cacheado || caches.match('./index.html')
          )
        )
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se encontrou na cache, devolve
      if (response) {
        return response
      }

      // Se não encontrou, tenta buscar da rede
      return fetch(event.request)
        .then((response) => {
          // Se a requisição foi bem-sucedida e é uma resposta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          // Faz uma cópia da resposta para guardar em cache
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Se a rede falhar, tenta a cache
          return caches.match(event.request).then((response) => {
            if (response) {
              return response
            }
            // Se não tem nada em cache, deveria devolver uma página de erro
            // Mas aqui só temos um arquivo HTML, então devolvemos nada
            return new Response('Sem conexão e arquivo não disponível em cache.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            })
          })
        })
    })
  )
})
