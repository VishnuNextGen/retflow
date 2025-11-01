import React, { useRef, useEffect, useState } from 'react';
import '../styles/VideoCanvas.css';

const VideoCanvas = ({ videoRef, isPlaying, sensitivity, showMask, layering }) => {
  const canvasRef = useRef(null);
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
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

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

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Apply green detection and mask if enabled
      if (showMask) {
        applyGreenMask(ctx, canvas, sensitivity);
      }
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
          data[i] = Math.min(255, r + 100);     // R + 100
          data[i + 1] = Math.max(0, g - 50);    // G - 50
          data[i + 2] = Math.max(0, b - 50);    // B - 50
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Apply mask if enabled
    if (showMask) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
