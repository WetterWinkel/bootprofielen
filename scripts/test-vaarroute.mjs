// Test de routeplanner met echte data (draait in GitHub Actions).
import { buildNetwork, planRoute } from "../app/lib/vaarroute.server.ts";
const t0 = Date.now();
const net = await buildNetwork((m) => console.log(m));
console.log("rss MB", Math.round(process.memoryUsage().rss / 1e6), "heap MB", Math.round(process.memoryUsage().heapUsed / 1e6));
const cases = [
  ["Grou -> Sneek", [5.8328, 53.0953], [5.6589, 53.0326]],
  ["Grou -> Lemmer", [5.8328, 53.0953], [5.7110, 52.8440]],
  ["Leeuwarden -> Harlingen", [5.7990, 53.2010], [5.4120, 53.1750]],
  ["Grou -> Amsterdam", [5.8328, 53.0953], [4.9000, 52.3780]],
];
for (const [name, a, b] of cases) {
  for (const air of [null, 1.9, 3.5, 6]) {
    const t = Date.now();
    const r = planRoute(net, a, b, air);
    if (!r.ok) { console.log(name, "air", air, "GEEN ROUTE:", r.reason, Date.now() - t, "ms"); continue; }
    const open = r.objects.filter((o) => o.kind === "bridge" && o.mustOpen).length;
    const locks = r.objects.filter((o) => o.kind === "lock").length;
    console.log(`${name} air=${air}: ${(r.distanceM / 1000).toFixed(1)} km, ${r.coords.length} punten, bruggen ${r.objects.filter(o=>o.kind==="bridge").length} (open: ${open}), sluizen ${locks}, snap ${Math.round(r.snapFromM)}/${Math.round(r.snapToM)} m, ${Date.now() - t} ms`);
    if (air === 1.9) console.log("   via:", r.waterways.slice(0, 8).join(" > "), "| eerste objecten:", r.objects.slice(0, 5).map(o => `${o.name}(${o.clearance ?? "?"}${o.mustOpen ? ",open" : ""})`).join(", "));
  }
}
console.log("totaal", Date.now() - t0, "ms");
