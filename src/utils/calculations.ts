import { ActiveSession, DeviceType, Settings, SessionType } from "../types";

/**
 * Calculates play cost accumulated so far in a session, including active and past segments
 */
export function calculatePlayCost(
  session: ActiveSession,
  settings: Settings,
  currentTimestamp: number = Date.now()
): number {
  let totalCost = 0;

  // 1. Loop through all existing segments and sum their cost
  session.segments.forEach((segment, idx) => {
    let segmentMs = segment.accumulatedMs;

    // If this is the last segment and the session is NOT paused,
    // add the running milliseconds since the last tick to this segment
    if (idx === session.segments.length - 1 && !session.isPaused) {
      const elapsedSinceLastTick = currentTimestamp - session.lastTickTimestamp;
      if (elapsedSinceLastTick > 0) {
        segmentMs += elapsedSinceLastTick;
      }
    }

    const hours = segmentMs / (1000 * 60 * 60);
    const segmentCost = hours * segment.ratePerHour;
    totalCost += segmentCost;
  });

  // Round cost to 2 decimal places or nearest sensible fraction
  return Math.round(totalCost * 100) / 100;
}

/**
 * Calculates total active playtime so far in milliseconds
 */
export function calculateActivePlaytimeMs(
  session: ActiveSession,
  currentTimestamp: number = Date.now()
): number {
  let totalMs = 0;

  session.segments.forEach((segment, idx) => {
    let segmentMs = segment.accumulatedMs;
    if (idx === session.segments.length - 1 && !session.isPaused) {
      const elapsedSinceLastTick = currentTimestamp - session.lastTickTimestamp;
      if (elapsedSinceLastTick > 0) {
        segmentMs += elapsedSinceLastTick;
      }
    }
    totalMs += segmentMs;
  });

  return totalMs;
}

/**
 * Helper to check if a specific "HH:MM" current time is within a start/end range, supporting over-midnight ranges
 */
export function isTimeWithinRange(current: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  if (start <= end) {
    return current >= start && current <= end;
  } else {
    // Over midnight, e.g., 22:00 to 02:00
    return current >= start || current <= end;
  }
}

/**
 * Checks if offers/happy hour is currently active for the given device type based on settings and real-world local time
 */
export function isOfferActive(settings: Settings, deviceType: DeviceType): boolean {
  const now = new Date();
  const currentStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (deviceType === DeviceType.PLAYSTATION) {
    if (!settings.ps4OffersEnabled) return false;
    return isTimeWithinRange(currentStr, settings.ps4OffersStart, settings.ps4OffersEnd);
  } else {
    if (!settings.pcOffersEnabled) return false;
    return isTimeWithinRange(currentStr, settings.pcOffersStart, settings.pcOffersEnd);
  }
}

/**
 * Gets hourly rate based on device type, players count, and settings (accounting for active offers)
 */
export function getHourlyRate(
  deviceType: DeviceType,
  playersCount: number,
  settings: Settings
): number {
  const activeOffer = isOfferActive(settings, deviceType);

  if (deviceType === DeviceType.PLAYSTATION) {
    if (activeOffer) {
      if (playersCount <= 2) return settings.ps4OffersRate1_2 !== undefined ? settings.ps4OffersRate1_2 : settings.ps4Rate1_2;
      if (playersCount === 3) return settings.ps4OffersRate3 !== undefined ? settings.ps4OffersRate3 : settings.ps4Rate3;
      return settings.ps4OffersRate4 !== undefined ? settings.ps4OffersRate4 : settings.ps4Rate4;
    } else {
      if (playersCount <= 2) return settings.ps4Rate1_2;
      if (playersCount === 3) return settings.ps4Rate3;
      return settings.ps4Rate4; // 4 players
    }
  } else {
    // PC
    if (activeOffer) {
      if (playersCount === 1) return settings.pcOffersRate1 !== undefined ? settings.pcOffersRate1 : settings.pcRate1;
      if (playersCount === 2) return settings.pcOffersRate2 !== undefined ? settings.pcOffersRate2 : settings.pcRate2;
      return settings.pcOffersRate3_4 !== undefined ? settings.pcOffersRate3_4 : settings.pcRate3_4;
    } else {
      if (playersCount === 1) return settings.pcRate1;
      if (playersCount === 2) return settings.pcRate2;
      return settings.pcRate3_4; // 3 or 4 players
    }
  }
}

/**
 * Helper to play clean audio tones offline via Web Audio API
 * No static assets required, works 100% offline!
 */
export function playAlertTone(type: string, volume: number = 0.8) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const playBeep = (freq: number, duration: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    switch (type) {
      case "high_pitch": // Alert type 1 (Continuous alarm tone)
        playBeep(880, 0.2, now);
        playBeep(880, 0.2, now + 0.3);
        playBeep(880, 0.4, now + 0.6);
        break;
      case "retro_arcade": // Alert type 2 (Fast gamey tone)
        playBeep(523.25, 0.1, now); // C5
        playBeep(659.25, 0.1, now + 0.15); // E5
        playBeep(783.99, 0.1, now + 0.3); // G5
        playBeep(1046.50, 0.3, now + 0.45); // C6
        break;
      case "soft_chime": // Alert type 3 (Warm and gentle chime)
        playBeep(440, 0.3, now); // A4
        playBeep(554.37, 0.3, now + 0.2); // C#5
        playBeep(659.25, 0.5, now + 0.4); // E5
        break;
      case "double_beep": // Alert type 4 (Standard alarm double beep)
        playBeep(600, 0.15, now);
        playBeep(600, 0.15, now + 0.25);
        break;
      default:
        playBeep(600, 0.3, now);
        break;
    }
  } catch (err) {
    console.error("Failed to play audio alert:", err);
  }
}

/**
 * Format milliseconds into HH:MM:SS
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format currency nicely
 */
export function formatCurrency(amount: number): string {
  // Round to nearest integer for Syrian Pounds and format with thousands separators
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString("en-US")} ل.س`;
}
