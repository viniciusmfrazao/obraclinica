// Service worker mínimo — apenas habilita a instalação do app (PWA).
// Não faz cache agressivo para não servir dados desatualizados de uma obra em andamento.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // passthrough — sempre busca da rede
});
