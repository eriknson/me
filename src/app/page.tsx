'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Heart {
  id: number
  x: number
  y: number
  scale: number
  rotation: number
  velocity: { x: number; y: number }
  settled: boolean
  createdAt: number // Add timestamp for fading
}

const HEART_SIZE = 40
const SPAWN_RATE = 24
const COLLISION_RADIUS = HEART_SIZE * 0.6
const HEART_LIFETIME = 4000 // Shorter lifetime before fade starts
const FADE_DURATION = 4000 // Longer fade duration for subtler effect
const VELOCITY_THRESHOLD = 0.1 // Threshold to consider heart settled
const BATCH_UPDATE_MS = 16 // Roughly 60fps

export default function Home() {
  // Move refs inside component
  const rafRef = useRef<number>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const heartIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  
  const [hearts, setHearts] = useState<Heart[]>([])
  const [isPressed, setIsPressed] = useState(false)

  const checkCollision = (x: number, y: number, settled: Heart[]) => {
    // Only check bottom of screen, no heart-to-heart collisions
    if (y >= window.innerHeight) {
      return window.innerHeight;
    }
    return null;
  }

  const createHeart = (x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 2 // Slightly reduced initial speed
    
    return {
      id: heartIdRef.current++,
      x,
      y,
      scale: 0.8 + Math.random() * 0.4,
      rotation: Math.random() * 360,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - 2
      },
      settled: false,
      createdAt: Date.now()
    }
  }

  const spawnHearts = useCallback((x: number, y: number) => {
    const now = performance.now()
    if (now - lastSpawnRef.current < SPAWN_RATE) return
    lastSpawnRef.current = now

    setHearts(prev => [...prev, createHeart(x, y)]) // Remove max hearts check
  }, [])

  const updatePhysics = useCallback(() => {
    const now = Date.now()
    
    setHearts(prev => {
      const filtered = prev.filter(heart => 
        now - heart.createdAt <= HEART_LIFETIME + FADE_DURATION
      )
      
      const settled = filtered.filter(h => h.settled)
      let updated = filtered.length !== prev.length

      const nextHearts = filtered.map(heart => {
        if (heart.settled) return heart

        const nextY = heart.y + heart.velocity.y
        const nextX = heart.x + heart.velocity.x

        // Check if velocity is below threshold
        if (Math.abs(heart.velocity.x) < VELOCITY_THRESHOLD && 
            Math.abs(heart.velocity.y) < VELOCITY_THRESHOLD) {
          return { ...heart, settled: true }
        }

        const collisionY = checkCollision(nextX, nextY, settled)

        if (collisionY !== null) {
          return {
            ...heart,
            x: nextX,
            y: collisionY,
            velocity: { x: 0, y: 0 },
            settled: true
          }
        }

        let newVelocityX = heart.velocity.x
        if (nextX < 0 || nextX > window.innerWidth - HEART_SIZE) {
          newVelocityX = -heart.velocity.x * 0.3
        }

        updated = true
        return {
          ...heart,
          x: nextX < 0 ? 0 : nextX > window.innerWidth - HEART_SIZE ? window.innerWidth - HEART_SIZE : nextX,
          y: nextY,
          velocity: {
            x: newVelocityX * 0.98,
            y: heart.velocity.y + 0.4
          }
        }
      })

      return updated ? nextHearts : filtered
    })

    timeoutRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(updatePhysics)
    }, BATCH_UPDATE_MS)
  }, [])

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isPressed) return
    const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    spawnHearts(x, y)
  }, [isPressed, spawnHearts])

  useEffect(() => {
    const handleStart = (e: MouseEvent | TouchEvent) => {
      setIsPressed(true)
      handleMove(e)
    }

    const handleEnd = () => setIsPressed(false)

    document.addEventListener('mousedown', handleStart)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('mouseleave', handleEnd)
    document.addEventListener('touchstart', handleStart)
    document.addEventListener('touchmove', handleMove, { passive: true })
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousedown', handleStart)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('mouseleave', handleEnd)
      document.removeEventListener('touchstart', handleStart)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [handleMove])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updatePhysics)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [updatePhysics])

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#F8F8FA] dark:bg-[#111111]">
      <h1
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   text-4xl md:text-6xl font-medium pointer-events-none z-40
                   text-[#e5e5e5] dark:text-[#333333]"
        style={{
          fontFamily: 'SF Pro Rounded, system-ui, sans-serif'
        }}
      >
        Coming soon
      </h1>

      {/* Completely rebuilt contact button with simpler styling */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center z-[100]">
        <a
          href="mailto:contact@eriks.design"
          className="px-5 py-2 rounded-full text-sm font-medium
                    bg-[#007AFF] text-white 
                    hover:bg-[#0071F4] hover:scale-105
                    active:bg-[#0058CC] active:scale-95
                    cursor-pointer transition-all duration-200"
          style={{ fontFamily: 'SF Pro Rounded, system-ui, sans-serif' }}
        >
          Contact
        </a>
      </div>

      <AnimatePresence>
        {hearts.map(heart => {
          const age = Date.now() - heart.createdAt
          const opacity = age > HEART_LIFETIME ? 
            Math.max(0, 1 - (age - HEART_LIFETIME) / FADE_DURATION) : 1

          return (
            <motion.div
              key={heart.id}
              className="fixed pointer-events-none text-3xl z-50"
              initial={{ 
                transform: `translate3d(${heart.x}px, ${heart.y}px, 0) scale(0) rotate(${heart.rotation}deg)`,
                opacity: 0
              }}
              animate={{ 
                transform: `translate3d(${heart.x}px, ${heart.y}px, 0) scale(${heart.scale}) rotate(${heart.rotation}deg)`,
                opacity
              }}
              transition={{ 
                transform: { type: "tween", duration: 0.1 },
                opacity: { duration: 0.3 }
              }}
            >
              ❤️
            </motion.div>
          )
        })}
      </AnimatePresence>
    </main>
  )
} 