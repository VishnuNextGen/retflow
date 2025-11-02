import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import axios from 'axios';
import '../styles/VideoUpload.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VideoUpload = ({ onVideoProcessed }) => {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('video/')) {
      alert('Please select a valid video file');
      return;
    }

    try {
      setUploading(true);
      setStatusMessage('Uploading video...');

      // Upload video
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await axios.post(`${API}/videos/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const videoId = uploadResponse.data.video_id;
      setCurrentVideoId(videoId);
      setUploading(false);
      setStatusMessage('Upload complete. Starting processing...');

      // Start processing
      await startProcessing(videoId);

    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      setProcessing(false);
      setStatusMessage('Upload failed. Please try again.');
    }
  };

  const startProcessing = async (videoId) => {
    try {
      setProcessing(true);
      setProcessingProgress(0);

      // Trigger processing
      await axios.post(`${API}/videos/process/${videoId}`, null, {
        params: { sensitivity: 34 }
      });

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API}/videos/status/${videoId}`);
          const { status, progress, message } = statusResponse.data;

          setProcessingProgress(progress);
          setStatusMessage(message);

          if (status === 'completed') {
            clearInterval(pollInterval);
            setProcessing(false);
            setStatusMessage('Processing complete!');
            
            // Notify parent component
            onVideoProcessed({
              videoId,
              pitchUrl: `${API}/videos/stream/${videoId}/pitch`,
              playersUrl: `${API}/videos/stream/${videoId}/players`
            });
          } else if (status === 'error') {
            clearInterval(pollInterval);
            setProcessing(false);
            setStatusMessage(`Error: ${message}`);
          }
        } catch (error) {
          console.error('Status check error:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Processing error:', error);
      setProcessing(false);
      setStatusMessage('Processing failed. Please try again.');
    }
  };

  return (
    <div className="video-upload-container" data-testid="video-upload-container">
      <div className="upload-card">
        <div className="upload-icon-wrapper">
          {(uploading || processing) ? (
            <Loader2 className="upload-icon spinning" size={64} />
          ) : (
            <Upload className="upload-icon" size={64} />
          )}
        </div>
        
        <h2 className="upload-title">
          {uploading ? 'Uploading Video...' : processing ? 'Processing Video...' : 'Upload Football Video'}
        </h2>
        
        <p className="upload-description">
          {statusMessage || 'Select a match video. Large files (2+ hours) supported!'}
        </p>

        {uploading && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="progress-text">{uploadProgress}% uploaded</p>
          </div>
        )}

        {processing && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill processing" style={{ width: `${processingProgress}%` }}></div>
            </div>
            <p className="progress-text">{processingProgress.toFixed(1)}% processed</p>
            <p className="progress-hint">This may take a few minutes for large videos...</p>
          </div>
        )}

        {!uploading && !processing && (
          <>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="file-input"
              id="video-upload-input"
              data-testid="video-upload-input"
            />
            <label htmlFor="video-upload-input" className="upload-button" data-testid="upload-button-label">
              Select Video
            </label>
            <div className="upload-formats">
              Supported: MP4, WebM, MOV, AVI • No size limit
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoUpload;
