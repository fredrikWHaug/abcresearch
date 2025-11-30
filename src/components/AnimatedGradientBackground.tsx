import { motion } from 'framer-motion'

export function AnimatedGradientBackground() {
  // Multiple gradient blobs with different colors, positions, and animation timings
  const blobs = [
    {
      id: 1,
      colors: ['rgba(147, 197, 253, 0.4)', 'rgba(191, 219, 254, 0.3)'], // Soft blue
      initialX: '10%',
      initialY: '20%',
      duration: 20,
      delay: 0
    },
    {
      id: 2,
      colors: ['rgba(196, 181, 253, 0.4)', 'rgba(221, 214, 254, 0.3)'], // Soft purple
      initialX: '70%',
      initialY: '30%',
      duration: 25,
      delay: 2
    },
    {
      id: 3,
      colors: ['rgba(252, 165, 165, 0.3)', 'rgba(254, 202, 202, 0.2)'], // Soft pink/red
      initialX: '40%',
      initialY: '60%',
      duration: 22,
      delay: 4
    },
    {
      id: 4,
      colors: ['rgba(167, 243, 208, 0.3)', 'rgba(209, 250, 229, 0.2)'], // Soft green
      initialX: '80%',
      initialY: '70%',
      duration: 23,
      delay: 1
    },
    {
      id: 5,
      colors: ['rgba(253, 224, 71, 0.3)', 'rgba(254, 240, 138, 0.2)'], // Soft yellow
      initialX: '20%',
      initialY: '80%',
      duration: 24,
      delay: 3
    },
    {
      id: 6,
      colors: ['rgba(254, 215, 170, 0.3)', 'rgba(254, 235, 200, 0.2)'], // Soft orange
      initialX: '60%',
      initialY: '10%',
      duration: 26,
      delay: 5
    }
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30" />
      
      {/* Animated gradient blobs */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.id}
          className="absolute rounded-full"
          style={{
            width: '40vw',
            height: '40vw',
            background: `radial-gradient(circle, ${blob.colors[0]}, ${blob.colors[1]})`,
            filter: 'blur(80px)',
            left: blob.initialX,
            top: blob.initialY,
          }}
          animate={{
            x: [0, 100, -50, 50, 0],
            y: [0, -80, 100, -60, 0],
            scale: [1, 1.2, 0.9, 1.1, 1],
            opacity: [0.6, 0.8, 0.5, 0.7, 0.6],
          }}
          transition={{
            duration: blob.duration,
            delay: blob.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Additional smaller accent blobs for depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '30vw',
          height: '30vw',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.2), rgba(251, 207, 232, 0.1))',
          filter: 'blur(60px)',
          left: '50%',
          top: '50%',
        }}
        animate={{
          x: [-30, 40, -20, 30, -30],
          y: [20, -40, 30, -20, 20],
          scale: [1, 1.3, 0.8, 1.2, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Shimmer effect overlay for futuristic feel */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Subtle noise texture for depth */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}

