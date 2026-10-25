import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { registry } from '@/services/registry';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'active' | 'paused' | 'error';
export type CameraFacingMode = 'user' | 'environment';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorCode: string | null;
  fps: number;
  facingMode: CameraFacingMode;
  startCamera: (preferredFacingMode?: CameraFacingMode) => Promise<boolean>;
  stopCamera: () => void;
  pauseCamera: () => void;
  resumeCamera: () => void;
  switchDevice: (deviceId: string) => Promise<void>;
  switchFacingMode: (mode: CameraFacingMode) => Promise<boolean>;
  toggleFacingMode: () => Promise<boolean>;
}

export function useCamera(defaultFacingMode: CameraFacingMode = 'user'): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>(defaultFacingMode);

  const wakeLockRef = useRef<any>(null);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const rAFRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }
    setStatus('idle');
    setFps(0);
    registry.metrics.updateMetrics({ fps: 0, tracking: 'lost' });
  }, []);

  const measureFpsLoop = useCallback(() => {
    fpsFrameCountRef.current++;
    const now = performance.now();
    const elapsed = now - fpsLastTimeRef.current;

    if (elapsed >= 1000) {
      const calculatedFps = Math.round((fpsFrameCountRef.current * 1000) / elapsed);
      setFps(calculatedFps);
      registry.metrics.updateMetrics({ fps: calculatedFps });
      fpsFrameCountRef.current = 0;
      fpsLastTimeRef.current = now;
    }

    rAFRef.current = requestAnimationFrame(measureFpsLoop);
  }, []);

  const startCamera = useCallback(
    async (preferredFacingMode?: CameraFacingMode): Promise<boolean> => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorCode('CAM-004');
        setStatus('error');
        logger.error('Camera API unavailable or insecure context', 'CAM-004');
        return false;
      }

      const targetFacing = preferredFacingMode || facingMode;
      setStatus('requesting');
      setErrorCode(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 30, max: 30 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setFacingMode(targetFacing);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('ready');
        logger.info(`Camera stream started successfully (${targetFacing})`);

        // Request wake lock if available
        if ('wakeLock' in navigator) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          } catch {
            // ignore
          }
        }

        // Start FPS measurement
        fpsLastTimeRef.current = performance.now();
        fpsFrameCountRef.current = 0;
        rAFRef.current = requestAnimationFrame(measureFpsLoop);

        return true;
      } catch (err: any) {
        let code = 'CAM-099';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          code = 'CAM-001';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          code = 'CAM-002';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          code = 'CAM-003';
        } else if (err.name === 'OverconstrainedError') {
          code = 'CAM-005';
        }

        setErrorCode(code);
        setStatus('error');
        logger.error(`Camera error: ${err.message}`, code, { name: err.name });
        return false;
      }
    },
    [facingMode, measureFpsLoop]
  );

  const switchFacingMode = useCallback(
    async (mode: CameraFacingMode): Promise<boolean> => {
      stopCamera();
      return await startCamera(mode);
    },
    [stopCamera, startCamera]
  );

  const toggleFacingMode = useCallback(async (): Promise<boolean> => {
    const nextMode: CameraFacingMode = facingMode === 'user' ? 'environment' : 'user';
    return await switchFacingMode(nextMode);
  }, [facingMode, switchFacingMode]);

  const pauseCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
      setStatus('paused');
    }
  }, []);

  const resumeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
      setStatus('ready');
    }
  }, []);

  const switchDevice = useCallback(
    async (deviceId: string) => {
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch (err: any) {
        setErrorCode('CAM-003');
        setStatus('error');
      }
    },
    [stopCamera]
  );

  // Tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && status === 'ready') {
        pauseCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status, pauseCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    status,
    errorCode,
    fps,
    facingMode,
    startCamera,
    stopCamera,
    pauseCamera,
    resumeCamera,
    switchDevice,
    switchFacingMode,
    toggleFacingMode,
  };
}
