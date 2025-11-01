import React from 'react';
import { Slider } from './ui/slider';
import { ArrowLeft } from 'lucide-react';
import '../styles/DrawingToolPanel.css';

const PRESET_COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' }
];

const DrawingToolPanel = ({
  activeTool,
  drawingColor,
  setDrawingColor,
  brushSize,
  setBrushSize,
  glowIntensity,
  setGlowIntensity,
  rotation,
  setRotation
}) => {
  const toolName = activeTool.charAt(0).toUpperCase() + activeTool.slice(1);

  return (
    <div className="drawing-tool-panel" data-testid="drawing-tool-panel">
      <div className="panel-header">
        <ArrowLeft size={20} />
        <h3 className="panel-title">{toolName} Properties</h3>
      </div>

      <div className="panel-content">
        {/* Color Picker */}
        <div className="control-group">
          <label className="control-label">Color</label>
          <div className="color-presets">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-preset ${drawingColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setDrawingColor(color.value)}
                data-testid={`color-preset-${color.name.toLowerCase()}`}
                aria-label={color.name}
              />
            ))}
          </div>
          <div className="color-picker-container">
            <input
              type="color"
              value={drawingColor}
              onChange={(e) => setDrawingColor(e.target.value)}
              className="color-picker-input"
              data-testid="color-picker-input"
            />
            <div className="color-display">
              <div
                className="color-swatch"
                style={{ backgroundColor: drawingColor }}
              />
              <span className="color-hex" data-testid="color-hex-display">{drawingColor}</span>
            </div>
          </div>
        </div>

        {/* Thickness */}
        <div className="control-group">
          <label className="control-label">Thickness</label>
          <div className="slider-container">
            <Slider
              value={[brushSize]}
              onValueChange={(value) => setBrushSize(value[0])}
              min={1}
              max={20}
              step={1}
              className="tool-slider"
              data-testid="thickness-slider"
            />
            <span className="slider-value" data-testid="thickness-value">{brushSize}px</span>
          </div>
        </div>

        {/* Glow Intensity */}
        <div className="control-group">
          <label className="control-label">Glow Intensity</label>
          <div className="slider-container">
            <Slider
              value={[glowIntensity]}
              onValueChange={(value) => setGlowIntensity(value[0])}
              min={0}
              max={100}
              step={5}
              className="tool-slider"
              data-testid="glow-slider"
            />
            <span className="slider-value" data-testid="glow-value">{glowIntensity}%</span>
          </div>
        </div>

        {/* Rotate X-axis */}
        <div className="control-group">
          <label className="control-label">Rotate X-axis</label>
          <div className="slider-container">
            <Slider
              value={[rotation]}
              onValueChange={(value) => setRotation(value[0])}
              min={0}
              max={360}
              step={1}
              className="tool-slider"
              data-testid="rotation-slider"
            />
            <span className="slider-value" data-testid="rotation-value">{rotation}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingToolPanel;
