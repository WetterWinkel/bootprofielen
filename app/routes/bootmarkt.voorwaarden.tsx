import type {LoaderFunctionArgs} from "react-router";
import {authenticate} from "../shopify.server";

const styles = `<style>
  .ww-terms{max-width:900px;margin:0 auto;padding:42px 20px 70px;color:#17324f;font-family:inherit;line-height:1.65}.ww-terms h1{color:#073d82;font-size:clamp(30px,5vw,48px);line-height:1.1}.ww-terms h2{margin-top:34px;color:#0a3a70}.ww-terms .ww-summary{padding:18px;border:1px solid #d5e7f3;border-radius:14px;background:#f4f9fd}.ww-terms a{color:#076cc2}
</style>`;

export async function loader({request}: LoaderFunctionArgs) {
  const {liquid} = await authenticate.public.appProxy(request);
  return liquid(`${styles}<main class="ww-terms">
    <a href="/apps/bootmarkt">← Terug naar de Bootmarkt</a>
    <h1>Advertentievoorwaarden WetterWinkel Bootmarkt</h1>
    <p class="ww-summary"><strong>Samenvatting:</strong> een advertentie plaatsen is kosteloos en staat na controle en goedkeuring 30 kalenderdagen online. WetterWinkel biedt uitsluitend advertentieruimte en is geen partij bij koop, inspectie, betaling of eigendomsoverdracht.</p>
    <h2>1. Plaatsing en looptijd</h2><p>De looptijd begint op het moment dat WetterWinkel de advertentie goedkeurt en publiceert. WetterWinkel mag een advertentie vóór of na publicatie controleren, aanpassing vragen of verwijderen wanneer deze onjuist, misleidend, onrechtmatig of strijdig met deze voorwaarden is.</p>
    <h2>2. Verantwoordelijkheid van de adverteerder</h2><p>De adverteerder verklaart eigenaar te zijn of bevoegd te zijn de boot aan te bieden. Alle gegevens, foto’s, btw-informatie, CE-informatie, gebreken en registraties moeten naar waarheid worden vermeld. Gestolen goederen, inbreukmakende foto’s en misleidende advertenties zijn verboden.</p>
    <h2>3. WetterWinkel is geen verkoopbemiddelaar</h2><p>Contact, bezichtiging, onderhandeling, betaling van de boot, keuring, RDW-overschrijving en juridische eigendomsoverdracht worden rechtstreeks door koper en verkoper geregeld. WetterWinkel ontvangt geen commissie over de verkoop. Bij een teboekgestelde boot moeten partijen zelf controleren of een notariële akte vereist is.</p>
    <h2>4. Controle en afwijzing</h2><p>Het plaatsen van een advertentie is kosteloos. WetterWinkel controleert iedere inzending en kan een advertentie vóór publicatie afwijzen of om aanpassingen vragen. Er is geen advertentieprijs verschuldigd.</p>
    <h2>5. Privacy</h2><p>WetterWinkel verwerkt het Shopify-klantnummer, advertentiegegevens, foto’s en reacties voor plaatsing, moderatie en contact tussen belangstellende en adverteerder. Het openbare profiel toont geen Shopify-klantnummer, volledig HIN/CIN, exact adres of eigendomsbewijs. Reacties zijn alleen zichtbaar voor de betrokken adverteerder en bevoegde WetterWinkel-medewerkers.</p>
    <h2>6. Melden en moderatie</h2><p>Iedere advertentie heeft een functie “Advertentie melden”. Meldingen over mogelijke fraude, onrechtmatige inhoud of onjuiste informatie worden beoordeeld. Voor vragen of meldingen kunt u ook e-mailen naar <a href="mailto:marketing@wetterwinkel.nl">marketing@wetterwinkel.nl</a>.</p>
    <h2>7. Controle vóór livegang</h2><p>Deze pagina is een praktische concepttekst voor de technische proef. Laat de definitieve voorwaarden, privacyverklaring, DSA-procedure en eventuele fiscale verplichtingen vóór openbare livegang juridisch en fiscaal controleren.</p>
  </main>`);
}
