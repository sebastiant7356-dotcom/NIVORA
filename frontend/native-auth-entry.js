import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

const REDIRECT_URI = "in.nivora.social://auth/callback";
let pendingUrl = null;

async function finishOAuth(url) {
  if (!url || !url.startsWith(REDIRECT_URI)) return;
  if (!window.NV) {
    pendingUrl = url;
    return;
  }
  try {
    const { error } = await window.NV.client().auth.exchangeCodeForSession(url);
    if (error) throw error;
    await Browser.close().catch(() => {});
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("NIVORA Google sign-in callback failed:", error?.message || "unknown");
    document.dispatchEvent(new CustomEvent("nivora-auth-error", { detail: "Google sign-in could not be completed. Please try again." }));
  }
}

window.NivoraNative = {
  isNative: () => Capacitor.isNativePlatform(),
  getCurrentPosition: async () => {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== "granted" && permissions.coarseLocation !== "granted") await Geolocation.requestPermissions();
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    return { coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
  },
  signInWithGoogle: async () => {
    if (!Capacitor.isNativePlatform()) throw new Error("Native sign-in is unavailable.");
    const { data, error } = await window.NV.client().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true }
    });
    if (error) throw error;
    if (!data?.url) throw new Error("Google sign-in URL was not returned.");
    await Browser.open({ url: data.url });
    return data;
  },
  handlePending: async () => {
    if (pendingUrl) {
      const url = pendingUrl;
      pendingUrl = null;
      await finishOAuth(url);
    }
  }
};

if (Capacitor.isNativePlatform()) {
  App.addListener("appUrlOpen", ({ url }) => finishOAuth(url));
  App.getLaunchUrl().then((launch) => {
    if (launch?.url) finishOAuth(launch.url);
  }).catch(() => {});
}
