import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

interface ConfettiPiece {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle' | 'triangle';
  wobble: number;
  wobbleSpeed: number;
}

const COLORS = [
  '#f59e0b', // gold/yellow
  '#3b82f6', // blue
  '#10b981', // green
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
];

export default function Confetti({ active, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<boolean>(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let animationFrameId: number;
    const pieces: ConfettiPiece[] = [];
    const pieceCount = 120;

    // Create initial pieces bursting from the bottom/middle or falling from the top
    for (let i = 0; i < pieceCount; i++) {
      const isBurst = Math.random() < 0.4;
      pieces.push({
        // Bursting from center/bottom, or falling from top
        x: isBurst ? width / 2 + (Math.random() - 0.5) * 100 : Math.random() * width,
        y: isBurst ? height * 0.8 : -20 - Math.random() * 200,
        size: Math.random() * 8 + 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        speedX: isBurst ? (Math.random() - 0.5) * 12 : (Math.random() - 0.5) * 4,
        speedY: isBurst ? -Math.random() * 15 - 10 : Math.random() * 4 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        shape: ['rect', 'circle', 'triangle'][Math.floor(Math.random() * 3)] as any,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.05 + 0.02,
      });
    }

    const startTime = Date.now();
    const duration = 1500; // 1.5 seconds duration
    let opacity = 1.0;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      
      // Calculate fading factor after 1.1s
      if (elapsed > 1100) {
        opacity = Math.max(0, 1 - (elapsed - 1100) / 400);
      }

      if (elapsed >= duration || opacity <= 0) {
        if (onComplete) onComplete();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw and update each piece
      pieces.forEach(p => {
        // Gravity and drag
        p.speedY += 0.22; // gravity
        p.speedX *= 0.98; // horizontal drag
        p.speedY *= 0.98; // vertical drag

        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        // Sway back and forth
        const sway = Math.sin(p.wobble) * 1.5;

        ctx.save();
        ctx.translate(p.x + sway, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Triangle
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[100]"
    />
  );
}
