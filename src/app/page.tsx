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
  createdAt: number
}

// Configuration constants
const HEART_SIZE = 40
const SPAWN_RATE_DESKTOP = 24
const SPAWN_RATE_MOBILE = 100 // Much slower spawn rate on mobile
const HEART_LIFETIME = 4000
const FADE_DURATION = 4000
const VELOCITY_THRESHOLD = 0.1
const BATCH_UPDATE_MS = 16
const MAX_HEARTS_MOBILE = 15 // Limit for mobile devices

export default function Home() {
  const rafRef = useRef<number>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const heartIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  
  const [hearts, setHearts] = useState<Heart[]>([])
  const [isPressed, setIsPressed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Prevent scrolling when interacting with hearts
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.touchAction = 'none';
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const checkCollision = (x: number, y: number) => {
    if (y >= window.innerHeight) {
      return window.innerHeight;
    }
    return null;
  }

  const createHeart = (x: number, y: number) => {
    // Simpler physics for mobile
    const angle = Math.random() * Math.PI * 2
    const speed = isMobile ? 1 : (1 + Math.random() * 2)
    
    return {
      id: heartIdRef.current++,
      x,
      y,
      scale: 0.8 + Math.random() * 0.4,
      rotation: Math.random() * 360,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - (isMobile ? 1 : 2) // Less initial velocity on mobile
      },
      settled: false,
      createdAt: Date.now()
    }
  }

  const spawnHearts = useCallback((x: number, y: number) => {
    const now = performance.now()
    const spawnRate = isMobile ? SPAWN_RATE_MOBILE : SPAWN_RATE_DESKTOP
    
    if (now - lastSpawnRef.current < spawnRate) return
    lastSpawnRef.current = now

    setHearts(prev => {
      // On mobile, limit the number of hearts
      if (isMobile && prev.length >= MAX_HEARTS_MOBILE) {
        // Replace oldest heart with new one
        const newHearts = [...prev]
        newHearts.shift() // Remove oldest heart
        return [...newHearts, createHeart(x, y)]
      }
      return [...prev, createHeart(x, y)]
    })
  }, [isMobile])

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

        if (Math.abs(heart.velocity.x) < VELOCITY_THRESHOLD && 
            Math.abs(heart.velocity.y) < VELOCITY_THRESHOLD) {
          return { ...heart, settled: true }
        }

        const collisionY = checkCollision(nextX, nextY)

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

    // Use more optimized animation approach for mobile
    const timeoutDuration = isMobile ? 32 : BATCH_UPDATE_MS // Lower framerate on mobile
    
    timeoutRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(updatePhysics)
    }, timeoutDuration)
  }, [isMobile])

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isPressed) return
    
    // Prevent default to stop scrolling
    if (e.cancelable) e.preventDefault()
    
    const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    spawnHearts(x, y)
  }, [isPressed, spawnHearts])

  useEffect(() => {
    const handleStart = (e: MouseEvent | TouchEvent) => {
      // Prevent default to stop scrolling
      if (e.cancelable) e.preventDefault()
      
      setIsPressed(true)
      handleMove(e)
    }

    const handleEnd = () => setIsPressed(false)

    // Passive false to allow preventDefault
    document.addEventListener('mousedown', handleStart)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('mouseleave', handleEnd)
    document.addEventListener('touchstart', handleStart, { passive: false })
    document.addEventListener('touchmove', handleMove, { passive: false })
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
                   text-5xl md:text-6xl lg:text-7xl font-medium pointer-events-none z-40
                   text-[#e5e5e5] dark:text-[#333333] text-center w-full px-4"
        style={{
          fontFamily: 'SF Pro Rounded, system-ui, sans-serif'
        }}
      >
        Coming soon
      </h1>

      <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-[100]">
        <a
          href="mailto:contact@eriks.design"
          className="px-6 py-3 md:px-5 md:py-2 rounded-full text-base md:text-sm font-medium
                    bg-[#007AFF] text-white 
                    hover:bg-[#0071F4] hover:scale-105
                    active:bg-[#0058CC] active:scale-95
                    cursor-pointer transition-all duration-200
                    touch-manipulation"
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

          // Smaller, more efficient heart rendering
          const fontSize = isMobile ? "text-2xl" : "text-3xl"

          return (
            <motion.div
              key={heart.id}
              className={`fixed pointer-events-none ${fontSize} z-50`}
              initial={{ 
                transform: `translate3d(${heart.x}px, ${heart.y}px, 0) scale(0) rotate(${heart.rotation}deg)`,
                opacity: 0
              }}
              animate={{ 
                transform: `translate3d(${heart.x}px, ${heart.y}px, 0) scale(${heart.scale}) rotate(${heart.rotation}deg)`,
                opacity
              }}
              transition={{ 
                transform: { type: "tween", duration: isMobile ? 0.2 : 0.1 },
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