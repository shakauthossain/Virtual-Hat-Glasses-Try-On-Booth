from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import cv2
import mediapipe as mp
import numpy as np
import json
import base64
from pathlib import Path
import shutil
from typing import List, Dict
import asyncio

app = FastAPI(title="AR Face Try-On Backend")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory setup
MODELS_DIR = Path(__file__).parent / "models"
STATIC_DIR = Path(__file__).parent / "static"
MODELS_DIR.mkdir(exist_ok=True)

# Serve static files and models
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/models", StaticFiles(directory=MODELS_DIR), name="models")

# Initialize MediaPipe Face Mesh with higher precision
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,  # This gives us more precise iris landmarks
    min_detection_confidence=0.7,  # Higher confidence for better accuracy
    min_tracking_confidence=0.7
)

class ConnectionManager:
    """
    Manages WebSocket connections for real-time face tracking communication.
    Handles connection lifecycle, message routing, and error recovery.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

@app.get("/", response_class=HTMLResponse)
async def get_homepage():
    """Serve the main HTML page"""
    html_path = STATIC_DIR / "index.html"
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(), status_code=200)
    return HTMLResponse(content="<h1>AR Face Try-On - Frontend not found</h1>", status_code=404)

@app.get("/api/models")
def list_models():
    """List available 3D models (.glb / .gltf files)"""
    files = []
    for f in MODELS_DIR.glob("*"):
        if f.suffix.lower() in [".glb", ".gltf"]:
            files.append({
                "name": f.name,
                "url": f"/models/{f.name}",
                "type": f.suffix.lower()[1:]  # Remove the dot
            })
    return {"models": files}

@app.post("/api/upload")
async def upload_model(file: UploadFile = File(...)):
    """Upload a new 3D accessory model"""
    if not file.filename:
        return {"error": "No filename provided"}
    
    ext = Path(file.filename).suffix.lower()
    if ext not in [".glb", ".gltf"]:
        return {"error": "Only .glb and .gltf files are allowed"}

    # Save the uploaded file
    dest = MODELS_DIR / file.filename
    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "success": True,
        "filename": file.filename,
        "url": f"/models/{file.filename}",
        "type": ext[1:]
    }

def extract_face_landmarks(image_bytes: bytes) -> Dict:
    """
    Extract facial landmarks from base64 encoded image using MediaPipe Face Mesh.
    
    Args:
        image_bytes: Base64 decoded image bytes
        
    Returns:
        Dict containing landmarks, key points, and detection metadata
        
    Raises:
        Exception: If image processing fails
    """
    try:
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_bytes), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return {"error": "Invalid image data"}

        # Convert BGR to RGB for MediaPipe
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        height, width = rgb_image.shape[:2]

        # Process the image
        results = face_mesh.process(rgb_image)

        if not results.multi_face_landmarks:
            return {"landmarks": None, "detected": False}

        # Extract landmarks for the first detected face
        face_landmarks = results.multi_face_landmarks[0]
        landmarks = []
        
        for landmark in face_landmarks.landmark:
            landmarks.append({
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z
            })

        # Extract key points for accessory positioning and calculate precise measurements
        key_points = extract_key_points(landmarks, width, height)

        return {
            "landmarks": landmarks,
            "key_points": key_points,
            "detected": True,
            "image_width": width,
            "image_height": height
        }

    except Exception as e:
        return {"error": str(e), "detected": False}

def extract_key_points(landmarks: List[Dict], width: int, height: int) -> Dict:
    """Extract key facial points for accessory positioning with enhanced eye detection"""
    
    # Enhanced MediaPipe Face Mesh landmarks for maximum precision
    # Left eye landmarks (including iris when available)
    LEFT_EYE_INNER_CORNER = 133
    LEFT_EYE_OUTER_CORNER = 33
    LEFT_EYE_TOP = 159
    LEFT_EYE_BOTTOM = 145
    LEFT_EYE_CENTER = 468  # Iris center (if available with refined landmarks)
    LEFT_EYE_PUPIL = 469   # Pupil center (if available)
    
    # Right eye landmarks
    RIGHT_EYE_INNER_CORNER = 362
    RIGHT_EYE_OUTER_CORNER = 263
    RIGHT_EYE_TOP = 386
    RIGHT_EYE_BOTTOM = 374
    RIGHT_EYE_CENTER = 473  # Iris center (if available)
    RIGHT_EYE_PUPIL = 474   # Pupil center (if available)
    
    # Fallback eye centers if iris landmarks not available
    LEFT_EYE_CENTER_FALLBACK = 159
    RIGHT_EYE_CENTER_FALLBACK = 386
    
    # Other facial landmarks
    NOSE_TIP = 1
    NOSE_BRIDGE = 168
    FOREHEAD_CENTER = 9
    LEFT_TEMPLE = 21
    RIGHT_TEMPLE = 251
    CHIN = 175

    def get_point(idx):
        if idx < len(landmarks):
            landmark = landmarks[idx]
            return {
                "x": landmark["x"] * width,
                "y": landmark["y"] * height,
                "z": landmark["z"] * width  # Normalize z to width scale
            }
        return None

    def get_safe_point(idx, fallback_idx=None):
        """Get landmark point with fallback for missing refined landmarks"""
        point = get_point(idx)
        if point is None and fallback_idx is not None:
            point = get_point(fallback_idx)
        return point

    # Get detailed eye landmarks with fallbacks
    left_eye_inner = get_point(LEFT_EYE_INNER_CORNER)
    left_eye_outer = get_point(LEFT_EYE_OUTER_CORNER) 
    left_eye_top = get_point(LEFT_EYE_TOP)
    left_eye_bottom = get_point(LEFT_EYE_BOTTOM)
    
    # Try to get iris center, fallback to eye center estimate
    left_eye_center = get_safe_point(LEFT_EYE_CENTER, LEFT_EYE_CENTER_FALLBACK)
    
    right_eye_inner = get_point(RIGHT_EYE_INNER_CORNER)
    right_eye_outer = get_point(RIGHT_EYE_OUTER_CORNER)
    right_eye_top = get_point(RIGHT_EYE_TOP)
    right_eye_bottom = get_point(RIGHT_EYE_BOTTOM)
    
    # Try to get iris center, fallback to eye center estimate  
    right_eye_center = get_safe_point(RIGHT_EYE_CENTER, RIGHT_EYE_CENTER_FALLBACK)
    
    # Validate that we have essential landmarks
    if not all([left_eye_inner, left_eye_outer, right_eye_inner, right_eye_outer, 
               left_eye_center, right_eye_center]):
        print("Warning: Missing essential eye landmarks for glasses positioning")
        return {}
    
    # Calculate precise eye measurements
    left_eye_width = abs(left_eye_outer["x"] - left_eye_inner["x"])
    right_eye_width = abs(right_eye_outer["x"] - right_eye_inner["x"])
    left_eye_height = abs(left_eye_top["y"] - left_eye_bottom["y"]) if left_eye_top and left_eye_bottom else left_eye_width * 0.6
    right_eye_height = abs(right_eye_top["y"] - right_eye_bottom["y"]) if right_eye_top and right_eye_bottom else right_eye_width * 0.6
    
    # Inter-pupillary distance (distance between eye centers) - CRITICAL for glasses sizing
    eye_distance = abs(left_eye_center["x"] - right_eye_center["x"])
    
    # Average eye dimensions
    avg_eye_width = (left_eye_width + right_eye_width) / 2
    avg_eye_height = (left_eye_height + right_eye_height) / 2
    
    # Other facial points
    nose_tip = get_point(NOSE_TIP)
    nose_bridge = get_point(NOSE_BRIDGE)
    forehead = get_point(FOREHEAD_CENTER)
    left_temple = get_point(LEFT_TEMPLE)
    right_temple = get_point(RIGHT_TEMPLE)
    chin = get_point(CHIN)

    # Calculate PRECISE glasses position
    # Position glasses center between pupils, slightly raised to sit on nose bridge
    glasses_center = {
        "x": (left_eye_center["x"] + right_eye_center["x"]) / 2,
        "y": (left_eye_center["y"] + right_eye_center["y"]) / 2 - avg_eye_height * 0.2,  # Slightly above eye level
        "z": (left_eye_center["z"] + right_eye_center["z"]) / 2
    }

    # Hat position (above forehead)
    hat_center = {
        "x": forehead["x"] if forehead else glasses_center["x"],
        "y": (forehead["y"] if forehead else glasses_center["y"]) - 60,
        "z": forehead["z"] if forehead else glasses_center["z"]
    }

    # Face width for reference
    face_width = abs(left_temple["x"] - right_temple["x"]) if left_temple and right_temple else eye_distance * 2.5
    
    # CRITICAL: Calculate glasses dimensions that will actually fit the face
    # Glasses should span from outer corner of left eye to outer corner of right eye plus frame margin
    glasses_span = abs(left_eye_outer["x"] - right_eye_outer["x"]) 
    glasses_width = glasses_span + avg_eye_width * 0.15  # Reduced margin to 15% for tighter fit
    
    result = {
        "glasses": glasses_center,
        "hat": hat_center,
        "face_width": face_width,
        "face_height": abs(forehead["y"] - chin["y"]) if forehead and chin else 200,
        
        # Detailed eye information for PRECISE glasses fitting
        "left_eye": {
            "center": left_eye_center,
            "inner_corner": left_eye_inner,
            "outer_corner": left_eye_outer,
            "top": left_eye_top,
            "bottom": left_eye_bottom,
            "width": left_eye_width,
            "height": left_eye_height
        },
        "right_eye": {
            "center": right_eye_center,
            "inner_corner": right_eye_inner,
            "outer_corner": right_eye_outer,
            "top": right_eye_top,
            "bottom": right_eye_bottom,
            "width": right_eye_width,
            "height": right_eye_height
        },
        
        # CRITICAL measurements for glasses sizing
        "eye_distance": eye_distance,  # Inter-pupillary distance
        "avg_eye_width": avg_eye_width,
        "avg_eye_height": avg_eye_height,
        "glasses_width": glasses_width,  # Actual width glasses should be
        "glasses_span": glasses_span,   # Distance between outer eye corners
        
        # Additional reference points
        "nose_tip": nose_tip,
        "nose_bridge": nose_bridge,
        
        # Quality indicators
        "has_refined_landmarks": len(landmarks) > 468,
        "landmark_count": len(landmarks)
    }
    
    return result

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time face tracking"""
    await manager.connect(websocket)
    print("WebSocket connected")
    
    try:
        while True:
            # Wait for message with timeout
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                if message.get("type") == "frame":
                    # Extract face landmarks from the frame
                    image_data = message.get("image", "")
                    if "," in image_data:
                        image_data = image_data.split(",")[1]  # Remove data:image/jpeg;base64,
                    
                    result = extract_face_landmarks(image_data)
                    
                    # Send landmarks back to frontend
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "landmarks",
                            "data": result
                        }),
                        websocket
                    )
                elif message.get("type") == "ping":
                    # Respond to ping to keep connection alive
                    await manager.send_personal_message(
                        json.dumps({"type": "pong"}),
                        websocket
                    )
                    
            except asyncio.TimeoutError:
                # Send ping to client to check if still alive
                await manager.send_personal_message(
                    json.dumps({"type": "ping"}),
                    websocket
                )
                
    except WebSocketDisconnect:
        print("WebSocket disconnected normally")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Check if SSL certificates exist
    cert_file = "cert.pem"
    key_file = "key.pem"
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("Starting HTTPS server with SSL certificates...")
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=8001,  # Changed to port 8001
            ssl_keyfile=key_file,
            ssl_certfile=cert_file
        )
    else:
        print("Starting HTTP server (no SSL certificates found)...")
        uvicorn.run(app, host="0.0.0.0", port=8001)  # Changed to port 8001