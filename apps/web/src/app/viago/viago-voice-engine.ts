// VIAGO G1-P5-P1: Android TextToSpeech bridge with browser speech fallback.
// On Android native we intentionally require the installed ViagoVoice plugin.
// An old APK must report unavailable rather than silently pretend speech worked.
import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeVoice = {
  speak(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
};
const nativeVoice = registerPlugin<NativeVoice>("ViagoVoice");

export async function speakViagoFrench(text: string): Promise<void> {
  if (typeof window === "undefined") throw new Error("Audio non disponible sur ce terminal.");
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("ViagoVoice")) {
      throw new Error("Module vocal Android absent : installez le nouvel APK G1-P5.");
    }
    await nativeVoice.speak({text});
    return;
  }
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("Synthèse vocale non disponible dans ce navigateur.");
  }
  const engine = window.speechSynthesis;
  engine.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  utterance.volume = 1;
  const french = engine.getVoices().find(voice => voice.lang.toLowerCase().startsWith("fr"));
  if (french) utterance.voice = french;
  engine.speak(utterance);
}
export async function stopViagoSpeech(): Promise<void> {
  if (typeof window === "undefined") return;
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.isPluginAvailable("ViagoVoice")) await nativeVoice.stop();
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
