// Web-app-manifest voor de WetterWinkel-app (testversie).
// Bereikbaar via www.wetterwinkel.nl/apps/bootmarkt/app/manifest.webmanifest
export async function loader() {
  const base = `${(process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "")}/wetter-app`;
  const manifest = {
    name: "WetterWinkel",
    short_name: "WetterWinkel",
    description: "Shoppen, je boot, Captain AI en je serviceboek op één plek.",
    lang: "nl",
    start_url: "/apps/bootmarkt/app",
    scope: "/",
    display: "standalone",
    background_color: "#F3F6F9",
    theme_color: "#0B2E4A",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
