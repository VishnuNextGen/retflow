import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Circle as CircleIcon, ArrowRight, Undo2, Redo2, Trash2 } from 'lucide-react';
import VideoUpload from './VideoUpload';
import DrawingOverlay from './DrawingOverlay';
import MaskingPanel from './MaskingPanel';
import DrawingToolPanel from './DrawingToolPanel';
import '../styles/TacticalBoard.css';

const TacticalBoard = () => {
  const [videoData, setVideoData] = useState(null);
  const [pitchVideoUrl, setPitchVideoUrl] = useState(null);
  const [playersVideoUrl, setPlayersVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Drawing tools state
  const [activeTool, setActiveTool] = useState('masking');
  const [drawingColor, setDrawingColor] = useState('#EF4444');
  const [brushSize, setBrushSize] = useState(4);
  const [glowIntensity, setGlowIntensity] = useState(30);
  const [rotation, setRotation] = useState(0);
  
  // Masking state
  const [sensitivity, setSensitivity] = useState(34);
  const [showMask, setShowMask] = useState(false);
  const [layering, setLayering] = useState(true);
  
  // Drawing history
  const [drawings, setDrawings] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const pitchVideoRef = useRef(null);
  const playersVideoRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const handleVideoProcessed = (data) => {
    setVideoData(data);
    setPitchVideoUrl(data.pitchUrl);
    setPlayersVideoUrl(data.playersUrl);
    setDrawings([]);
    setHistoryIndex(-1);
    setIsLoading(false);
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSkip = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  };

  const handleSeek = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleVolumeChange = (event) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const addDrawing = (drawing) => {
    const newDrawings = drawings.slice(0, historyIndex + 1);
    newDrawings.push(drawing);
    setDrawings(newDrawings);
    setHistoryIndex(newDrawings.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > -1) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < drawings.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleClearAll = () => {
    setDrawings([]);
    setHistoryIndex(-1);
  };

  const handleUploadNew = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setDrawings([]);
    setHistoryIndex(-1);
  };

  const currentDrawings = drawings.slice(0, historyIndex + 1);

  return (
    <div className="tactical-board" data-testid="tactical-board">
      {/* Header */}
      <header className="board-header animate-fade-in" data-testid="board-header">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="#FF6B35" strokeWidth="3" />
              <circle cx="16" cy="16" r="8" fill="#FF6B35" />
            </svg>
          </div>
          <h1 className="logo-text">TacticalVision</h1>
        </div>
        {videoFile && (
          <div className="session-info">
            <h2 className="session-title" data-testid="session-title">Analysis Session - LIV vs AVL</h2>
            <span className="ready-badge" data-testid="ready-badge">
              <span className="ready-dot"></span>
              Ready
            </span>
          </div>
        )}
      </header>

      {!videoFile ? (
        /* Upload Area */
        <div className="upload-container animate-fade-in" data-testid="upload-container">
          <div className="upload-card">
            <div className="upload-icon-wrapper">
              <Upload className="upload-icon" size={64} />
            </div>
            <h2 className="upload-title">Upload Football Video</h2>
            <p className="upload-description">
              Drag and drop your match video here, or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="file-input"
              data-testid="file-input"
            />
            <button
              className="upload-button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-button"
            >
              Select Video
            </button>
            <div className="upload-formats">
              Supported formats: MP4, WebM, MOV, AVI
            </div>
          </div>

          {/* Help Section */}
          <div className="help-section" data-testid="help-section">
            <h3 className="help-title">How to Use</h3>
            <div className="help-grid">
              <div className="help-item">
                <div className="help-number">1</div>
                <div className="help-content">
                  <h4>Upload Video</h4>
                  <p>Select a football match video from your device</p>
                </div>
              </div>
              <div className="help-item">
                <div className="help-number">2</div>
                <div className="help-content">
                  <h4>Adjust Detection</h4>
                  <p>Fine-tune green pitch detection with sensitivity slider</p>
                </div>
              </div>
              <div className="help-item">
                <div className="help-number">3</div>
                <div className="help-content">
                  <h4>Draw Tactics</h4>
                  <p>Use drawing tools to annotate plays and strategies</p>
                </div>
              </div>
              <div className="help-item">
                <div className="help-number">4</div>
                <div className="help-content">
                  <h4>Analyze</h4>
                  <p>Play through video with persistent tactical annotations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Main Content */
        <div className="main-content animate-fade-in" data-testid="main-content">
          {/* Left Sidebar */}
          <aside className="left-sidebar animate-slide-in-left" data-testid="left-sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title">DRAWING TOOLS</h3>
              <div className="tool-buttons">
                <button
                  className={`tool-button ${activeTool === 'masking' ? 'active' : ''}`}
                  onClick={() => setActiveTool('masking')}
                  data-testid="masking-tool-button"
                >
                  <svg className="tool-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2L3 7v6l7 5 7-5V7l-7-5z" strokeWidth="1.5" stroke="currentColor" fill="none" />
                  </svg>
                  <span>Masking</span>
                </button>
                <button
                  className={`tool-button ${activeTool === 'circle' ? 'active' : ''}`}
                  onClick={() => setActiveTool('circle')}
                  data-testid="circle-tool-button"
                >
                  <CircleIcon className="tool-icon" size={20} />
                  <span>Circle</span>
                </button>
                <button
                  className={`tool-button ${activeTool === 'arrow' ? 'active' : ''}`}
                  onClick={() => setActiveTool('arrow')}
                  data-testid="arrow-tool-button"
                >
                  <ArrowRight className="tool-icon" size={20} />
                  <span>Arrow</span>
                </button>
              </div>
            </div>

            <div className="sidebar-section">
              <h3 className="sidebar-title">ACTIONS</h3>
              <div className="action-buttons">
                <button
                  className="action-button"
                  onClick={handleUndo}
                  disabled={historyIndex < 0}
                  data-testid="undo-button"
                >
                  <Undo2 className="action-icon" size={18} />
                  <span>Undo</span>
                </button>
                <button
                  className="action-button"
                  onClick={handleRedo}
                  disabled={historyIndex >= drawings.length - 1}
                  data-testid="redo-button"
                >
                  <Redo2 className="action-icon" size={18} />
                  <span>Redo</span>
                </button>
                <button
                  className="action-button danger"
                  onClick={handleClearAll}
                  data-testid="clear-all-button"
                >
                  <Trash2 className="action-icon" size={18} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Center Content */}
          <main className="center-content" data-testid="center-content">
            <div className="canvas-section" data-testid="canvas-section">
              {isLoading ? (
                <div className="loading-spinner" data-testid="loading-spinner">
                  <div className="spinner"></div>
                  <p>Loading video...</p>
                </div>
              ) : (
                <div className="canvas-container" ref={canvasContainerRef} data-testid="canvas-container">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    style={{ display: 'none' }}
                  />
                  <VideoCanvas
                    videoRef={videoRef}
                    isPlaying={isPlaying}
                    sensitivity={sensitivity}
                    showMask={showMask}
                    layering={layering}
                  />
                  <DrawingOverlay
                    canvasContainerRef={canvasContainerRef}
                    activeTool={activeTool}
                    drawingColor={drawingColor}
                    brushSize={brushSize}
                    glowIntensity={glowIntensity}
                    rotation={rotation}
                    drawings={currentDrawings}
                    onAddDrawing={addDrawing}
                    isEnabled={activeTool !== 'masking'}
                  />
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div className="playback-controls" data-testid="playback-controls">
              <div className="timeline-container" onClick={handleSeek} data-testid="timeline-container">
                <div className="timeline-track">
                  <div
                    className="timeline-progress"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  ></div>
                  <div
                    className="timeline-thumb"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="controls-row">
                <div className="time-display" data-testid="time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                <div className="control-buttons">
                  <button
                    className="control-button"
                    onClick={() => handleSkip(-5)}
                    data-testid="skip-back-button"
                  >
                    <SkipBack size={20} />
                  </button>
                  <button
                    className="control-button play-button"
                    onClick={handlePlayPause}
                    data-testid="play-pause-button"
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  <button
                    className="control-button"
                    onClick={() => handleSkip(5)}
                    data-testid="skip-forward-button"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>
                <div className="volume-control" data-testid="volume-control">
                  <Volume2 size={20} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                    data-testid="volume-slider"
                  />
                </div>
              </div>
            </div>

            {/* Upload New Button */}
            <button
              className="upload-new-button"
              onClick={handleUploadNew}
              data-testid="upload-new-button"
            >
              Upload New Video
            </button>
          </main>

          {/* Right Sidebar */}
          <aside className="right-sidebar animate-slide-in-right" data-testid="right-sidebar">
            {activeTool === 'masking' ? (
              <MaskingPanel
                sensitivity={sensitivity}
                setSensitivity={setSensitivity}
                showMask={showMask}
                setShowMask={setShowMask}
                layering={layering}
                setLayering={setLayering}
              />
            ) : (
              <DrawingToolPanel
                activeTool={activeTool}
                drawingColor={drawingColor}
                setDrawingColor={setDrawingColor}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                glowIntensity={glowIntensity}
                setGlowIntensity={setGlowIntensity}
                rotation={rotation}
                setRotation={setRotation}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default TacticalBoard;
