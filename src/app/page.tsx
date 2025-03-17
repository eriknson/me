'use client'

import { useEffect, useState, useRef } from 'react'

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

export default function Home() {
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const heartsRef = useRef<Heart[]>([])
  const heartIdRef = useRef(0)
  const rafRef = useRef<number>()
  const isActiveRef = useRef(false)
  const lastSpawnTimeRef = useRef(0)
  
  // Maximum number of hearts to allow on screen for performance
  const MAX_HEARTS = isMobile ? 40 : 75; // Reduced for better performance
  
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
    
    // Set initial properties all at once for better performance
    const initialTransform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    element.style.fontSize = `${size}px`;
    element.style.opacity = '1';
    element.style.transform = initialTransform;
    
    // Create heart object
    const heart: Heart = {
      id,
      x,
      y,
      size,
      rotation,
      opacity: 1,
      element,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - (isMobile ? 1.5 : 2.5) // Reduced initial boost
      },
      created: Date.now()
    };
    
    heartsRef.current.push(heart);
    return heart;
  };
  
  // More efficient update with throttled calculations
  const updateHearts = () => {
    const now = Date.now();
    const lifespan = isMobile ? 3000 : 5000; // 3-5 seconds lifespan
    const fadeTime = 500; // 0.5 second fade
    
    // Filter and update hearts in one pass for better performance
    const updatedHearts: Heart[] = [];
    
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
      
      // Update position with gravity - use smaller steps on mobile
      heart.velocity.y += isMobile ? 0.08 : 0.1; // Gentler gravity on mobile
      
      // Apply velocity
      heart.x += heart.velocity.x;
      heart.y += heart.velocity.y;
      
      // Floor collision
      if (heart.y + heart.size > window.innerHeight) {
        heart.y = window.innerHeight - heart.size;
        heart.velocity.y = -heart.velocity.y * 0.3; // Bounce with damping
        
        // Stop if velocity is very low (optimization)
        if (Math.abs(heart.velocity.y) < 0.5) {
          heart.velocity.y = 0;
          // Also reduce x velocity when settled for better performance
          heart.velocity.x *= 0.9;
        }
      }
      
      // Wall collisions with optimization for settled hearts
      if ((heart.x < 0 || heart.x + heart.size > window.innerWidth) && Math.abs(heart.velocity.x) > 0.1) {
        heart.velocity.x = -heart.velocity.x * 0.3; // Bounce with damping
      }
      
      // Constrain within window
      heart.x = Math.max(0, Math.min(window.innerWidth - heart.size, heart.x));
      
      // Apply slow rotation - less on mobile for performance
      if (Math.abs(heart.velocity.x) > 0.1) {
        heart.rotation += heart.velocity.x * (isMobile ? 0.1 : 0.2);
      }
      
      // Update DOM element using transform for better performance
      heart.element.style.transform = `translate(${heart.x}px, ${heart.y}px) rotate(${heart.rotation}deg)`;
      
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
      }, isMobile ? 8 : 5); // Slight delay between creations
    }
  };
  
  // Spawn hearts at position with throttling
  const spawnHearts = (x: number, y: number) => {
    const now = Date.now();
    // Throttle spawning on mobile to prevent performance issues
    const spawnThrottle = isMobile ? 80 : 40; // Increased throttle time for better performance
    
    if (now - lastSpawnTimeRef.current < spawnThrottle) {
      return;
    }
    
    lastSpawnTimeRef.current = now;
    
    // Limit total hearts for performance
    if (heartsRef.current.length >= MAX_HEARTS) {
      // Remove oldest hearts when at limit
      const toRemove = Math.min(
        heartsRef.current.length + (isMobile ? 3 : 5) - MAX_HEARTS,
        10 // Cap removal to avoid performance hit from bulk removal
      );
      
      for (let i = 0; i < toRemove; i++) {
        if (heartsRef.current.length > 0) {
          const heart = heartsRef.current.shift()!;
          returnElementToPool(heart.element);
        }
      }
    }
    
    // Spawn fewer hearts on mobile for performance
    const count = isMobile ? 3 : 5; // Reduced count for better initial performance
    
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

  // P3 color space vibrant blue with fallback
  const p3Blue = "color(display-p3 0 0.454 1)"; // Vibrant blue in P3 color space
  const fallbackBlue = "#0074FF"; // Standard sRGB fallback

  return (
    <main 
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-[#F8F8FA] dark:bg-[#111111]" 
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
      aria-label="Coming soon page with interactive heart animations"
    >
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
          className="px-8 py-4 md:px-6 md:py-3 rounded-full text-lg md:text-base font-bold
                    text-white 
                    hover:scale-105
                    active:scale-95
                    cursor-pointer transition-all duration-200
                    touch-manipulation"
          style={{
            fontFamily: 'SF Pro Rounded, system-ui, sans-serif',
            background: p3Blue,
            backgroundColor: fallbackBlue,
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Contact via email"
        >
          Contact
        </a>
      </div>
    </main>
  )
} 