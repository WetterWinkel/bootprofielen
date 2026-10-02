import type {LoaderFunctionArgs} from "react-router";

// Natuurlijke voice-over voor uitlegvideo's.
// Spreekt uitsluitend teksten uit de eigen repo (voice/<name>/scenes/<scene>.txt),
// dus er kan geen willekeurige tekst via deze route worden ingesproken.
const REPO_RAW = "https://raw.githubusercontent.com/WetterWinkel/bootprofielen/main/voice";
const cache = new Map<string, ArrayBuffer>();

const DEFAULT_INSTRUCTIONS =
  "Spreek in vloeiend, natuurlijk Nederlands (Nederland, geen Vlaams). Je bent een warme, enthousiaste maar rustige " +
  "verteller van een korte uitlegvideo voor bootbezitters. Praat zoals een vriendelijke watersporter die iets laat zien: " +
  "ontspannen tempo, natuurlijke intonatie, korte pauzes bij komma's en punten, niet voorlezend en niet robotachtig. " +
  "Spreek 'WetterWinkel' uit als 'wetter-winkel' en 'wetterwinkel punt en-el' als 'wetterwinkel punt N L'.";

export async function loader({params, request}: LoaderFunctionArgs) {
  const name = String(params.name ?? "");
  const scene = String(params.scene ?? "");
  if (!/^[a-z0-9-]{1,40}$/.test(name) || !/^\d{2}$/.test(scene)) {
    return new Response("Ongeldige scène", {status: 400});
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return new Response("Geen OpenAI-sleutel", {status: 503});

  const ref = new URL(request.url).searchParams.get("ref") ?? "main";
  const base = REPO_RAW.replace("/main/", `/${/^[0-9a-f]{7,40}$/.test(ref) ? ref : "main"}/`);
  const [textRes, instrRes, voiceRes] = await Promise.all([
    fetch(`${base}/${name}/scenes/${scene}.txt`),
    fetch(`${base}/${name}/instructions.txt`),
    fetch(`${base}/${name}/openai-voice.txt`),
  ]);
  if (!textRes.ok) return new Response("Scènetekst niet gevonden", {status: 404});
  const text = (await textRes.text()).trim().slice(0, 1200);
  const instructions = instrRes.ok ? (await instrRes.text()).trim().slice(0, 1500) : DEFAULT_INSTRUCTIONS;
  const voice = voiceRes.ok ? (await voiceRes.text()).trim() || "ash" : "ash";

  const key = JSON.stringify([text, instructions, voice]);
  let audio = cache.get(key);
  if (!audio) {
    const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json"},
      body: JSON.stringify({model, voice, input: text, instructions, response_format: "mp3"}),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      return new Response(`TTS-fout ${res.status} (${model}): ${detail}`, {status: 502});
    }
    audio = await res.arrayBuffer();
    if (cache.size > 200) cache.clear();
    cache.set(key, audio);
  }
  return new Response(audio, {headers: {"Content-Type": "audio/mpeg", "Cache-Control": "no-store"}});
}
