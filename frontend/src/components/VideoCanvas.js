import React, { useRef, useEffect, useState } from 'react';
import '../styles/VideoCanvas.css';

const VideoCanvas = ({ videoRef, isPlaying, sensitivity, showMask, layering }) => {
  const pitchCanvasRef = useRef(null);
  const playersCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [supportsWebGPU, setSupportsWebGPU] = useState(false);

  useEffect(() => {
    // Check for WebGPU support
    const checkWebGPU = async () => {
      if ('gpu' in navigator) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            setSupportsWebGPU(true);
          }
        } catch (e) {
          setSupportsWebGPU(false);
        }
      }
    };
    checkWebGPU();
  }, []);

  useEffect(() => {
    const pitchCanvas = pitchCanvasRef.current;
    const playersCanvas = playersCanvasRef.current;
    const video = videoRef.current;
    if (!pitchCanvas || !playersCanvas || !video) return;

    const pitchCtx = pitchCanvas.getContext('2d', { willReadFrequently: true });
    const playersCtx = playersCanvas.getContext('2d', { willReadFrequently: true });

    const processFrame = () => {
      if (!video.paused && !video.ended) {
        renderFrame();
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    const renderFrame = () => {
      if (!pitchCanvas || !playersCanvas || !video || video.readyState < 2) return;

      // Set canvas size to match video
      if (pitchCanvas.width !== video.videoWidth || pitchCanvas.height !== video.videoHeight) {
        pitchCanvas.width = video.videoWidth;
        pitchCanvas.height = video.videoHeight;
        playersCanvas.width = video.videoWidth;
        playersCanvas.height = video.videoHeight;
      }

      if (layering) {
        // Layered mode: Separate pitch and players
        separateLayers(pitchCtx, playersCtx, video, pitchCanvas, playersCanvas, sensitivity, showMask);
      } else {
        // Non-layered mode: Draw everything together on players canvas (top)
        pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
        playersCtx.drawImage(video, 0, 0, playersCanvas.width, playersCanvas.height);
        
        if (showMask) {
          applyGreenMask(playersCtx, playersCanvas, sensitivity);
        }
      }
    };

    const separateLayers = (pitchCtx, playersCtx, video, pitchCanvas, playersCanvas, sens, showMask) => {
      // Create temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      
      // Draw video to temp canvas
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Get pixel data
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;
      
      // Create separate image data for pitch and players
      const pitchData = pitchCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const playersData = playersCtx.createImageData(tempCanvas.width, tempCanvas.height);
      
      // Separate pixels based on green detection
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Green detection algorithm
        const isGreen = (g > r + sens) && (g > b + sens) && (g > 80);
        
        if (isGreen) {
          // Put green pixels in pitch layer (bottom)
          if (showMask) {
            // Apply red tint for mask visualization
            pitchData.data[i] = Math.min(255, r + 100);
            pitchData.data[i + 1] = Math.max(0, g - 50);
            pitchData.data[i + 2] = Math.max(0, b - 50);
          } else {
            pitchData.data[i] = r;
            pitchData.data[i + 1] = g;
            pitchData.data[i + 2] = b;
          }
          pitchData.data[i + 3] = a;
          
          // Make transparent in players layer
          playersData.data[i] = 0;
          playersData.data[i + 1] = 0;
          playersData.data[i + 2] = 0;
          playersData.data[i + 3] = 0;
        } else {
          // Put non-green pixels in players layer (top)
          playersData.data[i] = r;
          playersData.data[i + 1] = g;
          playersData.data[i + 2] = b;
          playersData.data[i + 3] = a;
          
          // Make transparent in pitch layer
          pitchData.data[i] = 0;
          pitchData.data[i + 1] = 0;
          pitchData.data[i + 2] = 0;
          pitchData.data[i + 3] = 0;
        }
      }
      
      // Draw separated layers
      pitchCtx.clearRect(0, 0, pitchCanvas.width, pitchCanvas.height);
      pitchCtx.putImageData(pitchData, 0, 0);
      
      playersCtx.clearRect(0, 0, playersCanvas.width, playersCanvas.height);
      playersCtx.putImageData(playersData, 0, 0);
    };

    const applyGreenMask = (ctx, canvas, sens) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Green detection algorithm
        const isGreen = (g > r + sens) && (g > b + sens) && (g > 80);

        if (isGreen) {
          // Apply red tint to green areas
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

    const pitchCtx = pitchCanvas.getContext('2d', { willReadFrequently: true });
    const playersCtx = playersCanvas.getContext('2d', { willReadFrequently: true });

    if (layering) {
      // Create temporary canvas for processing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;
      
      const pitchData = pitchCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const playersData = playersCtx.createImageData(tempCanvas.width, tempCanvas.height);
      
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
        const imageData = playersCtx.getImageData(0, 0, playersCanvas.width, playersCanvas.height);
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
