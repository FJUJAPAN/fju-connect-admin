// Service worker mínimo para instalação PWA; não armazena dados administrativos em cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
