// src/components/QrScanner.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Camera, Keyboard, Zap, ZapOff, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  /** Callback avec la valeur détectée (texte brut du QR). */
  onDetected: (value: string) => void;
  /** Titre affiché dans l'overlay. */
  title?: string;
}

// Détecte le support du BarcodeDetector API (Chrome, Edge, Android)
function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

function vibrate(ms: number | number[]) {
  try { navigator.vibrate?.(ms); } catch {}
}

export function QrScanner({ open, onClose, onDetected, title = "Scanner un QR" }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error" | "denied" | "manual">("idle");
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorch(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error"); setError("Caméra non supportée par ce navigateur");
      return;
    }
    if (!hasBarcodeDetector()) {
      setStatus("error");
      setError("Détection QR non supportée — utilisez Chrome ou saisissez manuellement");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("scanning");

      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || status === "idle") return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.length > 0) {
            const value = codes[0].rawValue as string;
            vibrate([50, 30, 50]);
            stop();
            onDetected(value);
            return;
          }
        } catch { /* frame skip */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      const denied = e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError";
      setStatus(denied ? "denied" : "error");
      setError(denied ? "Autorisation caméra refusée" : e?.message ?? "Impossible de démarrer la caméra");
    }
  }, [onDetected, status, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps: any = track.getCapabilities?.();
    if (!caps?.torch) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as any] });
      setTorch(!torch);
    } catch {}
  }, [torch]);

  useEffect(() => {
    if (open && status === "idle") start();
    if (!open) stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const validerManuel = () => {
    if (!manualCode.trim()) return;
    vibrate(30);
    onDetected(manualCode.trim());
    setManualCode("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur">
        <button onClick={onClose} className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
        <div className="font-semibold text-sm">{title}</div>
        <button onClick={() => setStatus(status === "manual" ? "idle" : "manual")}
          className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Saisie manuelle">
          <Keyboard className="h-5 w-5" />
        </button>
      </div>

      {/* Zone vidéo ou saisie manuelle */}
      <div className="flex-1 relative overflow-hidden">
        {status === "manual" ? (
          <div className="p-6 flex flex-col justify-center h-full max-w-md mx-auto">
            <Label className="text-white text-sm mb-2">Numéro de balise</Label>
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="GN-CKY-______"
              className="h-14 bg-white/10 border-white/20 text-white text-lg font-mono placeholder:text-white/40"
              autoFocus
            />
            <Button size="lg" className="mt-4 h-14 bg-orange-600 hover:bg-orange-700" onClick={validerManuel}>
              Valider
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viseur */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-64 max-w-[80vw] max-h-[80vw]">
                {/* Coins */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl" />
                {/* Ligne de scan animée */}
                {status === "scanning" && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-[scan_2s_ease-in-out_infinite]"
                    style={{ animation: "scan 2s ease-in-out infinite" }} />
                )}
              </div>
            </div>

            {/* Message d'état */}
            <div className="absolute top-24 inset-x-0 flex justify-center pointer-events-none">
              <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full text-sm">
                {status === "starting" && <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Démarrage caméra…</span>}
                {status === "scanning" && <span>Placez le QR dans le cadre</span>}
                {status === "denied" && <span className="text-rose-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Autorisation refusée</span>}
                {status === "error" && <span className="text-rose-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>}
              </div>
            </div>

            {/* Bouton torche */}
            {status === "scanning" && (
              <button onClick={toggleTorch}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center border border-white/20"
                aria-label="Lampe">
                {torch ? <Zap className="h-6 w-6 text-amber-300" /> : <ZapOff className="h-6 w-6" />}
              </button>
            )}

            {/* Actions d'erreur */}
            {(status === "denied" || status === "error") && (
              <div className="absolute bottom-8 inset-x-0 flex justify-center gap-3 px-6">
                <Button size="lg" variant="secondary" onClick={() => setStatus("manual")}>
                  <Keyboard className="h-5 w-5 mr-2" />Saisir manuellement
                </Button>
                {status === "denied" && (
                  <Button size="lg" variant="outline" className="text-white border-white/40 bg-transparent hover:bg-white/10" onClick={start}>
                    <Camera className="h-5 w-5 mr-2" />Réessayer
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }`}</style>
    </div>
  );
}

