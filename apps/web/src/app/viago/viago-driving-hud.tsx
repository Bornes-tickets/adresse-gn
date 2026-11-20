"use client";

import { Crosshair, Navigation2, Repeat2, Volume2, VolumeX, X } from "lucide-react";
import driving from "./viago-driving-c11.module.css";

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
  /** false tant qu'aucune position routiere fiable n'est confirmee (affiche une pastille discrete). */
  confirmed?: boolean;
  roadNotice?: string | null;
  /** true quand l'utilisateur a deplace la carte : affiche le bouton « Recentrer ». */
  showRecenter?: boolean;
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
  onReport?: () => void;
};

/** Presentational-only HUD. Receives real navigation data; never derives a turn or GPS fix. */
export default function ViagoDrivingHud(props: Props) {
  const { instruction, arrow, turnDistance, distanceQualifier, destination, following, speed, gpsSignal,
    gpsAccuracy, remaining, duration, durationLabel, arrival,
    confirmed = true, roadNotice = null, showRecenter = false, voiceEnabled, canReplayVoice, voiceReplayBusy, onReplayVoice,
    voiceError, onToggleVoice, onFollow, onOverview, onStop, onReport } = props;
  const accuracy = gpsAccuracy === null ? "" : ` · ±${Math.round(gpsAccuracy)} m`;
  const searching = !confirmed;
  const signalLabel = gpsSignal === "stale" ? "Signal GPS perdu" : gpsSignal === "imprecise" ? "GPS peu précis" : "Recherche GPS";
  return (
    <section className={driving.shell} style={{ colorScheme: "only light" }} aria-label="Guidage routier Viago">
      <div className={driving.top}>
      {searching ? (
        <header className={driving.searchPill} role="status" aria-live="polite">
          <span className={driving.searchDot} aria-hidden="true" />
          <div className={driving.searchText}>
            <strong>Recherche du signal GPS…</strong>
            <span>{destination}{accuracy}</span>
          </div>
        </header>
      ) : (
        <>
          <header className={driving.turnCard}>
            <div className={driving.turnArrow} aria-hidden="true">{arrow}</div>
            <div className={driving.turnBody} aria-live="polite" aria-atomic="true">
              {turnDistance !== null && <span className={driving.turnDistance}>{turnDistance}</span>}
              <strong className={driving.turnStreet}>{instruction}</strong>
              <span className={driving.turnHint}>{distanceQualifier ? `${distanceQualifier} · ` : ""}{destination}</span>
              {voiceError && <span role="alert" className={driving.voiceAlert}>{voiceError}</span>}
            </div>
          </header>
          {following && (
            <div className={driving.thenChip} aria-label="Instruction suivante">
              <span>Puis</span><b aria-hidden="true">{following.arrow}</b><span>{following.title}</span>
            </div>
          )}
          {roadNotice && (
            <div className={driving.roadChip} role="status"><i aria-hidden="true" />{roadNotice}</div>
          )}
          {gpsSignal !== "valid" && (
            <div className={driving.signalChip} role="status"><i aria-hidden="true" />{signalLabel}</div>
          )}
        </>
      )}
      </div>

      <div className={driving.controls} aria-label="Contrôles de la carte">
        {onReport && (
          <button type="button" onClick={onReport} className={driving.roundButton} aria-label="Signaler un événement sur la route" title="Signaler">
            <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 900, color: "#d97706", lineHeight: 1 }}>!</span>
          </button>
        )}
        <button type="button" onClick={onToggleVoice}
          className={`${driving.roundButton} ${voiceEnabled ? "" : driving.roundButtonOff}`}
          aria-pressed={voiceEnabled} aria-label={voiceEnabled ? "Désactiver le guidage vocal" : "Activer le guidage vocal"}
          title={voiceEnabled ? "Couper la voix" : "Activer la voix française"}>
          {voiceEnabled ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}
        </button>
        {voiceEnabled && canReplayVoice && (
          <button type="button" onClick={onReplayVoice} className={driving.roundButton}
            aria-label={voiceReplayBusy ? "Répétition vocale en cours" : "Réécouter la dernière instruction confirmée"}
            title="Réécouter la direction">
            <Repeat2 size={21} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onFollow} className={driving.roundButton} aria-label="Recentrer sur ma position"><Crosshair size={22} aria-hidden="true" /></button>
        <button type="button" onClick={onOverview} className={driving.roundButton} aria-label="Afficher le parcours entier"><Navigation2 size={22} aria-hidden="true" /></button>
      </div>

      {speed !== null && (
        <div className={driving.speed} aria-label={`Vitesse GPS ${speed} kilomètres par heure`}>
          <span className={driving.speedNumber}>{speed}</span><span className={driving.speedUnit}>km/h</span>
        </div>
      )}

      {showRecenter && (
        <button type="button" onClick={onFollow} className={driving.recenterPill} aria-label="Recentrer sur ma position">
          <Crosshair size={18} aria-hidden="true" /><span>Recentrer</span>
        </button>
      )}

      <footer className={driving.dock} aria-label="Informations du trajet">
        <div className={driving.eta}>
          <div className={driving.etaMain}>
            <span className={driving.etaTime}>{duration}</span>
            <span className={driving.etaSub}>{remaining} · {arrival}</span>
          </div>
          <span className={driving.etaNote}>{durationLabel ?? "Durée indicative"} · sans trafic en temps réel</span>
        </div>
        <button type="button" className={driving.stopButton} onClick={onStop} aria-label="Arrêter la navigation">
          <X size={20} aria-hidden="true" /><span>Terminer</span>
        </button>
      </footer>
    </section>
  );
}
