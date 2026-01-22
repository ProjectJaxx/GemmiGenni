
import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  value: number;
  onChange: (val: number) => void;
  label?: string;
}

export const RotationKnob: React.FC<KnobProps> = ({ value, onChange, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !knobRef.current) return;
      const rect = knobRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      let degrees = (angle * 180) / Math.PI + 90;
      if (degrees < 0) degrees += 360;
      onChange(Math.round(degrees));
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] uppercase text-gray-500">{label}</span>}
      <div 
        ref={knobRef}
        className="knob-container cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="45" fill="#1e1e1e" stroke="#333" strokeWidth="2" />
          <g className="knob" style={{ transform: `rotate(${value}deg)` }}>
            <line x1="50" y1="50" x2="50" y2="10" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="50" r="5" fill="#3b82f6" />
          </g>
        </svg>
      </div>
      <span className="text-xs font-mono">{value}°</span>
    </div>
  );
};

export const PropertyGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-b border-gray-800 p-4">
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);
