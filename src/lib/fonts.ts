import localFont from 'next/font/local';

export const mondwest = localFont({
  src: [
    {
      path: '../../public/fonts/PPMondwest-Regular.otf',
      weight: '400',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: true,
  variable: '--font-mondwest',
}); 