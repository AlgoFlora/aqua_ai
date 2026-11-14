import React from 'react';

interface WaterRingProps {
  level: number;      // 0-100
  size?: number;
  color?: string;
}

export default function WaterRing({ level, size = 180, color = '#0891b2' }: WaterRingProps) {
  const R = (size / 2) - 14;
  const circumference = 2 * Math.PI * R;
  const progress = Math.min(100, Math.max(0, level));
  const dash = (progress / 100) * circumference;

  const bgColor    = level <= 15 ? '#fee2e2' : level <= 30 ? '#fef3c7' : '#e0f2fe';
  const trackColor = level <= 15 ? '#fecaca' : level <= 30 ? '#fde68a' : '#bae6fd';
  const fillColor  = level <= 15 ? '#ef4444' : level <= 30 ? '#f59e0b' : color;

  return (
    <div className="water-ring-container">
      <div className="water-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background */}
          <circle cx={size/2} cy={size/2} r={R} fill={bgColor} stroke="none"
            style={{ transition: 'fill 0.6s ease' }} />
          {/* Track */}
          <circle
            cx={size/2} cy={size/2} r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={10}
            style={{ transition: 'stroke 0.6s ease' }}
          />
          {/* Progress arc — driven directly by Arduino level */}
          <circle
            cx={size/2} cy={size/2} r={R}
            fill="none"
            stroke={fillColor}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.6s ease' }}
          />
        </svg>
        {/* Center Text */}
        <div className="water-ring-center">
          <div className="water-ring-percent" style={{ color: fillColor, transition: 'color 0.5s ease' }}>
            {progress.toFixed(0)}%
          </div>
          <div className="water-ring-label">Water Level</div>
        </div>
      </div>
    </div>
  );
}
