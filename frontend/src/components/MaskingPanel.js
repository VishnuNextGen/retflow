import React from 'react';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { ArrowLeft } from 'lucide-react';
import '../styles/MaskingPanel.css';

const MaskingPanel = ({
  sensitivity,
  setSensitivity,
  showMask,
  setShowMask,
  layering,
  setLayering
}) => {
  return (
    <div className="masking-panel" data-testid="masking-panel">
      <div className="panel-header">
        <ArrowLeft size={20} />
        <h3 className="panel-title">Masking & Layering</h3>
      </div>

      <div className="panel-content">
        {/* Green Pitch Detection */}
        <div className="control-group">
          <label className="control-label">Green Pitch Detection</label>
          <div className="slider-container">
            <Slider
              value={[sensitivity]}
              onValueChange={(value) => setSensitivity(value[0])}
              min={10}
              max={80}
              step={1}
              className="pitch-slider"
              data-testid="sensitivity-slider"
            />
            <span className="slider-value" data-testid="sensitivity-value">{sensitivity}</span>
          </div>
        </div>

        {/* Show Detection Mask */}
        <div className="control-group">
          <div className="switch-row">
            <div>
              <label className="control-label">Show Detection Mask</label>
              <p className="control-description">Enable to adjust sensitivity.</p>
            </div>
            <Switch
              checked={showMask}
              onCheckedChange={setShowMask}
              data-testid="show-mask-toggle"
            />
          </div>
        </div>

        {/* Layering */}
        <div className="control-group">
          <div className="switch-row">
            <div>
              <label className="control-label">Layering</label>
              <p className="control-description">Drawings between pitch and players</p>
            </div>
            <Switch
              checked={layering}
              onCheckedChange={setLayering}
              data-testid="layering-toggle"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaskingPanel;
