// Service worker van de gezinsplanner: alleen voor pushmeldingen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let data = { titel: "Gezinsplanner", tekst: "", url: "/", tag: undefined };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    if (e.data) data.tekst = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.titel, {
      body: data.tekst,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lijst) => {
      for (const c of lijst) {
        if ("focus" in c) {
          c.navigate(url).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
