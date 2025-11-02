from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import aiofiles
import asyncio
import subprocess
import cv2
import numpy as np
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
PROCESSED_DIR = ROOT_DIR / 'processed'
UPLOADS_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class VideoMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_size: int
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "uploaded"  # uploaded, processing, completed, error
    progress: float = 0.0
    pitch_video_path: Optional[str] = None
    players_video_path: Optional[str] = None
    error_message: Optional[str] = None

class ProcessingStatus(BaseModel):
    status: str
    progress: float
    message: str


# Video processing function
async def process_video_layers(video_id: str, input_path: str, sensitivity: int = 34):
    try:
        # Update status to processing
        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"status": "processing", "progress": 0.0}}
        )

        # Output paths
        background_path = str(PROCESSED_DIR / f"{video_id}_background.mp4")
        pitch_path = str(PROCESSED_DIR / f"{video_id}_pitch.mp4")
        players_path = str(PROCESSED_DIR / f"{video_id}_players.mp4")
        
        # Get video info
        cap = cv2.VideoCapture(input_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        # Create temporary directory for frames
        temp_dir = PROCESSED_DIR / f"{video_id}_temp"
        temp_dir.mkdir(exist_ok=True)
        pitch_frames_dir = temp_dir / "pitch"
        players_frames_dir = temp_dir / "players"
        pitch_frames_dir.mkdir(exist_ok=True)
        players_frames_dir.mkdir(exist_ok=True)

        # Process frames in batches
        cap = cv2.VideoCapture(input_path)
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Separate layers
            pitch_frame, players_frame = separate_frame_layers(frame, sensitivity)
            
            # Save frames
            cv2.imwrite(str(pitch_frames_dir / f"frame_{frame_count:06d}.png"), pitch_frame)
            cv2.imwrite(str(players_frames_dir / f"frame_{frame_count:06d}.png"), players_frame)
            
            frame_count += 1
            
            # Update progress every 30 frames
            if frame_count % 30 == 0:
                progress = (frame_count / total_frames) * 50  # First 50% for extraction
                await db.videos.update_one(
                    {"id": video_id},
                    {"$set": {"progress": progress}}
                )
        
        cap.release()

        # Encode videos using FFmpeg
        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"progress": 50.0}}
        )

        # Create background video (full original video)
        background_cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-pix_fmt', 'yuv420p',
            background_path
        ]
        subprocess.run(background_cmd, check=True, capture_output=True)

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"progress": 60.0}}
        )

        # Encode pitch layer (with alpha using VP9/WebM)
        pitch_webm_path = pitch_path.replace('.mp4', '.webm')
        pitch_cmd = [
            'ffmpeg', '-y', '-r', str(fps),
            '-i', str(pitch_frames_dir / 'frame_%06d.png'),
            '-c:v', 'libvpx-vp9',  # VP9 supports alpha
            '-pix_fmt', 'yuva420p',
            '-auto-alt-ref', '0',  # Required for alpha
            pitch_webm_path
        ]
        subprocess.run(pitch_cmd, check=True, capture_output=True)

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"progress": 80.0}}
        )

        # Encode players layer (with alpha using VP9/WebM)
        players_webm_path = players_path.replace('.mp4', '.webm')
        players_cmd = [
            'ffmpeg', '-y', '-r', str(fps),
            '-i', str(players_frames_dir / 'frame_%06d.png'),
            '-c:v', 'libvpx-vp9',  # VP9 supports alpha
            '-pix_fmt', 'yuva420p',
            '-auto-alt-ref', '0',  # Required for alpha
            players_webm_path
        ]
        subprocess.run(players_cmd, check=True, capture_output=True)

        # Clean up temp frames
        import shutil
        shutil.rmtree(temp_dir)

        # Update database
        await db.videos.update_one(
            {"id": video_id},
            {"$set": {
                "status": "completed",
                "progress": 100.0,
                "background_video_path": background_path,
                "pitch_video_path": pitch_webm_path,
                "players_video_path": players_webm_path
            }}
        )

    except Exception as e:
        logging.error(f"Error processing video {video_id}: {str(e)}")
        await db.videos.update_one(
            {"id": video_id},
            {"$set": {
                "status": "error",
                "error_message": str(e)
            }}
        )


