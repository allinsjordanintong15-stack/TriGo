import { useEffect, useRef, useState } from 'react';

import type { DocumentImage } from '../drivers/driverApplications';

const ZOOM_LEVELS = [1, 1.5, 2, 3, 4];

type DocumentViewerProps = {
  title: string;
  image: DocumentImage;
  onClose: () => void;
};

/**
 * Full-size view of a driver application document photo (a blob: URL made from its bytes):
 * zoom in and out (fit = 100%) and rotate in 90° steps. Esc closes; + / − zoom; R rotates.
 */
export function DocumentViewer({ title, image, onClose }: DocumentViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [stage, setStage] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function measure() {
      const element = stageRef.current;
      if (element) setStage({ width: element.clientWidth, height: element.clientHeight });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === '+' || event.key === '=') setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
      else if (event.key === '-') setZoomIndex((i) => Math.max(i - 1, 0));
      else if (event.key === 'r' || event.key === 'R') setRotation((r) => (r + 90) % 360);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const zoom = ZOOM_LEVELS[zoomIndex];
  const naturalWidth = image.width || 1000;
  const naturalHeight = image.height || 1000;
  const sideways = rotation % 180 !== 0;
  const boxWidth = sideways ? naturalHeight : naturalWidth;
  const boxHeight = sideways ? naturalWidth : naturalHeight;
  // 100% = the whole photo fits the stage (never enlarged beyond its own pixels at 100%).
  const fit = Math.min((stage.width - 16) / boxWidth, (stage.height - 16) / boxHeight, 1);
  const scale = Math.max(fit, 0.05) * zoom;

  return (
    <div className="dialog-backdrop doc-viewer-backdrop" onClick={onClose}>
      <div
        className="doc-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="doc-viewer-toolbar">
          <h2 className="doc-viewer-title">{title}</h2>
          <div className="doc-viewer-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setZoomIndex((i) => Math.max(i - 1, 0))}
              disabled={zoomIndex === 0}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="doc-viewer-zoom" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              aria-label="Zoom in"
            >
              +
            </button>
            <button type="button" className="btn-outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
              Rotate 90°
            </button>
            <button type="button" className="btn-primary" onClick={onClose} autoFocus>
              Close
            </button>
          </div>
        </div>
        <div className="doc-viewer-stage" ref={stageRef}>
          <div className="doc-viewer-box" style={{ width: boxWidth * scale, height: boxHeight * scale }}>
            <img
              src={image.url}
              alt={title}
              style={{
                width: naturalWidth * scale,
                height: naturalHeight * scale,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
