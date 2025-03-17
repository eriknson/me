'use client'

import { useEffect, useState, useRef } from 'react'
import { Analytics } from '@vercel/analytics/react'

// Heart interface 
interface Heart {
  id: number
  x: number
  y: number
  size: number
  rotation: number
  opacity: number
  element: HTMLDivElement
  velocity: {
    x: number
    y: number
  }
  created: number
}

// Cursor states
type CursorState = 'default' | 'pointer' | 'active'

export default function Home() {
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const heartsRef = useRef<Heart[]>([])
  const heartIdRef = useRef(0)
  const rafRef = useRef<number>()
  const isActiveRef = useRef(false)
  const lastSpawnTimeRef = useRef(0)
  
  // Cursor state management
  const [cursorPosition, setCursorPosition] = useState({ x: -100, y: -100 }) // Start off-screen
  const [cursorState, setCursorState] = useState<CursorState>('default')
  const cursorRef = useRef<HTMLDivElement>(null)
  
  // Maximum number of hearts to allow on screen for performance
  const MAX_HEARTS = isMobile ? 25 : 50; // Significantly reduced for better performance
  
  // Initial pre-populated pool size
  const INITIAL_POOL_SIZE = 20;
  
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

  // Custom cursor implementation - only for non-mobile
  useEffect(() => {
    if (isMobile) return; // Don't implement custom cursor on mobile devices
    
    const updateCursorPosition = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseDown = () => {
      setCursorState('active');
    };
    
    const handleMouseUp = () => {
      setCursorState('default');
    };
    
    // Add mouse event listeners
    window.addEventListener('mousemove', updateCursorPosition);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', updateCursorPosition);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isMobile]);

  // Element pool for better performance - reuse elements instead of creating new ones
  const elementsPoolRef = useRef<HTMLDivElement[]>([]);
  
  // Pre-populate element pool to prevent lag during first interactions
  useEffect(() => {
    // Clear any existing pool
    elementsPoolRef.current.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    elementsPoolRef.current = [];
    
    // Create initial pool of elements
    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      const element = document.createElement('div');
      element.innerText = '💛'; // Yellow heart emoji
      element.setAttribute('aria-hidden', 'true');
      element.style.position = 'fixed';
      element.style.zIndex = '50';
      element.style.pointerEvents = 'none';
      element.style.willChange = 'transform, opacity';
      element.style.display = 'none'; // Initially hidden
      document.body.appendChild(element);
      elementsPoolRef.current.push(element);
    }
  }, []);
  
  // Get or create an element from the pool
  const getHeartElement = (): HTMLDivElement => {
    if (elementsPoolRef.current.length > 0) {
      // Reuse element from pool
      const element = elementsPoolRef.current.pop()!;
      element.style.display = 'block';
      element.style.opacity = '1';
      return element;
    } else {
      // Create new element
      const element = document.createElement('div');
      element.innerText = '💛'; // Yellow heart emoji
      element.setAttribute('aria-hidden', 'true'); // Hide from screen readers
      element.style.position = 'fixed';
      element.style.zIndex = '50';
      element.style.pointerEvents = 'none';
      element.style.willChange = 'transform, opacity';
      document.body.appendChild(element);
      return element;
    }
  };
  
  // Return element to pool for reuse
  const returnElementToPool = (element: HTMLDivElement) => {
    // Hide but keep in DOM for reuse
    element.style.display = 'none';
    elementsPoolRef.current.push(element);
  };

  // Create heart element with optimized reuse
  const createHeart = (x: number, y: number) => {
    const id = heartIdRef.current++;
    const size = isMobile ? 28 + Math.random() * 10 : 35 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2; // Slightly reduced speed range
    const rotation = Math.random() * 360;
    
    // Get heart element from pool
    const element = getHeartElement();
    
    // Set position correctly, we need both the left/top AND the transform
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.fontSize = `${size}px`;
    element.style.opacity = '1';
    element.style.transform = `rotate(${rotation}deg)`;
    
    // Create heart object
    const heart: Heart = {
      id,
      x, // Initial x position is the cursor x
      y, // Initial y position is the cursor y
      size,
      rotation,
      opacity: 1,
      element,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - (isMobile ? 3.0 : 2.5) // Increased initial boost on mobile for faster movement
      },
      created: Date.now()
    };
    
    heartsRef.current.push(heart);
    return heart;
  };
  
  // More efficient update with throttled calculations
  const updateHearts = () => {
    const now = Date.now();
    const lifespan = isMobile ? 2500 : 5000; // Reduced lifespan on mobile for faster animations
    const fadeTime = 500; // 0.5 second fade
    
    // Filter and update hearts in one pass for better performance
    const updatedHearts: Heart[] = [];
    
    // Update every other frame on mobile for better performance
    if (isMobile && now % 2 === 0) {
      heartsRef.current.forEach(heart => {
        updatedHearts.push(heart);
      });
      rafRef.current = requestAnimationFrame(updateHearts);
      return;
    }
    
    for (const heart of heartsRef.current) {
      // Check age
      const age = now - heart.created;
      if (age > lifespan + fadeTime) {
        returnElementToPool(heart.element);
        continue; // Skip to next heart
      }
      
      // Handle fade out
      if (age > lifespan) {
        heart.opacity = 1 - (age - lifespan) / fadeTime;
        heart.element.style.opacity = heart.opacity.toString();
      }
      
      // Update position with gravity - use higher values on mobile for faster movement
      heart.velocity.y += isMobile ? 0.15 : 0.1; // Increased gravity on mobile
      
      // Apply velocity
      heart.x += heart.velocity.x;
      heart.y += heart.velocity.y;
      
      // Floor collision
      if (heart.y + heart.size > window.innerHeight) {
        heart.y = window.innerHeight - heart.size;
        heart.velocity.y = -heart.velocity.y * (isMobile ? 0.5 : 0.3); // More energetic bounce on mobile
        
        // Stop if velocity is very low (optimization)
        if (Math.abs(heart.velocity.y) < 0.5) {
          heart.velocity.y = 0;
          // Also reduce x velocity when settled for better performance
          heart.velocity.x *= isMobile ? 0.95 : 0.9; // Less dampening on mobile
        }
      }
      
      // Wall collisions with optimization for settled hearts
      if ((heart.x < 0 || heart.x + heart.size > window.innerWidth) && Math.abs(heart.velocity.x) > 0.1) {
        heart.velocity.x = -heart.velocity.x * (isMobile ? 0.5 : 0.3); // More energetic bounce on mobile
      }
      
      // Constrain within window
      heart.x = Math.max(0, Math.min(window.innerWidth - heart.size, heart.x));
      
      // Apply faster rotation on mobile
      if (Math.abs(heart.velocity.x) > 0.1) {
        heart.rotation += heart.velocity.x * (isMobile ? 0.3 : 0.2); // More rotation on mobile
      }
      
      // Update DOM element position - must set left/top not just transform
      heart.element.style.left = `${heart.x}px`;
      heart.element.style.top = `${heart.y}px`;
      heart.element.style.transform = `rotate(${heart.rotation}deg)`;
      
      updatedHearts.push(heart);
    }
    
    heartsRef.current = updatedHearts;
    rafRef.current = requestAnimationFrame(updateHearts);
  };
  
  // Staggered heart creation to reduce lag spikes
  const staggeredHeartCreation = (x: number, y: number, count: number, currentIndex = 0) => {
    if (currentIndex >= count) return;
    
    // Create one heart immediately
    createHeart(x, y);
    
    // Schedule the next heart creation with a slight delay
    if (currentIndex < count - 1) {
      setTimeout(() => {
        staggeredHeartCreation(x, y, count, currentIndex + 1);
      }, isMobile ? 5 : 5); // Quicker spawn on mobile
    }
  };
  
  // Spawn hearts at position with throttling
  const spawnHearts = (x: number, y: number) => {
    const now = Date.now();
    // Throttle spawning for better performance
    const spawnThrottle = isMobile ? 100 : 60; // Increased throttle to reduce spawn rate
    
    if (now - lastSpawnTimeRef.current < spawnThrottle) {
      return;
    }
    
    lastSpawnTimeRef.current = now;
    
    // Limit total hearts for performance
    if (heartsRef.current.length >= MAX_HEARTS) {
      // Remove oldest hearts when at limit (more aggressively)
      const toRemove = Math.min(
        Math.max(heartsRef.current.length - MAX_HEARTS + (isMobile ? 3 : 5), 0), 
        isMobile ? 5 : 10
      );
      
      for (let i = 0; i < toRemove; i++) {
        if (heartsRef.current.length > 0) {
          const heart = heartsRef.current.shift()!;
          returnElementToPool(heart.element);
        }
      }
    }
    
    // Spawn fewer hearts for better performance, especially on mobile
    const count = isMobile ? 2 : 3; // Reduced count significantly
    
    // Use staggered creation instead of all at once
    staggeredHeartCreation(x, y, count);
  };
  
  // Handle drag events for continuous spawning
  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isActiveRef.current) return;
    
    // Don't handle events on the contact button
    if (e.target && (e.target as Element).closest('a')) return;
    
    // Get position
    const x = 'touches' in e 
      ? e.touches[0].clientX 
      : (e as MouseEvent).clientX;
    
    const y = 'touches' in e 
      ? e.touches[0].clientY 
      : (e as MouseEvent).clientY;
    
    // Spawn hearts
    spawnHearts(x, y);
    
    // Prevent default on touch to avoid scrolling while drawing hearts
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
  };
  
  // Event handlers with touch/mouse unification
  useEffect(() => {
    // Start handler
    const handleStart = (e: MouseEvent | TouchEvent) => {
      isActiveRef.current = true;
      
      // Spawn hearts immediately on start
      handleDrag(e);
      
      // Prevent default only in the main area, not on buttons
      if ('touches' in e && 
          e.target && 
          (e.target as Element).closest('main') && 
          !(e.target as Element).closest('a') && 
          e.cancelable) {
        e.preventDefault();
      }
    };
    
    // End handler
    const handleEnd = () => {
      isActiveRef.current = false;
    };
    
    // Start animation loop
    rafRef.current = requestAnimationFrame(updateHearts);
    
    // Add event listeners
    window.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('mouseleave', handleEnd);
    window.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleDrag, { passive: false });
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      // Cleanup
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Remove all hearts from DOM or return to pool
      heartsRef.current.forEach(heart => {
        returnElementToPool(heart.element);
      });
      heartsRef.current = [];
      
      // Clean up the element pool on unmount
      elementsPoolRef.current.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      elementsPoolRef.current = [];
      
      // Remove event listeners
      window.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('mouseleave', handleEnd);
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleDrag);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isMobile]);

  // Handle redirect for contact options
  const handleContactOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'email') {
      window.open('mailto:contact@eriks.design', '_blank');
    } else if (value === 'twitter') {
      window.open('https://twitter.com/vibes', '_blank');
    }
    
    // Reset select to default option after navigation
    e.target.value = '';
  };

  // P3 color space vibrant blue with fallback
  const p3Blue = "color(display-p3 0 0.454 1)"; // Vibrant blue in P3 color space
  const fallbackBlue = "#0074FF"; // Standard sRGB fallback

  return (
    <>
      <main 
        ref={containerRef}
        className="relative h-screen w-full overflow-hidden bg-[#F8F8FA] dark:bg-[#111111]" 
        style={{ 
          height: 'calc(var(--vh, 1vh) * 100)',
          // Use default cursor normally
          cursor: 'auto'
        }}
        aria-label="Coming soon page with interactive heart animations"
      >
        {/* Custom prayer hands cursor only shows when active */}
        {!isMobile && cursorState === 'active' && (
          <div 
            ref={cursorRef}
            className="fixed pointer-events-none z-[1000] transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${cursorPosition.x}px`,
              top: `${cursorPosition.y}px`,
              fontSize: '40px', // Larger size for more prominence
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.7))', // Enhanced glow
              animation: 'sunPulse 0.6s infinite', // Faster, more dynamic pulse
              willChange: 'transform, left, top',
            }}
          >
            🌞
          </div>
        )}

        <style jsx global>{`
          @keyframes sunPulse {
            0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: drop-shadow(0 0 5px rgba(255,215,0,0.5)); }
            50% { transform: translate(-50%, -50%) scale(1.2) rotate(180deg); filter: drop-shadow(0 0 15px rgba(255,215,0,0.8)); }
            100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); filter: drop-shadow(0 0 5px rgba(255,215,0,0.5)); }
          }
          
          /* Global font settings */
          html, body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* Select element styling */
          select.contact-select {
            text-align: center;
            text-align-last: center;
            -moz-text-align-last: center;
            color: white;
          }
          
          /* Style select options - note that this only works in some browsers */
          select.contact-select option {
            background-color: white;
            color: #333;
            text-align: left;
          }
        `}</style>

        <h1
          className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2
                    text-5xl md:text-6xl lg:text-7xl font-medium pointer-events-none z-40
                    text-[#e5e5e5] dark:text-[#333333] text-center w-full px-4"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif'
          }}
        >
          Coming Soon™
        </h1>

        <div className="absolute bottom-[10vh] left-0 right-0 flex justify-center items-center z-[100]">
          <div className="relative">
            <select
              onChange={handleContactOptionChange}
              className="contact-select appearance-none px-8 py-4 md:px-6 md:py-3 rounded-full text-lg md:text-base font-bold
                      text-white 
                      hover:scale-105
                      active:scale-95
                      cursor-pointer transition-all duration-200
                      touch-manipulation
                      border-0 outline-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50" 
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
                background: p3Blue,
                backgroundColor: fallbackBlue,
                backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                textIndent: '1px',
                textOverflow: 'ellipsis',
              }}
              aria-label="Contact options"
              defaultValue=""
            >
              <option value="" disabled>Contact</option>
              <option value="email">Email</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>
        </div>
      </main>
      
      {/* Vercel Analytics */}
      <Analytics />
    </>
  )
} 