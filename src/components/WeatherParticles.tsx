import React, { useEffect, useRef } from 'react';
import { MoodType } from '../types';

interface WeatherParticlesProps {
  mood: MoodType | null;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  alpha: number;
  color: string;
  angle?: number;
  spinSpeed?: number;
  pulseSpeed?: number;
  pulsePhase?: number;
  cloudCircles?: { offsetX: number; offsetY: number; radius: number }[];
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface LightningBolt {
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  alpha: number;
  width: number;
}

export default function WeatherParticles({ mood }: WeatherParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moodRef = useRef<MoodType | null>(mood);

  // Sync ref with current mood to avoid re-initializing the whole loop
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle arrays
    let particles: Particle[] = [];
    let ripples: Ripple[] = [];
    let lightning: LightningBolt | null = null;
    let flashOpacity = 0;
    let nextLightningFrames = Math.floor(Math.random() * 150) + 120; // 2-4 seconds at 60fps

    // Sunbeams state (for 'sun' mode)
    let sunbeamAngle = 0;

    // Helper to initialize particles based on mood
    const initParticles = (currentMood: MoodType | null) => {
      particles = [];
      ripples = [];
      lightning = null;
      flashOpacity = 0;

      if (currentMood === 'sun') {
        // Sparkly golden particles
        const count = 50;
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 4 + 2,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: Math.random() * 0.8 + 0.4, // float down gently
            alpha: Math.random() * 0.6 + 0.2,
            color: `rgba(${240 + Math.floor(Math.random() * 15)}, ${180 + Math.floor(Math.random() * 60)}, ${50 + Math.floor(Math.random() * 50)}, `,
            pulseSpeed: Math.random() * 0.02 + 0.01,
            pulsePhase: Math.random() * Math.PI * 2,
          });
        }
      } else if (currentMood === 'cloud') {
        // Slow fluffy drifting cloud blocks
        const count = 12;
        for (let i = 0; i < count; i++) {
          // Generate a cluster of overlapping circles to represent a soft cloud
          const circleCount = Math.floor(Math.random() * 3) + 4;
          const cloudCircles = [];
          for (let j = 0; j < circleCount; j++) {
            cloudCircles.push({
              offsetX: (Math.random() - 0.5) * 70,
              offsetY: (Math.random() - 0.5) * 35,
              radius: Math.random() * 30 + 30,
            });
          }

          particles.push({
            x: Math.random() * (width + 200) - 100,
            y: Math.random() * (height * 0.6), // mostly in upper screen
            size: Math.random() * 60 + 50,
            speedX: -(Math.random() * 0.15 + 0.05), // drift left slowly
            speedY: (Math.random() - 0.5) * 0.02,
            alpha: Math.random() * 0.15 + 0.05,
            color: 'rgba(255, 255, 255, ',
            cloudCircles,
          });
        }
      } else if (currentMood === 'rain') {
        // Falling rain streaks
        const count = 100;
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height - height, // start off-screen
            size: Math.random() * 1.5 + 1, // stroke width
            speedX: -2 - Math.random() * 1.5, // slant to the left slightly
            speedY: Math.random() * 8 + 12, // fast fall
            alpha: Math.random() * 0.4 + 0.15,
            color: 'rgba(147, 197, 253, ', // light blue / indigo
            angle: Math.random() * 15 + 5, // line height / length
          });
        }
      } else if (currentMood === 'storm') {
        // Intense rain
        const count = 150;
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: Math.random() * 2 + 1,
            speedX: -4 - Math.random() * 3, // heavier slant / wind
            speedY: Math.random() * 12 + 18, // extremely fast fall
            alpha: Math.random() * 0.5 + 0.2,
            color: 'rgba(129, 140, 248, ', // indigo / slate blue
            angle: Math.random() * 25 + 10, // longer rain lines
          });
        }
      } else {
        // Default/Null mode: Slow drifting ambient cosmic sparkles
        const count = 25;
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5) * 0.2,
            speedY: (Math.random() - 0.5) * 0.2,
            alpha: Math.random() * 0.4 + 0.1,
            color: 'rgba(255, 255, 255, ',
            pulseSpeed: Math.random() * 0.01 + 0.005,
            pulsePhase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    // Initialize once
    initParticles(moodRef.current);

    // Watch for size changes
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles(moodRef.current);
    };
    window.addEventListener('resize', handleResize);

    // Tracking active mood to re-init if it changes
    let activeMood = moodRef.current;

    // Generate lightning bolt path
    const generateLightning = (startX: number): LightningBolt => {
      const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
      let curX = startX;
      let curY = 0;
      const targetY = height;
      const branchChance = 0.2;

      const makeBolt = (x1: number, y1: number, tY: number, depth: number) => {
        let x = x1;
        let y = y1;
        while (y < tY) {
          const nextY = y + Math.floor(Math.random() * 30) + 20;
          const nextX = x + (Math.random() - 0.5) * 45;
          segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });

          if (depth < 2 && Math.random() < branchChance) {
            // Secondary branching bolt
            makeBolt(nextX, nextY, y + (tY - y) * 0.5, depth + 1);
          }

          x = nextX;
          y = nextY;
        }
      };

      makeBolt(curX, curY, targetY, 0);

      return {
        segments,
        alpha: 1.0,
        width: Math.random() * 2 + 2,
      };
    };

    // Render loop
    const tick = () => {
      // If mood changed during loop, reinitialize
      if (moodRef.current !== activeMood) {
        activeMood = moodRef.current;
        initParticles(activeMood);
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw atmospheric background overlays depending on mood
      if (activeMood === 'sun') {
        const grad = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 3, width * 0.6);
        grad.addColorStop(0, 'rgba(253, 224, 71, 0.12)'); // warm gold
        grad.addColorStop(0.5, 'rgba(251, 146, 60, 0.04)'); // orange tint
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Draw rotating sunbeams from top center
        sunbeamAngle += 0.0012;
        ctx.save();
        ctx.translate(width / 2, -100);
        ctx.rotate(sunbeamAngle);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.015)';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, width * 1.2, (i * Math.PI) / 4 - 0.15, (i * Math.PI) / 4 + 0.15);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (activeMood === 'cloud') {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(203, 213, 225, 0.08)');
        grad.addColorStop(1, 'rgba(148, 163, 184, 0.02)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (activeMood === 'rain') {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(30, 41, 59, 0.12)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (activeMood === 'storm') {
        // Dark sky with decaying thunder flash color
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.25)');
        grad.addColorStop(1, 'rgba(2, 6, 23, 0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Apply lightning flash color overlay
        if (flashOpacity > 0) {
          ctx.fillStyle = `rgba(224, 242, 254, ${flashOpacity * 0.45})`;
          ctx.fillRect(0, 0, width, height);
          flashOpacity *= 0.88; // decay flash
        }
      }

      // 2. Draw Lightning Bolt if active
      if (activeMood === 'storm') {
        nextLightningFrames--;
        if (nextLightningFrames <= 0) {
          // Trigger a strike!
          flashOpacity = 1.0;
          lightning = generateLightning(Math.random() * (width - 200) + 100);
          nextLightningFrames = Math.floor(Math.random() * 200) + 150; // reset
        }

        if (lightning) {
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${lightning.alpha})`;
          ctx.lineWidth = lightning.width;
          ctx.shadowBlur = 25;
          ctx.shadowColor = 'rgba(165, 180, 252, 0.9)'; // soft indigo glow
          
          ctx.beginPath();
          lightning.segments.forEach(seg => {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          });
          ctx.stroke();
          ctx.restore();

          // Decay lightning bolt alpha
          lightning.alpha *= 0.75;
          if (lightning.alpha < 0.05) {
            lightning = null;
          }
        }
      }

      // 3. Update & Draw Particles
      particles.forEach(p => {
        // Update positions
        p.x += p.speedX;
        p.y += p.speedY;

        // Reset if they drift off boundaries
        if (activeMood === 'sun') {
          // float down, wrap horizontally
          if (p.y > height + 20) {
            p.y = -10;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 10;
          if (p.x > width + 20) p.x = -10;

          // Pulsing alpha for shimmering sunbeams
          if (p.pulsePhase !== undefined && p.pulseSpeed !== undefined) {
            p.pulsePhase += p.pulseSpeed;
            const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.15;
            ctx.fillStyle = `${p.color}${Math.max(0.05, Math.min(1, currentAlpha))})`;
          } else {
            ctx.fillStyle = `${p.color}${p.alpha})`;
          }

          // Draw sun star or sparkling circle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (activeMood === 'cloud') {
          // drift left
          if (p.x < -150) {
            p.x = width + 150;
            p.y = Math.random() * (height * 0.55);
          }

          // Draw the compound cloud shapes
          ctx.save();
          ctx.fillStyle = `${p.color}${p.alpha})`;
          if (p.cloudCircles) {
            p.cloudCircles.forEach(c => {
              ctx.beginPath();
              ctx.arc(p.x + c.offsetX, p.y + c.offsetY, c.radius, 0, Math.PI * 2);
              ctx.fill();
            });
          }
          ctx.restore();
        } 
        else if (activeMood === 'rain' || activeMood === 'storm') {
          // fast vertical fall, wrap when off bottom
          if (p.y > height + 40 || p.x < -40) {
            p.y = -50 - Math.random() * 50;
            p.x = Math.random() * (width + 100);
            
            // Randomly trigger a ripple near the bottom half of the screen
            if (Math.random() < 0.28) {
              ripples.push({
                x: Math.random() * width,
                y: height - Math.random() * (height * 0.3), // in the lower 30% of screen
                radius: 1,
                maxRadius: Math.random() * 18 + 8,
                alpha: Math.random() * 0.5 + 0.1,
                color: activeMood === 'storm' ? 'rgba(129, 140, 248, ' : 'rgba(147, 197, 253, ',
              });
            }
          }

          // Draw diagonal rain line
          ctx.strokeStyle = `${p.color}${p.alpha})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          // Angle maps to line length in dx, dy
          const length = p.angle || 15;
          ctx.lineTo(p.x + p.speedX * (length / 10), p.y + p.speedY * (length / 10));
          ctx.stroke();
        } 
        else {
          // Default: ambient space particles drifting slowly
          if (p.y > height + 20 || p.y < -20) p.speedY *= -1;
          if (p.x > width + 20 || p.x < -20) p.speedX *= -1;

          if (p.pulsePhase !== undefined && p.pulseSpeed !== undefined) {
            p.pulsePhase += p.pulseSpeed;
            const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.08;
            ctx.fillStyle = `${p.color}${Math.max(0.05, Math.min(1, currentAlpha))})`;
          } else {
            ctx.fillStyle = `${p.color}${p.alpha})`;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 4. Update & Draw Ripples (on-surface splash effects for rain/storm)
      ripples.forEach((rip, idx) => {
        rip.radius += 0.45;
        rip.alpha *= 0.93; // fade out

        ctx.strokeStyle = `${rip.color}${rip.alpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        // Draw slightly flattened oval for horizontal puddle surface illusion
        ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Filter out faded-out ripples
      ripples = ripples.filter(rip => rip.alpha > 0.05 && rip.radius < rip.maxRadius);

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
