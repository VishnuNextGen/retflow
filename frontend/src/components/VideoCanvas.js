import React, { useRef, useEffect } from 'react';
import '../styles/VideoCanvas.css';

const VideoCanvas = ({ videoRef, isPlaying, sensitivity, showMask, layering }) => {
  const pitchCanvasRef = useRef(null);
  const playersCanvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const pitchCanvas = pitchCanvasRef.current;
    const playersCanvas = playersCanvasRef.current;
    const video = videoRef.current;
    if (!pitchCanvas || !playersCanvas || !video) return;

    const pitchCtx = pitchCanvas.getContext('2d', { alpha: true });
    const playersCtx = playersCanvas.getContext('2d', { alpha: true });
    
    // Create offscreen canvas for processing
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
      if (!pitchCanvas || !playersCanvas || !video || video.readyState < 2) return;

      // Set canvas sizes to match video
      if (pitchCanvas.width !== video.videoWidth || pitchCanvas.height !== video.videoHeight) {
        pitchCanvas.width = video.videoWidth;
        pitchCanvas.height = video.videoHeight;
        playersCanvas.width = video.videoWidth;
        playersCanvas.height = video.videoHeight;
      }

      if (layering) {
        // Separate layers: pitch bottom, drawings middle, players top
        separateLayers(pitchCtx, playersCtx, video, pitchCanvas, playersCanvas, sensitivity, showMask);
      } else {
        // No layering: draw everything on top layer
        pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
        playersCtx.drawImage(video, 0, 0, playersCanvas.width, playersCanvas.height);
        
        if (showMask) {
          applyMaskOverlay(playersCtx, playersCanvas, sensitivity);
        }
      }
    };

    const separateLayers = (pitchCtx, playersCtx, video, pitchCanvas, playersCanvas, sens, showMask) => {
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== video.videoWidth || offscreen.height !== video.videoHeight) {
        offscreen.width = video.videoWidth;
        offscreen.height = video.videoHeight;
      }
      
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      
      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;
      
      // Create image data for both layers
      const pitchData = pitchCtx.createImageData(offscreen.width, offscreen.height);
      const playersData = playersCtx.createImageData(offscreen.width, offscreen.height);
      
      // Separate pixels: green to pitch layer, non-green to players layer
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        const isGreen = (g > r + sens) && (g > b + sens) && (g > 80);
        
        if (isGreen) {
          // Green pixels go to PITCH layer (bottom)
          if (showMask) {
            pitchData.data[i] = Math.min(255, r + 100);
            pitchData.data[i + 1] = Math.max(0, g - 50);
            pitchData.data[i + 2] = Math.max(0, b - 50);
          } else {
            pitchData.data[i] = r;
            pitchData.data[i + 1] = g;
            pitchData.data[i + 2] = b;
          }
          pitchData.data[i + 3] = a;
          
          // Transparent in players layer
          playersData.data[i] = 0;
          playersData.data[i + 1] = 0;
          playersData.data[i + 2] = 0;
          playersData.data[i + 3] = 0;
        } else {
          // Non-green pixels go to PLAYERS layer (top)
          playersData.data[i] = r;
          playersData.data[i + 1] = g;
          playersData.data[i + 2] = b;
          playersData.data[i + 3] = a;
          
          // Transparent in pitch layer
          pitchData.data[i] = 0;
          pitchData.data[i + 1] = 0;
          pitchData.data[i + 2] = 0;
          pitchData.data[i + 3] = 0;
        }
      }
      
      // Render separated layers
      pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
      pitchCtx.putImageData(pitchData, 0, 0);
      
      playersCtx.clearRect(0, 0, playersCanvas.width, playersCanvas.height);
      playersCtx.putImageData(playersData, 0, 0);
    };

    const applyMaskOverlay = (ctx, canvas, sens) => {
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
  }, [videoRef, isPlaying, sensitivity, showMask, layering]);

  // Re-render when sensitivity, showMask, or layering changes
  useEffect(() => {
    const pitchCanvas = pitchCanvasRef.current;
    const playersCanvas = playersCanvasRef.current;
    const video = videoRef.current;
    if (!pitchCanvas || !playersCanvas || !video || video.readyState < 2) return;

    const pitchCtx = pitchCanvas.getContext('2d', { alpha: true });
    const playersCtx = playersCanvas.getContext('2d', { alpha: true });

    if (layering) {
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== video.videoWidth || offscreen.height !== video.videoHeight) {
        offscreen.width = video.videoWidth;
        offscreen.height = video.videoHeight;
      }
      
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      
      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;
      
      const pitchData = pitchCtx.createImageData(offscreen.width, offscreen.height);
      const playersData = playersCtx.createImageData(offscreen.width, offscreen.height);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        const isGreen = (g > r + sensitivity) && (g > b + sensitivity) && (g > 80);
        
        if (isGreen) {
          if (showMask) {
            pitchData.data[i] = Math.min(255, r + 100);
            pitchData.data[i + 1] = Math.max(0, g - 50);
            pitchData.data[i + 2] = Math.max(0, b - 50);
          } else {
            pitchData.data[i] = r;
            pitchData.data[i + 1] = g;
            pitchData.data[i + 2] = b;
          }
          pitchData.data[i + 3] = a;
          
          playersData.data[i] = 0;
          playersData.data[i + 1] = 0;
          playersData.data[i + 2] = 0;
          playersData.data[i + 3] = 0;
        } else {
          playersData.data[i] = r;
          playersData.data[i + 1] = g;
          playersData.data[i + 2] = b;
          playersData.data[i + 3] = a;
          
          pitchData.data[i] = 0;
          pitchData.data[i + 1] = 0;
          pitchData.data[i + 2] = 0;
          pitchData.data[i + 3] = 0;
        }
      }
      
      pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
      pitchCtx.putImageData(pitchData, 0, 0);
      
      playersCtx.clearRect(0, 0, playersCanvas.width, playersCanvas.height);
      playersCtx.putImageData(playersData, 0, 0);
    } else {
      pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
      playersCtx.drawImage(video, 0, 0, playersCanvas.width, playersCanvas.height);
      
      if (showMask) {
        const offscreen = offscreenCanvasRef.current;
        if (offscreen.width !== playersCanvas.width || offscreen.height !== playersCanvas.height) {
          offscreen.width = playersCanvas.width;
          offscreen.height = playersCanvas.height;
        }
        
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
        offCtx.drawImage(playersCanvas, 0, 0);
        
        const imageData = offCtx.getImageData(0, 0, playersCanvas.width, playersCanvas.height);
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

        playersCtx.putImageData(imageData, 0, 0);
      }
    }
  }, [sensitivity, showMask, layering]);

  return (
    <>
      <canvas
        ref={pitchCanvasRef}
        className="video-canvas pitch-layer"
        data-testid="pitch-canvas"
      />
      <canvas
        ref={playersCanvasRef}
        className="video-canvas players-layer"
        data-testid="players-canvas"
      />
    </>
  );
};

export default VideoCanvas;
