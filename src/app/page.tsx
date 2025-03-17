'use client'

import { useEffect, useState, useRef } from 'react'
import { Analytics } from '@vercel/analytics/react'

// Heart interface for animation 
interface Heart {
  id: number
  x: number
  y: number
  size: number
  rotation: number
  opacity: number
  velocity: {
    x: number
    y: number
  }
  created: number
  element?: HTMLDivElement // Element for DOM-based hearts (desktop)
}

// Cursor states
type CursorState = 'default' | 'pointer' | 'active'

export default function Home() {
  const [isMobile, setIsMobile] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  
  // Element pool for DOM hearts on desktop
  const elementsPoolRef = useRef<HTMLDivElement[]>([]);
  
  // Maximum number of hearts to allow for performance
  const MAX_HEARTS = isMobile ? 15 : 30;
  
  // Initial pool size for DOM hearts
  const INITIAL_POOL_SIZE = 20;
  
  // Reference for select element
  const selectRef = useRef<HTMLSelectElement>(null);
  
  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Adjust viewport height for mobile browsers
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // If we're on mobile, resize canvas
      if (mobile && canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      
      // If we're changing from mobile to desktop or vice versa, we need to clean up
      // and reinitialize the appropriate animation system
      if (mobile !== isMobile) {
        // Clean up existing hearts
        heartsRef.current.forEach(heart => {
          if (!mobile && heart.element) {
            // If switching to mobile, remove DOM elements
            if (heart.element.parentNode) {
              heart.element.parentNode.removeChild(heart.element);
            }
          }
        });
        
        heartsRef.current = [];
        
        if (!mobile) {
          // If switching to desktop, initialize DOM element pool
          initializeElementPool();
        }
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [isMobile]);

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

  // Pre-populate element pool for DOM hearts on desktop
  const initializeElementPool = () => {
    // Clean up any existing elements
    elementsPoolRef.current.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    elementsPoolRef.current = [];
    
    // Create initial pool of elements
    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      const element = document.createElement('div');
      element.innerText = '💛';
      element.setAttribute('aria-hidden', 'true');
      element.style.position = 'absolute'; // Change to absolute positioning
      element.style.zIndex = '20'; // Lower than the button (z-100)
      element.style.pointerEvents = 'none';
      element.style.transform = 'translateZ(0)'; // Force GPU acceleration
      element.style.backfaceVisibility = 'hidden'; // Reduce visual artifacts
      element.style.willChange = 'transform, opacity'; // Hint to browser
      element.style.display = 'none'; // Initially hidden
      
      // Apply better rendering for emojis
      element.style.fontFamily = 'Apple Color Emoji, Segoe UI Emoji, NotoColorEmoji, Segoe UI Symbol, Android Emoji, EmojiSymbols';
      
      // Append hearts to the container instead of body for proper positioning
      if (containerRef.current) {
        containerRef.current.appendChild(element);
      } else {
        document.body.appendChild(element);
      }
      elementsPoolRef.current.push(element);
    }
  };
  
  // Get heart element from pool for DOM hearts
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
      element.innerText = '💛';
      element.setAttribute('aria-hidden', 'true');
      element.style.position = 'absolute'; // Change to absolute positioning
      element.style.zIndex = '20'; // Lower than the button
      element.style.pointerEvents = 'none';
      element.style.transform = 'translateZ(0)'; // Force GPU acceleration
      element.style.backfaceVisibility = 'hidden'; // Reduce visual artifacts
      element.style.willChange = 'transform, opacity'; // Hint to browser
      
      // Apply better rendering for emojis
      element.style.fontFamily = 'Apple Color Emoji, Segoe UI Emoji, NotoColorEmoji, Segoe UI Symbol, Android Emoji, EmojiSymbols';
      
      // Append hearts to the container instead of body for proper positioning
      if (containerRef.current) {
        containerRef.current.appendChild(element);
      } else {
        document.body.appendChild(element);
      }
      return element;
    }
  };
  
  // Return element to pool
  const returnElementToPool = (element: HTMLDivElement) => {
    element.style.display = 'none';
    elementsPoolRef.current.push(element);
  };

  // Create heart object - for both canvas and DOM
  const createHeart = (x: number, y: number) => {
    const id = heartIdRef.current++;
    const size = isMobile 
      ? 30 + Math.random() * 10 
      : 40 + Math.random() * 20; // Restored larger size for desktop
    
    const angle = Math.random() * Math.PI * 2;
    const speed = isMobile 
      ? 3.5 + Math.random() * 2.5 
      : 4 + Math.random() * 4; // Restored faster speed for desktop
    
    const rotation = Math.random() * 360;
    
    const heart: Heart = {
      id,
      x,
      y,
      size,
      rotation,
      opacity: 1,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - (isMobile ? 5.0 : 4.5) // Restored greater lift for desktop
      },
      created: Date.now()
    };
    
    // If desktop, attach a DOM element
    if (!isMobile) {
      const element = getHeartElement();
      element.style.fontSize = `${size}px`;
      element.style.opacity = '1';
      // Only set the initial position with transform
      element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
      heart.element = element;
    }
    
    heartsRef.current.push(heart);
    return heart;
  };
  
  // Render hearts on canvas (mobile only)
  const renderHearts = () => {
    if (!isMobile) return; // Skip on desktop
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw hearts
    heartsRef.current.forEach(heart => {
      ctx.save();
      
      // Set opacity
      ctx.globalAlpha = heart.opacity;
      
      // Position and rotation
      ctx.translate(heart.x + heart.size/2, heart.y + heart.size/2);
      ctx.rotate(heart.rotation * Math.PI / 180);
      
      // Draw the emoji
      ctx.font = `${heart.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💛', 0, 0);
      
      ctx.restore();
    });
  };
  
  // Update hearts animation
  const updateHearts = () => {
    const now = Date.now();
    const lifespan = isMobile ? 2000 : 3500; // Restored shorter lifespan for desktop
    const fadeTime = isMobile ? 300 : 500;
    
    // Filter and update hearts
    const updatedHearts: Heart[] = [];
    
    for (const heart of heartsRef.current) {
      // Check age
      const age = now - heart.created;
      if (age > lifespan + fadeTime) {
        // Clean up DOM element on desktop
        if (!isMobile && heart.element) {
          returnElementToPool(heart.element);
        }
        continue; // Remove heart
      }
      
      // Handle fade out
      if (age > lifespan) {
        heart.opacity = 1 - (age - lifespan) / fadeTime;
        // Update DOM element opacity on desktop
        if (!isMobile && heart.element) {
          heart.element.style.opacity = heart.opacity.toString();
        }
      }
      
      // Gravity and physics - restored faster falling for desktop
      heart.velocity.y += isMobile ? 0.25 : 0.22;
      
      // Apply velocity with custom multiplier per platform - restored faster speed for desktop
      const speedMultiplier = isMobile ? 1.1 : 1.4;
      heart.x += heart.velocity.x * speedMultiplier;
      heart.y += heart.velocity.y * speedMultiplier;
      
      // Floor collision with bounce
      if (heart.y + heart.size > window.innerHeight) {
        heart.y = window.innerHeight - heart.size;
        heart.velocity.y = -heart.velocity.y * (isMobile ? 0.65 : 0.6); // Restored bouncier for desktop
        
        // Stop if velocity is very low
        if (Math.abs(heart.velocity.y) < (isMobile ? 0.9 : 1.0)) { // Restored desktop value
          heart.velocity.y = 0;
          heart.velocity.x *= 0.85; // Same reduction for both
        }
      }
      
      // Wall collisions
      if ((heart.x < 0 || heart.x + heart.size > window.innerWidth) && Math.abs(heart.velocity.x) > 0.1) {
        heart.velocity.x = -heart.velocity.x * 0.4; // Same for both platforms
      }
      
      // Constrain within window
      heart.x = Math.max(0, Math.min(window.innerWidth - heart.size, heart.x));
      
      // Update rotation based on horizontal velocity
      if (Math.abs(heart.velocity.x) > 0.1) {
        heart.rotation += heart.velocity.x * 0.3; // Same for both platforms
      }
      
      // Update DOM element position on desktop - use transform for better performance
      if (!isMobile && heart.element) {
        // Use translate3d for better GPU acceleration combined with rotation
        heart.element.style.transform = `translate3d(${heart.x}px, ${heart.y}px, 0) rotate(${heart.rotation}deg)`;
      }
      
      updatedHearts.push(heart);
    }
    
    heartsRef.current = updatedHearts;
    
    // For mobile, render on canvas
    if (isMobile) {
      renderHearts();
    }
    
    // Continue animation loop
    rafRef.current = requestAnimationFrame(updateHearts);
  };
  
  // Spawn hearts at position with throttling
  const spawnHearts = (x: number, y: number) => {
    const now = Date.now();
    const spawnThrottle = isMobile ? 60 : 40;
    
    if (now - lastSpawnTimeRef.current < spawnThrottle) {
      return;
    }
    
    lastSpawnTimeRef.current = now;
    
    // Limit total hearts for performance
    while (heartsRef.current.length >= MAX_HEARTS) {
      const oldestHeart = heartsRef.current.shift()!;
      if (!isMobile && oldestHeart.element) {
        returnElementToPool(oldestHeart.element);
      }
    }
    
    // Simple count values - avoid staggered creation on desktop
    const count = isMobile ? 2 : 3;
    
    // Create hearts immediately for both platforms
    for (let i = 0; i < count; i++) {
      createHeart(
        x + (Math.random() - 0.5) * 20, // More spread
        y + (Math.random() - 0.5) * 20  // More spread
      );
    }
  };
  
  // Handle drag events for continuous spawning
  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isActiveRef.current) return;
    
    // Don't handle events on the contact button
    if (e.target && (e.target as Element).closest('a, select, button')) return;
    
    // Get position relative to the container for DOM-based hearts
    let x, y;
    
    if (!isMobile && containerRef.current) {
      // For desktop, get coordinates relative to container
      const rect = containerRef.current.getBoundingClientRect();
      x = 'touches' in e 
        ? e.touches[0].clientX - rect.left
        : (e as MouseEvent).clientX - rect.left;
      
      y = 'touches' in e 
        ? e.touches[0].clientY - rect.top
        : (e as MouseEvent).clientY - rect.top;
    } else {
      // For mobile, use client coordinates (canvas is full viewport)
      x = 'touches' in e 
        ? e.touches[0].clientX 
        : (e as MouseEvent).clientX;
      
      y = 'touches' in e 
        ? e.touches[0].clientY 
        : (e as MouseEvent).clientY;
    }
    
    // Spawn hearts
    spawnHearts(x, y);
    
    // Prevent default on touch to avoid scrolling while drawing hearts
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
  };
  
  // Setup animation and event listeners
  useEffect(() => {
    // Initialize the appropriate system
    if (isMobile) {
      // Initialize canvas for mobile
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        
        // For high DPI displays
        const dpr = window.devicePixelRatio || 1;
        if (dpr > 1) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.style.width = `${window.innerWidth}px`;
            canvasRef.current.style.height = `${window.innerHeight}px`;
            canvasRef.current.width = window.innerWidth * dpr;
            canvasRef.current.height = window.innerHeight * dpr;
            ctx.scale(dpr, dpr);
          }
        }
      }
    } else {
      // Initialize DOM element pool for desktop
      initializeElementPool();
    }
    
    // Event handlers
    const handleStart = (e: MouseEvent | TouchEvent) => {
      isActiveRef.current = true;
      
      // Spawn hearts immediately on start
      handleDrag(e);
      
      // Prevent default only in the main area, not on buttons
      if ('touches' in e && 
          e.target && 
          (e.target as Element).closest('main') && 
          !(e.target as Element).closest('a, select, button') && 
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
    
    // Clean up on unmount
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Clean up hearts
      heartsRef.current.forEach(heart => {
        if (!isMobile && heart.element && heart.element.parentNode) {
          heart.element.parentNode.removeChild(heart.element);
        }
      });
      heartsRef.current = [];
      
      // Clean up element pool
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

  // Handle contact option selection with unified behavior for mobile/desktop
  const handleContactOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    
    // Get the selected value
    const value = e.target.value;
    
    // Reset to Contact immediately
    e.target.value = 'contact';
    
    // Handle based on selection
    if (value === 'email') {
      // Direct email link for both mobile and desktop - same tab
      window.location.href = 'mailto:contact@eriks.design';
    } else if (value === 'twitter') {
      // For Twitter - reliable new tab opening technique for all devices
      try {
        // Create an anchor element with proper attributes for new tab
        const a = document.createElement('a');
        a.href = 'https://twitter.com/0xago';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        // Special handling for iOS devices which may handle _blank differently
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) {
          // On iOS, we need additional attributes for reliable new tab behavior
          a.setAttribute('data-popup', 'true');
          a.dataset.url = a.href; // Backup the URL in a dataset
        }
        
        // Hide element but keep it functional
        a.style.display = 'none';
        document.body.appendChild(a);
        
        // Use click event for most web standards compliant behavior
        a.click();
        
        // Clean up DOM
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);
      } catch (err) {
        console.error('Failed to open Twitter in new tab', err);
        // Fallback to the most compatible approach - window.open
        window.open('https://twitter.com/0xago', '_blank');
        
        // Ultimate fallback if everything else fails
        if (!window.open) {
          window.location.href = 'https://twitter.com/0xago';
        }
      }
    } else if (value === 'linkedin') {
      // For LinkedIn - reliable new tab opening technique for all devices
      try {
        // Create an anchor element with proper attributes for new tab
        const a = document.createElement('a');
        a.href = 'https://www.linkedin.com/in/eriknson/';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        // Special handling for iOS devices which may handle _blank differently
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) {
          // On iOS, we need additional attributes for reliable new tab behavior
          a.setAttribute('data-popup', 'true');
          a.dataset.url = a.href; // Backup the URL in a dataset
        }
        
        // Hide element but keep it functional
        a.style.display = 'none';
        document.body.appendChild(a);
        
        // Use click event for most web standards compliant behavior
        a.click();
        
        // Clean up DOM
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);
      } catch (err) {
        console.error('Failed to open LinkedIn in new tab', err);
        // Fallback to the most compatible approach - window.open
        window.open('https://www.linkedin.com/in/eriknson/', '_blank');
        
        // Ultimate fallback if everything else fails
        if (!window.open) {
          window.location.href = 'https://www.linkedin.com/in/eriknson/';
        }
      }
    }
    
    // Ensure select is blurred on mobile to close it properly
    if (isMobile) {
      setTimeout(() => {
        try {
          e.target.blur();
        } catch (err) {
          console.log('Failed to blur select');
        }
      }, 100);
    }
  };
  
  // Effect to hide "Contact" option on mobile
  useEffect(() => {
    function hideContactOptionOnMobile() {
      if (!selectRef.current) return;
      
      const contactOption = selectRef.current.querySelector('option[value="contact"]');
      if (!contactOption) return;
      
      if (window.innerWidth < 768) {
        // Apply multiple hiding techniques for maximum browser compatibility
        contactOption.setAttribute('hidden', 'true');
        contactOption.setAttribute('disabled', 'true');
        (contactOption as HTMLElement).style.display = 'none';
        (contactOption as HTMLElement).style.height = '0';
        (contactOption as HTMLElement).style.padding = '0';
        (contactOption as HTMLElement).style.opacity = '0';
        (contactOption as HTMLElement).style.visibility = 'hidden';
        (contactOption as HTMLElement).style.position = 'absolute';
        (contactOption as HTMLElement).style.overflow = 'hidden';
      }
    }
    
    // Delay function for setTimeout inside click handler
    function delayedHideContactOption() {
      setTimeout(hideContactOptionOnMobile, 0);
    }
    
    // Initial hide
    hideContactOptionOnMobile();
    
    // Hide on window resize
    window.addEventListener('resize', hideContactOptionOnMobile);
    
    // Critical: hide when select is focused (when mobile browsers build the dropdown)
    if (selectRef.current) {
      selectRef.current.addEventListener('focus', hideContactOptionOnMobile);
      selectRef.current.addEventListener('touchstart', hideContactOptionOnMobile);
      selectRef.current.addEventListener('mousedown', hideContactOptionOnMobile);
      
      // Additional event to catch iOS Safari's dropdown building
      selectRef.current.addEventListener('click', delayedHideContactOption);
    }
    
    // Clean up
    return () => {
      window.removeEventListener('resize', hideContactOptionOnMobile);
      if (selectRef.current) {
        selectRef.current.removeEventListener('focus', hideContactOptionOnMobile);
        selectRef.current.removeEventListener('touchstart', hideContactOptionOnMobile);
        selectRef.current.removeEventListener('mousedown', hideContactOptionOnMobile);
        selectRef.current.removeEventListener('click', delayedHideContactOption);
      }
    };
  }, [isMobile]); // Re-run when isMobile changes
  
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
          cursor: 'auto',
          position: 'relative' // Ensure position relative for absolute child positioning
        }}
        aria-label="Work in progress page with interactive heart animations"
      >
        {/* Canvas for heart animations (mobile only) */}
        {isMobile && (
          <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: 20 }}
          />
        )}
        
        {/* Custom sun cursor only shows when active */}
        {!isMobile && cursorState === 'active' && (
          <div 
            ref={cursorRef}
            className="fixed pointer-events-none z-[1000] transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${cursorPosition.x}px`,
              top: `${cursorPosition.y}px`,
              fontSize: '40px',
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.7))',
              animation: 'sunPulse 0.6s infinite',
              willChange: 'transform, left, top',
            }}
          >
            🌞
          </div>
        )}

        {/* Global styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes sunPulse {
            0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: drop-shadow(0 0 5px rgba(255,215,0,0.5)); }
            50% { transform: translate(-50%, -50%) scale(1.2) rotate(180deg); filter: drop-shadow(0 0 15px rgba(255,215,0,0.8)); }
            100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); filter: drop-shadow(0 0 5px rgba(255,215,0,0.5)); }
          }
          
          /* Global font settings */
          html, body {
            font-family: "PPMondwest-Regular", -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* Font loading with better stability */
          @font-face {
            font-family: 'PPMondwest-Regular';
            src: url('/fonts/PPMondwest-Regular.otf') format('opentype');
            font-weight: normal;
            font-style: normal;
            font-display: block; /* Changed from swap to block to prevent FOUT */
          }
          
          /* Prevent layout shifts by forcing text to use the same dimensions */
          h1, h2, h3, p, div, span {
            font-synthesis: none; /* Prevent synthesized font variants */
            text-rendering: geometricPrecision; /* Better text rendering */
          }
          
          /* Select styling to look like a button */
          select.contact-select {
            text-align: center;
            text-align-last: center;
            -moz-text-align-last: center;
            color: white;
            -webkit-tap-highlight-color: transparent;
            transform: translateZ(0);
            user-select: none;
            cursor: pointer;
            background-color: #0074FF; /* Standard sRGB fallback */
          }
          
          /* P3 color space support detection and application */
          @supports (color: color(display-p3 0 0 0)) {
            select.contact-select {
              background-color: color(display-p3 0 0.454 1) !important; /* P3 vibrant blue when supported */
            }
          }
          
          /* Hide all dropdown indicators */
          select.contact-select {
            background-image: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
          }
          
          /* Remove arrow in IE */
          select.contact-select::-ms-expand {
            display: none;
          }
          
          /* Firefox specific fix */
          @-moz-document url-prefix() {
            select.contact-select {
              text-indent: 0;
              text-overflow: '';
            }
          }
          
          /* Style options properly */
          select.contact-select option {
            background-color: white;
            color: #333;
            text-align: left;
            padding: 12px 15px;
            font-size: 14px;
            font-weight: normal;
          }
          
          /* Mobile optimizations */
          @media (max-width: 768px) {
            select.contact-select {
              min-height: 56px;
              min-width: 200px;
              font-size: 20px !important;
              padding-top: 12px !important;
              padding-bottom: 12px !important;
              padding-left: 24px !important;
              padding-right: 24px !important;
            }
            
            select.contact-select option {
              padding: 14px 16px;
              font-size: 16px;
            }
            
            /* Ultra aggressive hiding for the Contact option on mobile */
            option[value="contact"] {
              display: none !important;
              height: 0 !important;
              max-height: 0 !important;
              font-size: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              border: 0 !important;
              overflow: hidden !important;
              opacity: 0 !important;
              visibility: hidden !important;
              position: absolute !important;
              pointer-events: none !important;
              clip: rect(0,0,0,0) !important;
              transform: translateY(-100%) !important;
            }
            
            /* Make sure the Get in touch option stands out as a header */
            option[value="get-in-touch"] {
              background-color: #f8f8f8 !important;
              color: #666 !important;
              font-weight: 600 !important;
              border-bottom: 1px solid #eee !important;
            }
            
            /* Ensure Email and Twitter options are clearly selectable */
            option[value="email"],
            option[value="twitter"],
            option[value="linkedin"] {
              padding: 16px !important;
              font-size: 16px !important;
              background-color: white !important;
              color: #333 !important;
            }
          }
        `}} />

        <h1
          className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2
                    text-5xl md:text-6xl lg:text-7xl font-medium pointer-events-none z-10
                    text-[#e5e5e5] dark:text-[#333333] text-center w-full px-4"
          style={{
            fontFamily: '"PPMondwest-Regular", -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Rounded", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
            transform: 'translate3d(-50%, -50%, 0)', // Force hardware acceleration
            willChange: 'transform', // Hint to browser for optimization
            fontSynthesis: 'none' // Prevent synthetic font fallbacks
          }}
        >
          Work in Progress
        </h1>

        <div className="absolute bottom-[12vh] left-0 right-0 flex justify-center items-center z-[100]">
          {/* Native select on both mobile and desktop */}
          <div className="relative">
            <select
              ref={selectRef}
              onChange={handleContactOptionChange}
              onClick={(e) => {
                // Prevent default option selection behavior
                e.preventDefault();
                
                // On mobile, ensure the select opens properly on tap
                if (isMobile) {
                  try {
                    (e.target as HTMLSelectElement).focus();
                  } catch (err) {
                    console.log('Failed to focus select');
                  }
                }
              }}
              className="contact-select px-10 py-5 md:px-8 md:py-4 rounded-full text-xl md:text-lg font-semibold
                      text-white 
                      hover:scale-105
                      active:scale-95
                      transition-all duration-200
                      border-0 outline-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
                paddingRight: '18px',
                paddingLeft: '18px',
                ...(isMobile ? { 
                  fontSize: '20px',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  fontWeight: 600,
                  minHeight: '56px',
                  minWidth: '200px',
                  paddingLeft: '24px',
                  paddingRight: '24px',
                } : {}),
              }}
              aria-label="Contact options"
              defaultValue="contact"
              // Make sure the label always stays as "Contact"
              onFocus={(e) => {
                e.currentTarget.value = 'contact';
              }}
              onBlur={(e) => {
                e.currentTarget.value = 'contact';
              }}
              // Always force the value to be "contact" for the label
              value="contact"
            >
              {/* Contact option - always selected but hidden in dropdown */}
              <option 
                value="contact" 
                disabled 
                hidden
                style={{
                  display: 'none',
                  visibility: 'hidden'
                }}
                id="contact-option" // Adding ID for easier targeting
              >
                Contact
              </option>
              
              {/* Add a disabled Get in touch option for the dropdown */}
              { !isMobile && <option 
                value="get-in-touch" 
                disabled
                style={{ 
                  fontWeight: 'bold', 
                  color: '#777',
                  backgroundColor: '#f9f9f9' 
                }}
              >
                Get in touch
              </option>
              }
              {/* Real options */}
              <option value="email">Email</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
        </div>
      </main>
      
      {/* Vercel Analytics */}
      <Analytics />
    </>
  )
} 