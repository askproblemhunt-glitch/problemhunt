import { api } from "./api";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[ProblemHunt] service worker registration failed", e);
    return null;
  }
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type AlertState = "unsupported" | "default" | "denied" | "local" | "push";

export async function currentAlertState(): Promise<AlertState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  return sub ? "push" : "local";
}

/**
 * One click: ask permission, subscribe to Web Push (alerts arrive even when the
 * site is closed), fall back to local notifications if push is unavailable.
 */
export async function enableAlerts(): Promise<AlertState> {
  if (!("Notification" in window)) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "default";
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg || !("pushManager" in reg)) return "local";
  try {
    const { enabled, publicKey } = await api.pushKey();
    if (!enabled || !publicKey) return "local";
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await api.pushSubscribe(sub.toJSON());
    return "push";
  } catch (e) {
    console.warn("[ProblemHunt] push subscription failed, using local alerts", e);
    return "local";
  }
}

let lastLocal = 0;
/** Local (in-browser) notification used when Web Push isn't subscribed. */
export async function localNotify(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  if (Date.now() - lastLocal < 20000) return;
  lastLocal = Date.now();
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(title, { body, tag, icon: "/icons/icon-192.png", badge: "/icons/badge-72.png" });
  else new Notification(title, { body, tag });
}

export function detectDevice(): { name: string; kind: "browser" | "mobile" | "laptop"; platform: string } {
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return {
    name: `${mobile ? "My " + os + " phone" : "This " + os + " device"}${standalone ? " (app)" : ""}`,
    kind: mobile ? "mobile" : "laptop",
    platform: `${os} · ${browser}${standalone ? " · PWA" : ""}`,
  };
}
