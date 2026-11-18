"use client";

import { Crosshair, Navigation2, Repeat2, Volume2, VolumeX, X } from "lucide-react";
import driving from "./viago-driving-c10.module.css";

type GpsSignal = "idle" | "waiting" | "valid" | "imprecise" | "stale" | "invalid";

type Props = {
  instruction: string;
  arrow: string;
  turnDistance: string | null;
  distanceQualifier: string | null;
  destination: string;
  following: { arrow: string; title: string } | null;
  speed: number | null;
  gpsSignal: GpsSignal;
  gpsAccuracy: number | null;
  remaining: string;
  remainingLabel: string;
  duration: string;
  durationLabel?: string;
  arrival: string;
  arrivalLabel?: string;
  voiceEnabled: boolean;
  canReplayVoice: boolean;
  voiceReplayBusy: boolean;
  onReplayVoice: () => void;
  voiceStatus: string | null;
  voiceError: string | null;
  onToggleVoice: () => void;
  onFollow: () => void;
  onOverview: () => void;
  onStop: () => void;
};

/** Presentational-only HUD. Receives real navigation data; never derives a turn or GPS fix. */
export default function ViagoDrivingHud(props: Props) {
  const { instruction, arrow, turnDistance, distanceQualifier, destination, following, speed, gpsSignal,
    gpsAccuracy, remaining, remainingLabel, duration, durationLabel, arrival, arrivalLabel,
    voiceEnabled, canReplayVoice, voiceReplayBusy, onReplayVoice,
    voiceStatus, voiceError, onToggleVoice, onFollow, onOverview, onStop } = props;
  const accuracy = gpsAccuracy === null ? "" : ` ±${Math.round(gpsAccuracy)} m`;
  const gpsLabel = gpsSignal === "valid" ? `GPS${accuracy}`
    : gpsSignal === "imprecise" ? `Position incertaine${accuracy}`
    : gpsSignal === "stale" ? "Signal GPS temporairement perdu" : "Recherche GPS";
  return (
    <section className={driving.shell} style={{ colorScheme: "only light" }} aria-label="Guidage routier Viago">
      <header className={driving.banner}>
        <div className={driving.turnSymbol} aria-hidden="true">
          <span>{arrow}</span>
          {turnDistance !== null && <small>{turnDistance}</small>}
        </div>
        <div className={driving.bannerText} aria-live="polite" aria-atomic="true">
          <span className={driving.eyebrow}>VIAGO · NAVIGATION</span>
          <strong className={driving.turnTitle}>{instruction}</strong>
          <span className={driving.destination}>{distanceQualifier ? `${distanceQualifier} · ` : ""}{destination}</span>
          {voiceError && <span role="alert" className="text-xs font-semibold text-amber-100">{voiceError}</span>}
        </div>
      </header>
      {following && (
        <div className={driving.nextCard} style={{ backgroundColor: "#ffffff", color: "#102c3c", colorScheme: "only light" }} aria-label="Instruction suivante">
          <span className={driving.nextLabel}>PUIS</span>
          <strong className={driving.nextArrow} aria-hidden="true">{following.arrow}</strong>
          <span className={driving.nextText}>{following.title}</span>
        </div>
      )}
      <div className={driving.speed} style={{ backgroundColor: "#ffffff", color: "#102c3c", colorScheme: "only light" }} aria-label={speed === null ? "Vitesse GPS indisponible" : `Vitesse GPS ${speed} kilomètres par heure`}>
        <span className={driving.speedNumber}>{speed ?? "--"}</span><span className={driving.speedUnit}>km/h</span>
      </div>
      <div className={driving.gpsNotice} style={{ backgroundColor: "#ffffff", color: "#102c3c", colorScheme: "only light" }} role="status">
        <span className={gpsSignal === "valid" ? driving.gpsDotGood : driving.gpsDot} aria-hidden="true" />{gpsLabel}
        {voiceEnabled && voiceStatus &&
          <span title={voiceStatus} className="ml-2 max-w-[175px] truncate border-l border-slate-200 pl-2 text-[10px] font-semibold text-slate-600" aria-live="off">{voiceStatus}</span>}
      </div>
      <div className={driving.controls} aria-label="Contrôles de la carte">
        <button type="button" onClick={onToggleVoice} className={driving.roundButton}
          style={{ backgroundColor: "#ffffff", color: voiceEnabled ? "#087c63" : "#607487", colorScheme: "only light" }}
          aria-pressed={voiceEnabled} aria-label={voiceEnabled ? "Désactiver le guidage vocal" : "Activer le guidage vocal"}
          title={voiceEnabled ? "Couper la voix" : "Activer la voix française"}>
          {voiceEnabled ? <Volume2 size={22} aria-hidden="true"/> : <VolumeX size={22} aria-hidden="true"/>}
        </button>
        {voiceEnabled && <button type="button" onClick={onReplayVoice} disabled={!canReplayVoice}
          className={driving.roundButton}
          style={{ backgroundColor: "#ffffff", color: "#086fb9", colorScheme: "only light", opacity: canReplayVoice ? 1 : 0.4 }}
          aria-label={voiceReplayBusy ? "Répétition vocale en cours" : "Réécouter la dernière instruction confirmée"}
          title={canReplayVoice ? "Réécouter la direction" : "Attendre une annonce GPS confirmée"}>
          <Repeat2 size={21} aria-hidden="true"/>
        </button>}
        <button type="button" onClick={onFollow} className={driving.roundButton} style={{ backgroundColor: "#ffffff", color: "#086fb9", colorScheme: "only light" }} aria-label="Suivre mon véhicule"><Crosshair size={22} aria-hidden="true"/></button>
        <button type="button" onClick={onOverview} className={driving.roundButton} style={{ backgroundColor: "#ffffff", color: "#086fb9", colorScheme: "only light" }} aria-label="Afficher le parcours entier"><Navigation2 size={22} aria-hidden="true"/></button>
      </div>
      <footer className={driving.dock} style={{ backgroundColor: "#ffffff", color: "#102c3c", colorScheme: "only light" }} aria-label="Informations du trajet">
        <div className={driving.metrics}>
          <div className={driving.metric}><strong>{remaining}</strong><span className={driving.metricLabel}>{remainingLabel}</span></div>
          <div className={driving.metric}><strong>{duration}</strong><span className={driving.metricLabel}>{durationLabel ?? "Durée indicative"}</span></div>
          <div className={driving.metric}><strong>{arrival}</strong><span className={driving.metricLabel}>{arrivalLabel ?? "Arrivée est."}</span></div>
        </div>
        <button type="button" className={driving.stopButton} style={{ backgroundColor: "#f5f7fa", color: "#264b64", colorScheme: "only light" }} onClick={onStop} aria-label="Arrêter la navigation"><X size={21} aria-hidden="true"/><span>Terminer</span></button>
      </footer>
      <p className={driving.noTraffic}>Durée indicative · trafic temps réel non disponible</p>
    </section>
  );
}
