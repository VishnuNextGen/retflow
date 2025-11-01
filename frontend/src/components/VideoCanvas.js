import React, { useRef, useEffect } from 'react';
import '../styles/VideoCanvas.css';

const VideoCanvas = ({ videoRef, isPlaying, sensitivity, showMask, layering }) => {
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    // Create offscreen canvas for processing only when needed
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const processFrame = () => {
      if (!video.paused && !video.ended) {
        renderFrame();
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    const renderFrame = () => {
      if (!canvas || !video || video.readyState < 2) return;

      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Simply draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Only apply mask overlay if showMask is enabled (for sensitivity adjustment)
      if (showMask) {
        applyMaskOverlay(ctx, canvas, sensitivity);
      }
    };

    const applyMaskOverlay = (ctx, canvas, sens) => {
      // Use offscreen canvas to avoid recreating
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
      }
      
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(canvas, 0, 0);
      
      const imageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Apply red tint only to green pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const isGreen = (g > r + sens) && (g > b + sens) && (g > 80);

        if (isGreen) {
          data[i] = Math.min(255, r + 100);
          data[i + 1] = Math.max(0, g - 50);
          data[i + 2] = Math.max(0, b - 50);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    // Initial render
    if (video.readyState >= 2) {
      renderFrame();
    }

    // Listen to video events
    const handleLoadedData = () => renderFrame();
    const handleSeeked = () => renderFrame();
    const handlePlay = () => {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };
    const handlePause = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderFrame();
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    if (isPlaying && !video.paused) {
      processFrame();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoRef, isPlaying, sensitivity, showMask]);

  // Re-render when sensitivity or showMask changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (showMask) {
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
      }
      
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(canvas, 0, 0);
      
      const imageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const isGreen = (g > r + sensitivity) && (g > b + sensitivity) && (g > 80);

        if (isGreen) {
          data[i] = Math.min(255, r + 100);
          data[i + 1] = Math.max(0, g - 50);
          data[i + 2] = Math.max(0, b - 50);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }
  }, [sensitivity, showMask]);

  return (
    <canvas
      ref={canvasRef}
      className="video-canvas"
      data-testid="video-canvas"
    />
  );
};

export default VideoCanvas;
