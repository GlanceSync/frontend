import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Radius in metres the device is confident about. */
  accuracy: number;
}

export type GeoErrorReason = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  constructor(readonly reason: GeoErrorReason) {
    super(GeoError.messages[reason]);
  }

  private static readonly messages: Record<GeoErrorReason, string> = {
    unsupported: 'Location is not available in this browser.',
    denied: 'Location access is turned off for GlanceSync.',
    unavailable: 'Your position could not be determined.',
    timeout: 'Finding your position took too long.'
  };
}

/**
 * The browser's own GPS. A single reading is often a coarse Wi-Fi or IP guess, so this
 * keeps listening for a few seconds after the first fix and returns the most accurate
 * one, stopping early once one is good enough.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  locate({ goodEnoughMeters = 30, settleMs = 4_000, maxWaitMs = 15_000 } = {}): Promise<GeoFix> {
    if (!this.isBrowser || !navigator.geolocation) {
      return Promise.reject(new GeoError('unsupported'));
    }

    return new Promise<GeoFix>((resolve, reject) => {
      let best: GeoFix | null = null;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (error?: GeoError) => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(settleTimer);
        clearTimeout(giveUpTimer);
        if (best) {
          resolve(best);
        } else {
          reject(error ?? new GeoError('timeout'));
        }
      };

      const watchId = navigator.geolocation.watchPosition(
        position => {
          const fix: GeoFix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          if (!best || fix.accuracy < best.accuracy) best = fix;
          if (best.accuracy <= goodEnoughMeters) {
            finish();
          } else {
            // Once there is something to show, wait only a little longer for a sharper fix.
            settleTimer ??= setTimeout(() => finish(), settleMs);
          }
        },
        error => {
          // A later reading can still arrive after a timeout, but not after a refusal.
          if (error.code === error.TIMEOUT) return;
          finish(new GeoError(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
      );

      const giveUpTimer = setTimeout(() => finish(), maxWaitMs);
    });
  }

  /** Straight-line distance in metres, for deciding whether someone has really moved. */
  static distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
  }
}
