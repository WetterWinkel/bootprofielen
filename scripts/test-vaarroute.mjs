import { buildNetwork, planRoute } from "../app/lib/vaarroute.server.ts";
const net = await buildNetwork((m) => console.log(m));
const r = planRoute(net, [5.8328, 53.0953], [5.6589, 53.0326], null);
console.log("Sneek onbeperkt:", (r.distanceM/1000).toFixed(1), "km via", r.waterways.join(" > "));
for (const o of r.objects) console.log("  ", o.kind, o.id, o.name, "clear", o.clearance, "canOpen", o.canOpen, "lat/lon", o.lat.toFixed(5), o.lon.toFixed(5));
// edges op dit pad met blockedFor < 2
// sluizen debug
const res = await fetch("https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=sluis&count=5&bbox=5.5,52.8,6.0,53.3,urn:ogc:def:crs:OGC:1.3:CRS84");
const d = await res.json();
for (const f of d.features) console.log("sluis", f.properties.name, f.geometry.type, JSON.stringify(f.geometry.coordinates).slice(0, 160));
const res2 = await fetch("https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=sluis&count=3");
const d2 = await res2.json(); console.log("totaal sluis", d2.totalFeatures, d2.numberMatched);
for (const t of ["sluis_v","sluiskolk","kunstwerkcomplex"]) { const x = await (await fetch(`https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=${t}&count=1`)).json(); console.log(t, x.numberMatched, JSON.stringify(x.features?.[0]?.geometry||{}).slice(0,120), Object.keys(x.features?.[0]?.properties||{}).join(",").slice(0,300)); }
// brug HasOpeningOnOtherFairway velden in WFS?
const b = await (await fetch("https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=brug&count=1")).json();
console.log("brug props", Object.keys(b.features[0].properties).join(","));
