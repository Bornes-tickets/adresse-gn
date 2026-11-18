// VIAGO G1-P5-P1: pure, conservative French turn announcement planner.
// No audio for planned, held, ambiguous or unconfirmed road positions.
export type ViagoVoiceProfile = "foot" | "car" | "motorcycle";
export type VoiceManeuver = {
  kind: "turn" | "continue" | "depart" | "arrive" | "roundabout";
  modifier: "left" | "right" | "straight" | "slight_left" | "slight_right" | "sharp_left" | "sharp_right" | "uturn" | null;
};
export type VoiceAnnouncement = { key: string; text: string; stage: "approach" | "near" };
export type VoicePlanInput = {
  enabled: boolean;
  tracking: boolean;
  profile: ViagoVoiceProfile;
  guidanceMode: string;
  gpsSignal: string;
  motionPhase: string;
  accuracyM: number | null;
  distanceM: number | null;
  nextIndex: number;
  maneuver: VoiceManeuver | null;
  routeEpoch: number;
  spoken: ReadonlySet<string>;
};
function actionForVoice(m: VoiceManeuver): string | null {
  if (m.kind === "depart") return null;
  if (m.kind === "arrive") return "vous arrivez à destination";
  if (m.kind === "roundabout") return "abordez le rond-point";
  if (m.modifier === "uturn") return "faites demi-tour";
  if (["left", "slight_left", "sharp_left"].includes(m.modifier ?? "")) return "tournez à gauche";
  if (["right", "slight_right", "sharp_right"].includes(m.modifier ?? "")) return "tournez à droite";
  return "continuez tout droit";
}

export function planViagoVoice(input: VoicePlanInput): VoiceAnnouncement | null {
  if (!input.enabled || !input.tracking || input.guidanceMode !== "live" ||
      input.gpsSignal !== "valid" || input.motionPhase !== "moving" ||
      input.nextIndex < 0 || !Number.isInteger(input.nextIndex) ||
      !Number.isSafeInteger(input.routeEpoch) || !input.maneuver ||
      input.distanceM === null || !Number.isFinite(input.distanceM) || input.distanceM < 0 ||
      input.accuracyM === null || !Number.isFinite(input.accuracyM) || input.accuracyM < 0) return null;

  const foot = input.profile === "foot";
  const motorcycle = input.profile === "motorcycle";
  const maxAccuracy = foot ? 25 : 40;
  if (input.accuracyM > maxAccuracy) return null;
  const earlyM = foot ? 100 : motorcycle ? 300 : 500;
  const nearM = foot ? 30 : motorcycle ? 80 : 130;
  const nearAccuracyM = foot ? 15 : 30;
  const action = actionForVoice(input.maneuver);
  if (!action || input.distanceM > earlyM) return null;
  // Do not announce a turn inside the uncertainty radius of the GPS fix.
  if (input.distanceM <= Math.max(8, input.accuracyM * 0.9)) return null;
  if (input.distanceM <= nearM && input.accuracyM > nearAccuracyM) return null;

  // Don't claim a precise imminent turn within an uncertain GPS radius.
  const stage: "approach" | "near" = input.distanceM <= nearM &&
    input.accuracyM <= nearAccuracyM ? "near" : "approach";
  const key = `${input.routeEpoch}:${input.nextIndex}:${stage}`;
  if (input.spoken.has(key)) return null;
  // G1-P5-P2: after a near announcement, never regress to an early announcement
  // for the same maneuver when GPS distance jitters around the threshold.
  if (stage === "approach" && input.spoken.has(`${input.routeEpoch}:${input.nextIndex}:near`)) return null;
  // At near range with good accuracy, avoid a delayed 'approach' instruction.
  const meters = Math.max(10, Math.round(input.distanceM / 10) * 10);
  const text = input.maneuver.kind === "arrive"
    ? (stage === "near" ? "Vous arrivez à destination." : `Destination dans environ ${meters} mètres.`)
    : `Dans environ ${meters} mètres, ${action}.`;
  return {key,text,stage};
}

// G1-P5-P2: in-app field status. Only reads the same safety inputs as the
// announcement planner. No GPS coordinates, logs, recording or analytics.
export function describeViagoVoice(input: VoicePlanInput): string {
  if (!input.enabled) return "Voix désactivée";
  if (!input.tracking) return "Voix : guidage en attente";
  if (input.guidanceMode !== "live" || input.gpsSignal !== "valid") return "Voix : attente GPS confirmé";
  if (input.motionPhase !== "moving") return "Voix : attente déplacement";
  const maxAccuracy = input.profile === "foot" ? 25 : 40;
  if (input.accuracyM === null || !Number.isFinite(input.accuracyM) ||
      input.accuracyM < 0 || input.accuracyM > maxAccuracy) return "Voix : GPS trop imprécis";
  if (!input.maneuver || input.nextIndex < 0 || !Number.isInteger(input.nextIndex) ||
      !Number.isSafeInteger(input.routeEpoch) || input.maneuver.kind === "depart")
    return "Voix : prochain virage en attente";
  if (input.distanceM === null || !Number.isFinite(input.distanceM) || input.distanceM < 0)
    return "Voix : distance non confirmée";
  const earlyM = input.profile === "foot" ? 100 : input.profile === "motorcycle" ? 300 : 500;
  if (input.distanceM > earlyM) return "Voix : prochain virage en approche";
  if (input.distanceM <= Math.max(8, input.accuracyM * 0.9)) return "Voix : virage trop proche du GPS";
  const nearM = input.profile === "foot" ? 30 : input.profile === "motorcycle" ? 80 : 130;
  const nearAccuracyM = input.profile === "foot" ? 15 : 30;
  if (input.distanceM <= nearM && input.accuracyM > nearAccuracyM) return "Voix : précision insuffisante";
  return planViagoVoice(input) ? "Voix : annonce prête" : "Voix : direction déjà annoncée";
}


// G1-P5-P3: replay the LAST *delivered* automatic direction, not a newly
// synthesized or speculative turn. Caller must use a deliberate user gesture.
export type VoiceReplayRecord = {
  text: string;
  at: number;
  epoch: number;
  nextIndex: number;
};
export type VoiceReplayInput = {
  enabled: boolean;
  tracking: boolean;
  profile: ViagoVoiceProfile;
  guidanceMode: string;
  gpsSignal: string;
  accuracyM: number | null;
  nextIndex: number;
  routeEpoch: number;
  nowMs: number;
  last: VoiceReplayRecord | null;
};
export function selectViagoVoiceReplay(input: VoiceReplayInput): string | null {
  if (!input.enabled || !input.tracking || input.guidanceMode !== "live" ||
      input.gpsSignal !== "valid" || !Number.isSafeInteger(input.routeEpoch) ||
      !Number.isInteger(input.nextIndex) || input.nextIndex < 0 ||
      input.accuracyM === null || !Number.isFinite(input.accuracyM) || input.accuracyM < 0 ||
      input.accuracyM > (input.profile === "foot" ? 25 : 40) ||
      !Number.isFinite(input.nowMs) || !input.last) return null;
  const last = input.last;
  if (last.epoch !== input.routeEpoch || last.nextIndex !== input.nextIndex ||
      !Number.isFinite(last.at) || input.nowMs < last.at ||
      input.nowMs - last.at > 90000 || !last.text.trim() || last.text.length > 280) return null;
  return last.text;
}
