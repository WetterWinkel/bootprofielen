import { buildNetwork, planRoute } from "../app/lib/vaarroute.server.ts";
const net = await buildNetwork((m) => console.log(m));
const cases = [
  ["Grou (Pikmeer) -> Sneek centrum", [5.8150, 53.0890], [5.6589, 53.0326]],
  ["Grou (Pikmeer) -> Sneekermeer", [5.8150, 53.0890], [5.7300, 53.0300]],
  ["Lemmer -> Stavoren", [5.7110, 52.8440], [5.3600, 52.8860]],
  ["Grou -> Dokkum", [5.8150, 53.0890], [5.9990, 53.3260]],
];
for (const [name, a, b] of cases) for (const air of [1.9, 3.5]) {
  const r = planRoute(net, a, b, air);
  if (!r.ok) { console.log(name, air, "->", r.reason); continue; }
  console.log(`${name} air=${air}: ${(r.distanceM/1000).toFixed(1)} km; bruggen ${r.objects.filter(o=>o.kind==="bridge").length} (open ${r.objects.filter(o=>o.kind==="bridge"&&o.mustOpen).length}); sluizen ${r.objects.filter(o=>o.kind==="lock").map(o=>o.name).join(", ")}`);
}
