import React from 'react';
import { Camera, Radio, Loader, CheckCircle, AlertTriangle, AlertOctagon, CameraOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type RecognitionState =
  | 'permission_needed'
  | 'camera_ready'
  | 'recognizing'
  | 'capturing'
  | 'processing'
  | 'recognized'
  | 'low_confidence'
  | 'error';

export interface RecognitionStatusProps {
  state: RecognitionState;
  errorMessage?: string;
  className?: string;
}

export const RecognitionStatus: React.FC<RecognitionStatusProps> = ({
  state,
  errorMessage,
  className = '',
}) => {
  const { t } = useTranslation();

  const config = {
    permission_needed: {
      icon: <CameraOff className="w-4 h-4 text-app-warning" />,
      title: t('rec.permission', "L'accès à la caméra est nécessaire"),
      subtitle: t('rec.permissionSub', 'Autorisez la caméra pour commencer la reconnaissance LSA'),
      badgeColor: 'text-app-warning',
    },
    camera_ready: {
      icon: <Camera className="w-4 h-4 text-app-primary-strong" />,
      title: t('rec.ready', 'Caméra prête'),
      subtitle: t('rec.readySub', 'Placez vos mains dans le cadre, bon éclairage'),
      badgeColor: 'text-app-primary-strong',
    },
    recognizing: {
      icon: <Radio className="w-4 h-4 text-app-primary-strong animate-pulse" />,
      title: t('rec.recognizing', 'Reconnaissance en cours…'),
      subtitle: 'Gardez vos mains visibles',
      badgeColor: 'text-app-primary-strong font-semibold',
    },
    capturing: {
      icon: <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />,
      title: t('rec.capturing', 'Mains détectées · Capture…'),
      subtitle: 'Signez votre phrase LSA',
      badgeColor: 'text-emerald-700 font-semibold',
    },
    processing: {
      icon: <Loader className="w-4 h-4 text-app-primary-strong animate-spin" />,
      title: t('rec.processing', 'Interprétation…'),
      subtitle: 'Analyse de la séquence de signes',
      badgeColor: 'text-app-primary-strong',
    },
    recognized: {
      icon: <CheckCircle className="w-4 h-4 text-app-success" />,
      title: t('rec.recognized', 'Message reconnu'),
      subtitle: 'Vérifiez la proposition ci-dessous',
      badgeColor: 'text-app-success font-semibold',
    },
    low_confidence: {
      icon: <AlertTriangle className="w-4 h-4 text-app-warning" />,
      title: t('rec.low', "Nous n'avons pas pu reconnaître cette séquence avec certitude."),
      subtitle: 'Veuillez répéter le signe avec les mains bien visibles',
      badgeColor: 'text-app-warning font-semibold',
    },
    error: {
      icon: <AlertOctagon className="w-4 h-4 text-app-error" />,
      title: 'Erreur de reconnaissance',
      subtitle: errorMessage || 'Une erreur est survenue lors de l’analyse',
      badgeColor: 'text-app-error font-semibold',
    },
  }[state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2.5 px-3 py-2 rounded-control bg-app-surface-2 border border-app-border text-xs ${className}`}
    >
      <div className="shrink-0">{config.icon}</div>
      <div className="flex flex-col min-w-0">
        <span className={`font-semibold ${config.badgeColor} truncate`}>{config.title}</span>
        <span className="text-[11px] text-app-muted truncate">{config.subtitle}</span>
      </div>
    </div>
  );
};
