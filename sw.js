// Service worker mínimo para instalação PWA; não armazena dados administrativos em cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification('FJU Connect JAPAN',{
    body:typeof payload.body==='string'?payload.body:'Você tem uma atualização no FJU Connect.',
    tag:'fju-relatorio',data:{url:self.registration.scope}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(self.registration.scope));
});
