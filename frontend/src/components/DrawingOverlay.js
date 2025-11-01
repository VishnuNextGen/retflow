import React, { useRef, useEffect, useState } from 'react';
import SVG from 'svg.js';
import '../styles/DrawingOverlay.css';

const DrawingOverlay = ({
  canvasContainerRef,
  activeTool,
  drawingColor,
  brushSize,
  glowIntensity,
  rotation,
  drawings,
  onAddDrawing,
  isEnabled
}) => {
  const overlayRef = useRef(null);
  const svgDrawRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState(null);

  // Initialize SVG canvas
  useEffect(() => {
    if (overlayRef.current && !svgDrawRef.current) {
      svgDrawRef.current = SVG(overlayRef.current).size('100%', '100%');
    }
  }, []);

  // Render all drawings
  useEffect(() => {
    if (!svgDrawRef.current) return;

    // Clear canvas
    svgDrawRef.current.clear();

    // Re-draw all saved drawings
    drawings.forEach((drawing) => {
      drawShape(drawing, false);
    });
  }, [drawings]);

  const drawShape = (drawing, isTemp = false) => {
    if (!svgDrawRef.current) return null;

    const { type, x1, y1, x2, y2, color, size, glow, rot } = drawing;

    if (type === 'circle') {
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2;

      const circle = svgDrawRef.current
        .circle(radius * 2)
        .center(centerX, centerY)
        .fill('none')
        .stroke({ color, width: size });

      if (glow > 0) {
        circle.attr({
          'filter': `drop-shadow(0 0 ${glow}px ${color})`
        });
      }

      return circle;
    } else if (type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const arrowHeadSize = size * 3;

      // Draw main line
      const line = svgDrawRef.current
        .line(x1, y1, x2, y2)
        .stroke({ color, width: size, linecap: 'round' });

      // Draw arrow head
      const headX1 = x2 - arrowHeadSize * Math.cos(angle - Math.PI / 6);
      const headY1 = y2 - arrowHeadSize * Math.sin(angle - Math.PI / 6);
      const headX2 = x2 - arrowHeadSize * Math.cos(angle + Math.PI / 6);
      const headY2 = y2 - arrowHeadSize * Math.sin(angle + Math.PI / 6);

      const arrowHead = svgDrawRef.current
        .polygon(`${x2},${y2} ${headX1},${headY1} ${headX2},${headY2}`)
        .fill(color);

      const group = svgDrawRef.current.group();
      group.add(line);
      group.add(arrowHead);

      if (glow > 0) {
        group.attr({
          'filter': `drop-shadow(0 0 ${glow}px ${color})`
        });
      }

      return group;
    }

    return null;
  };

  const handleMouseDown = (e) => {
    if (!isEnabled || activeTool === 'masking') return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isEnabled || activeTool === 'masking') return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Remove current temp shape
    if (currentShape) {
      currentShape.remove();
    }

    // Draw temp shape
    const tempDrawing = {
      type: activeTool,
      x1: startPos.x,
      y1: startPos.y,
      x2: x,
      y2: y,
      color: drawingColor,
      size: brushSize,
      glow: glowIntensity,
      rot: rotation
    };

    const shape = drawShape(tempDrawing, true);
    setCurrentShape(shape);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !isEnabled || activeTool === 'masking') return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only save if there's meaningful distance
    const distance = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
    if (distance > 10) {
      const newDrawing = {
        type: activeTool,
        x1: startPos.x,
        y1: startPos.y,
        x2: x,
        y2: y,
        color: drawingColor,
        size: brushSize,
        glow: glowIntensity,
        rot: rotation,
        id: Date.now()
      };

      onAddDrawing(newDrawing);
    }

    setIsDrawing(false);
    setCurrentShape(null);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (currentShape) {
        currentShape.remove();
        setCurrentShape(null);
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      className={`drawing-overlay ${isEnabled && activeTool !== 'masking' ? 'drawing-active' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      data-testid="drawing-overlay"
    />
  );
};

export default DrawingOverlay;
