'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Simple Heart interface for mobile (no physics)
interface SimpleHeart {
  id: number
  x: number
  y: number
  createdAt: number
}

// Complex Heart interface for desktop
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
const HEART_LIFETIME = 2000
const FADE_DURATION = 600
const SPAWN_RATE_DESKTOP = 24
const SPAWN_RATE_MOBILE = 50
const MAX_HEARTS_MOBILE = 20

export default function Home() {
  const rafRef = useRef<number>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const heartIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  
  const [hearts, setHearts] = useState<Heart[]>([])
  const [simpleHearts, setSimpleHearts] = useState<SimpleHeart[]>([])
  const [isPressed, setIsPressed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      
      // Adjust viewport height for mobile browsers
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Desktop physics-based heart animation
  const createHeart = (x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 2
    
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

  // Mobile simple heart - no physics
  const createSimpleHeart = (x: number, y: number): SimpleHeart => {
    return {
      id: heartIdRef.current++,
      x,
      y,
      createdAt: Date.now()
    }
  }

  // Spawn hearts based on device type
  const spawnHearts = useCallback((x: number, y: number) => {
    const now = performance.now()
    const spawnRate = isMobile ? SPAWN_RATE_MOBILE : SPAWN_RATE_DESKTOP
    
    if (now - lastSpawnRef.current < spawnRate) return
    lastSpawnRef.current = now

    if (isMobile) {
      // Mobile: simple hearts with pre-defined CSS animations
      setSimpleHearts(prev => {
        if (prev.length >= MAX_HEARTS_MOBILE) {
          const newHearts = [...prev]
          newHearts.shift() // Remove oldest heart
          return [...newHearts, createSimpleHeart(x, y)]
        }
        return [...prev, createSimpleHeart(x, y)]
      })
    } else {
      // Desktop: physics-based hearts
      setHearts(prev => [...prev, createHeart(x, y)])
    }
  }, [isMobile])

  // Physics update for desktop only
  const updatePhysics = useCallback(() => {
    if (isMobile) {
      // Clean up old simple hearts on mobile
      const now = Date.now()
      setSimpleHearts(prev => 
        prev.filter(heart => now - heart.createdAt <= HEART_LIFETIME + FADE_DURATION)
      )
      
      rafRef.current = requestAnimationFrame(updatePhysics)
      return
    }
    
    // Desktop physics simulation
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

        if (Math.abs(heart.velocity.x) < 0.1 && Math.abs(heart.velocity.y) < 0.1) {
          return { ...heart, settled: true }
        }

        // Check bottom collision
        if (nextY >= window.innerHeight) {
          return {
            ...heart,
            x: nextX,
            y: window.innerHeight,
            velocity: { x: 0, y: 0 },
            settled: true
          }
        }

        // Bounce off walls
        let newVelocityX = heart.velocity.x
        if (nextX < 0 || nextX > window.innerWidth - 40) {
          newVelocityX = -heart.velocity.x * 0.3
        }

        updated = true
        return {
          ...heart,
          x: nextX < 0 ? 0 : nextX > window.innerWidth - 40 ? window.innerWidth - 40 : nextX,
          y: nextY,
          velocity: {
            x: newVelocityX * 0.98,
            y: heart.velocity.y + 0.4
          }
        }
      })

      return updated ? nextHearts : filtered
    })
    
    rafRef.current = requestAnimationFrame(updatePhysics)
  }, [isMobile])

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isPressed) return
    
    // Don't prevent default on buttons or links
    if (e.target && 
        (e.target as Element).closest('main') && 
        !(e.target as Element).closest('a') && 
        e.cancelable) {
      e.preventDefault()
    }
    
    const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
    spawnHearts(x, y)
  }, [isPressed, spawnHearts])

  useEffect(() => {
    const handleStart = (e: MouseEvent | TouchEvent) => {
      // Don't prevent default on buttons or links
      if (e.target && 
          (e.target as Element).closest('main') && 
          !(e.target as Element).closest('a') && 
          e.cancelable) {
        e.preventDefault()
      }
      
      setIsPressed(true)
      handleMove(e)
    }

    const handleEnd = () => setIsPressed(false)

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
    <main className="relative h-screen w-full overflow-hidden bg-[#F8F8FA] dark:bg-[#111111]" 
          style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <h1
        className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2
                   text-5xl md:text-6xl lg:text-7xl font-medium pointer-events-none z-40
                   text-[#e5e5e5] dark:text-[#333333] text-center w-full px-4"
        style={{
          fontFamily: 'SF Pro Rounded, system-ui, sans-serif'
        }}
      >
        Coming soon
      </h1>

      <div className="absolute bottom-[10vh] left-0 right-0 flex justify-center items-center z-[100]">
        <a
          href="mailto:contact@eriks.design"
          className="px-6 py-3 md:px-5 md:py-2 rounded-full text-base md:text-sm font-medium
                    bg-[#007AFF] text-white 
                    hover:bg-[#0071F4] hover:scale-105
                    active:bg-[#0058CC] active:scale-95
                    cursor-pointer transition-all duration-200
                    touch-manipulation"
          style={{ fontFamily: 'SF Pro Rounded, system-ui, sans-serif' }}
          onClick={(e) => e.stopPropagation()}
        >
          Contact
        </a>
      </div>

      {/* Desktop hearts with physics */}
      {!isMobile && (
        <AnimatePresence>
          {hearts.map(heart => {
            const age = Date.now() - heart.createdAt
            const opacity = age > HEART_LIFETIME ? 
              Math.max(0, 1 - (age - HEART_LIFETIME) / FADE_DURATION) : 1

            return (
              <motion.div
                key={heart.id}
                className="fixed pointer-events-none text-3xl z-50 will-change-transform"
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
      )}

      {/* Mobile hearts with CSS animations */}
      {isMobile && (
        <div>
          {simpleHearts.map(heart => {
            const age = Date.now() - heart.createdAt
            const opacity = age > HEART_LIFETIME ? 
              Math.max(0, 1 - (age - HEART_LIFETIME) / FADE_DURATION) : 1
            
            // Determine style based on heart id for variety
            const animIndex = heart.id % 6
            const size = 0.7 + (heart.id % 5) * 0.1 // Slightly larger hearts
            const rotate = (heart.id % 8) * 45 // More rotation variation
            
            return (
              <div
                key={heart.id}
                className="fixed pointer-events-none text-xl z-50 will-change-transform"
                style={{
                  left: `${heart.x}px`,
                  top: `${heart.y}px`,
                  opacity,
                  transform: `scale(${size}) rotate(${rotate}deg)`,
                  animation: `pop-${animIndex} 0.3s forwards`, // Much faster animation
                  willChange: 'transform, opacity'
                }}
              >
                ❤️
              </div>
            )
          })}
        </div>
      )}

      {/* CSS animations for mobile hearts - faster & snappier */}
      {isMobile && (
        <style jsx global>{`
          @keyframes pop-0 {
            0% { transform: scale(0); }
            60% { transform: scale(${1.0 + Math.random() * 0.3}); }
            100% { transform: scale(${0.7 + Math.random() * 0.3}); }
          }
          @keyframes pop-1 {
            0% { transform: scale(0) rotate(0deg); }
            50% { transform: scale(${1.1 + Math.random() * 0.2}) rotate(10deg); }
            100% { transform: scale(${0.8 + Math.random() * 0.3}) rotate(15deg); }
          }
          @keyframes pop-2 {
            0% { transform: scale(0) rotate(0deg); }
            60% { transform: scale(${1.2 + Math.random() * 0.1}) rotate(-15deg); }
            100% { transform: scale(${0.9 + Math.random() * 0.2}) rotate(-20deg); }
          }
          @keyframes pop-3 {
            0% { transform: scale(0) rotate(0deg); }
            50% { transform: scale(${1.0 + Math.random() * 0.2}) rotate(20deg); }
            100% { transform: scale(${0.75 + Math.random() * 0.25}) rotate(25deg); }
          }
          @keyframes pop-4 {
            0% { transform: scale(0) rotate(0deg); }
            60% { transform: scale(${1.1 + Math.random() * 0.2}) rotate(-10deg); }
            100% { transform: scale(${0.85 + Math.random() * 0.15}) rotate(-15deg); }
          }
          @keyframes pop-5 {
            0% { transform: scale(0) rotate(0deg); }
            50% { transform: scale(${1.15 + Math.random() * 0.15}) rotate(5deg); }
            100% { transform: scale(${0.9 + Math.random() * 0.2}) rotate(10deg); }
          }
        `}</style>
      )}
    </main>
  )
} 