def separate_frame_layers(frame, sensitivity):
    """Separate a frame into pitch (green only) and players (non-green only) layers"""
    # Create output frames with alpha channel
    h, w = frame.shape[0], frame.shape[1]
    
    # Convert to RGB for processing
    b, g, r = frame[:, :, 0], frame[:, :, 1], frame[:, :, 2]
    
    # Green detection
    is_green = (g > r + sensitivity) & (g > b + sensitivity) & (g > 80)
    
    # Pitch layer: Only green pixels, transparent elsewhere
    pitch_frame = np.zeros((h, w, 4), dtype=np.uint8)
    pitch_frame[is_green, 0] = b[is_green]
    pitch_frame[is_green, 1] = g[is_green]
    pitch_frame[is_green, 2] = r[is_green]
    pitch_frame[is_green, 3] = 255  # Opaque where green
    # Non-green areas stay transparent (alpha = 0)
    
    # Players layer: Only non-green pixels, transparent elsewhere
    players_frame = np.zeros((h, w, 4), dtype=np.uint8)
    players_frame[~is_green, 0] = b[~is_green]
    players_frame[~is_green, 1] = g[~is_green]
    players_frame[~is_green, 2] = r[~is_green]
    players_frame[~is_green, 3] = 255  # Opaque where non-green
    # Green areas stay transparent (alpha = 0)
    
    return pitch_frame, players_frame


# API Routes
@api_router.post("/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file"""
    try:
        # Generate unique ID
        video_id = str(uuid.uuid4())
        file_ext = Path(file.filename).suffix
        file_path = UPLOADS_DIR / f"{video_id}{file_ext}"
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Save metadata to database
        video_metadata = VideoMetadata(
            id=video_id,
            filename=file.filename,
            original_size=file_size
        )
        
        await db.videos.insert_one(video_metadata.model_dump())
        
        return {
            "success": True,
            "video_id": video_id,
            "filename": file.filename,
            "size": file_size
        }
    
    except Exception as e:
        logging.error(f"Error uploading video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/videos/process/{video_id}")
async def process_video(video_id: str, background_tasks: BackgroundTasks, sensitivity: int = 34):
    """Start processing a video"""
    try:
        # Check if video exists
        video = await db.videos.find_one({"id": video_id})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Find the uploaded file
        video_files = list(UPLOADS_DIR.glob(f"{video_id}.*"))
        if not video_files:
            raise HTTPException(status_code=404, detail="Video file not found")
        
        input_path = str(video_files[0])
        
        # Start background processing
        background_tasks.add_task(process_video_layers, video_id, input_path, sensitivity)
        
        return {
            "success": True,
            "message": "Processing started",
            "video_id": video_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting video processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/videos/status/{video_id}", response_model=ProcessingStatus)
async def get_video_status(video_id: str):
    """Get processing status of a video"""
    try:
        video = await db.videos.find_one({"id": video_id})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        status_messages = {
            "uploaded": "Video uploaded, ready to process",
            "processing": f"Processing video... {video.get('progress', 0):.1f}%",
            "completed": "Processing completed",
            "error": video.get('error_message', 'An error occurred')
        }
        
        return ProcessingStatus(
            status=video['status'],
            progress=video.get('progress', 0.0),
            message=status_messages.get(video['status'], 'Unknown status')
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting video status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/videos/stream/{video_id}/{layer}")
async def stream_video(video_id: str, layer: str):
    """Stream processed video layer"""
    try:
        video = await db.videos.find_one({"id": video_id})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if video['status'] != 'completed':
            raise HTTPException(status_code=400, detail="Video processing not completed")
        
        # Get the appropriate video path
        if layer == 'pitch':
            video_path = video.get('pitch_video_path')
        elif layer == 'players':
            video_path = video.get('players_video_path')
        else:
            raise HTTPException(status_code=400, detail="Invalid layer. Use 'pitch' or 'players'")
        
        if not video_path or not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
        
        # Determine media type based on file extension
        media_type = "video/webm" if video_path.endswith('.webm') else "video/mp4"
        
        return FileResponse(video_path, media_type=media_type)
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error streaming video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/")
async def root():
    return {"message": "Tactical Vision API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
