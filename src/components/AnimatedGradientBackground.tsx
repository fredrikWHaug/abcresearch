import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

export function AnimatedGradientBackground() {
  // Respect user's reduced motion preference for accessibility
  const shouldReduceMotion = useReducedMotion()

  // Use SOLID colors with extreme blur - no gradients = no banding
  // The blur creates the gradient effect naturally
  const blobs = useMemo(() => [
    {
      id: 1,
      color: '#93C5FD', // Blue
      size: '50vw',
      initialX: '5%',
      initialY: '10%',
      duration: 20,
      delay: 0,
      blur: 150,
    },
    {
      id: 2,
      color: '#C4B5FD', // Purple
      size: '45vw',
      initialX: '60%',
      initialY: '20%',
      duration: 25,
      delay: 2,
      blur: 140,
    },
    {
      id: 3,
      color: '#FCA5A5', // Pink/Red
      size: '40vw',
      initialX: '30%',
      initialY: '55%',
      duration: 22,
      delay: 4,
      blur: 130,
    },
    {
      id: 4,
      color: '#A7F3D0', // Green
      size: '42vw',
      initialX: '75%',
      initialY: '65%',
      duration: 23,
      delay: 1,
      blur: 135,
    },
    {
      id: 5,
      color: '#FDE047', // Yellow
      size: '38vw',
      initialX: '15%',
      initialY: '75%',
      duration: 24,
      delay: 3,
      blur: 125,
    },
    {
      id: 6,
      color: '#FDBA74', // Orange
      size: '44vw',
      initialX: '55%',
      initialY: '5%',
      duration: 26,
      delay: 5,
      blur: 145,
    }
  ], [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Soft white/cream base */}
      <div className="absolute inset-0 bg-slate-50" />
      
      {/* Animated solid color blobs - blur creates smooth "gradients" */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.id}
          className="absolute rounded-full will-change-transform"
          style={{
            width: blob.size,
            height: blob.size,
            backgroundColor: blob.color,
            opacity: 0.35,
            filter: `blur(${blob.blur}px)`,
            left: blob.initialX,
            top: blob.initialY,
            transform: 'translate3d(0, 0, 0)', // Force GPU layer
          }}
          animate={shouldReduceMotion ? {} : {
            x: [0, 80, -40, 60, 0],
            y: [0, -60, 80, -40, 0],
            scale: [1, 1.15, 0.95, 1.1, 1],
          }}
          transition={{
            duration: blob.duration,
            delay: blob.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            type: 'tween',
          }}
        />
      ))}

      {/* Central accent blob */}
      <motion.div
        className="absolute rounded-full will-change-transform"
        style={{
          width: '35vw',
          height: '35vw',
          backgroundColor: '#F9A8D4', // Pink
          opacity: 0.25,
          filter: 'blur(120px)',
          left: '45%',
          top: '45%',
          transform: 'translate3d(0, 0, 0)',
        }}
        animate={shouldReduceMotion ? {} : {
          x: [-20, 30, -15, 25, -20],
          y: [15, -30, 25, -15, 15],
          scale: [1, 1.2, 0.9, 1.15, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
          type: 'tween',
        }}
      />

      {/* Subtle shimmer overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(45deg, transparent 40%, rgba(255, 255, 255, 0.15) 50%, transparent 60%)',
          backgroundSize: '200% 200%',
        }}
        animate={shouldReduceMotion ? {} : {
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Film grain texture for subtle texture (helps break up any remaining banding from blur) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.04,
          mixBlendMode: 'multiply',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
