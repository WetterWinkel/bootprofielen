# Rendert de vaste beeldvlakken (achtergronden met tekst) voor de Reel en de post.
# De productfoto's worden er in GitHub Actions overheen gezet (build.sh).
import asyncio
from playwright.async_api import async_playwright

NAVY="#0b2a4a"; BLUE="#0877bd"; GREEN="#1c8a52"
TRUCK='<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
BASE=f"""<style>*{{margin:0;box-sizing:border-box}}body{{width:1080px;height:1920px;font-family:'DejaVu Sans','Liberation Sans',Arial,sans-serif;
background:linear-gradient(180deg,{NAVY} 0%,#0f3d68 100%);color:white;position:relative;overflow:hidden}}
.brand{{position:absolute;top:90px;left:0;right:0;text-align:center;font-size:56px;font-weight:800;letter-spacing:-1px}}
.brand small{{display:block;font-size:30px;font-weight:600;color:#9ec9ea;margin-top:8px;letter-spacing:2px;text-transform:uppercase}}
.head{{position:absolute;top:300px;left:70px;right:70px;text-align:center;font-size:74px;line-height:1.08;font-weight:800}}
.card{{position:absolute;top:620px;left:110px;width:860px;height:860px;background:white;border-radius:48px;box-shadow:0 30px 80px rgba(0,0,0,.35)}}
.pill{{position:absolute;top:1540px;left:50%;transform:translateX(-50%);background:{GREEN};border-radius:999px;padding:26px 56px;
font-size:52px;font-weight:800;display:flex;gap:22px;align-items:center;white-space:nowrap}}
.sub{{position:absolute;top:1700px;left:60px;right:60px;text-align:center;font-size:40px;color:#cfe4f5;font-weight:600}}
</style>"""
def scene(head, sub, pill=True, card=True):
    return BASE+f"""<div class=brand>WetterWinkel.nl<small>alles voor uw boot</small></div>
<div class=head>{head}</div>{'<div class=card></div>' if card else ''}
{f'<div class=pill>{TRUCK}Gratis verzending</div>' if pill else ''}<div class=sub>{sub}</div>"""
SCENES={
 "s1": scene("Gratis verzending op 14.000+ artikelen","Nederland en België"),
 "s2": scene("Groen label?<br>Geen verzendkosten.","Van ankerlier tot toilet"),
 "s3": scene("Eén zo'n artikel in je mandje?","Dan gaat je héle bestelling gratis mee"),
 "s4": scene("20 dagen retour","Levering in 1–3 werkdagen"),
 "s5": BASE+f"""<div class=brand style="top:640px;font-size:110px">WetterWinkel.nl<small style="font-size:46px;margin-top:24px">alles voor uw boot</small></div>
<div class=pill style="top:1060px">{TRUCK}Gratis verzending</div>
<div class=sub style="top:1240px;font-size:48px;color:white">op 14.000+ artikelen</div>
<div class=sub style="top:1500px">wetterwinkel.nl/collections/gratis-verzending</div>""",
}
POST=f"""<style>*{{margin:0;box-sizing:border-box}}body{{width:1080px;height:1350px;font-family:'DejaVu Sans','Liberation Sans',Arial,sans-serif;
background:linear-gradient(180deg,{NAVY},#0f3d68);color:white;position:relative;overflow:hidden}}
.brand{{position:absolute;top:56px;left:0;right:0;text-align:center;font-size:44px;font-weight:800}}
.head{{position:absolute;top:140px;left:50px;right:50px;text-align:center;font-size:66px;line-height:1.08;font-weight:800}}
.cell{{position:absolute;width:450px;height:450px;background:white;border-radius:32px}}
.pill{{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);background:{GREEN};border-radius:999px;padding:20px 44px;font-size:42px;font-weight:800;display:flex;gap:18px;align-items:center;white-space:nowrap}}
.sub{{position:absolute;bottom:70px;left:40px;right:40px;text-align:center;font-size:30px;color:#cfe4f5;font-weight:600}}
</style><div class=brand>WetterWinkel.nl</div><div class=head>Gratis verzending op 14.000+ artikelen</div>
<div class=cell style="top:330px;left:70px;height:640px"></div><div class=cell style="top:330px;left:560px;height:640px"></div>
<div class=pill>{TRUCK}1 artikel = hele bestelling gratis</div>
<div class=sub>20 dagen retour · levering in 1–3 werkdagen</div>"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for name,html in SCENES.items():
            pg=await b.new_page(viewport={"width":1080,"height":1920})
            await pg.set_content(html); await pg.screenshot(path=f"bg_{name}.png"); await pg.close()
        pg=await b.new_page(viewport={"width":1080,"height":1350})
        await pg.set_content(POST); await pg.screenshot(path="bg_post.png")
        await b.close()
asyncio.run(main())
