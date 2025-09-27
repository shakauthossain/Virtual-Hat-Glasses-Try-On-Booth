# API Documentation

## Overview

The AR Face Try-On System provides RESTful HTTP endpoints and WebSocket connections for real-time face tracking and 3D model management.

**Base URL**: `https://localhost:8000`

## Authentication

No authentication required for local development. Production deployments should implement proper authentication mechanisms.

## HTTP Endpoints

### 1. Get Application

**Endpoint**: `GET /`

**Description**: Serves the main web application interface

**Response**: HTML page

**Example**:
```bash
curl https://localhost:8000/
```

### 2. List Available Models

**Endpoint**: `GET /api/models`

**Description**: Returns a list of all available 3D accessories

**Response**:
```json
{
  "models": [
    {
      "id": "sunglasses",
      "name": "Sunglasses",
      "type": "glasses",
      "file": "sunglasses.glb",
      "url": "/models/sunglasses.glb"
    },
    {
      "id": "basic_hat",
      "name": "Basic Hat", 
      "type": "hat",
      "file": "basic_hat.gltf",
      "url": "/models/basic_hat.gltf"
    }
  ]
}
```

**Example**:
```bash
curl https://localhost:8000/api/models
```

### 3. Upload Custom Model

**Endpoint**: `POST /api/upload`

**Description**: Upload a new 3D accessory model

**Content-Type**: `multipart/form-data`

**Parameters**:
- `file`: GLB or GLTF file (max 10MB)

**Success Response**:
```json
{
  "success": true,
  "filename": "custom_glasses.glb",
  "message": "File uploaded successfully"
}
```

**Error Response**:
```json
{
  "error": "Only .glb and .gltf files are allowed"
}
```

**Example**:
```bash
curl -X POST https://localhost:8000/api/upload \
  -F "file=@custom_glasses.glb"
```

### 4. Static File Access

**Endpoint**: `GET /models/{filename}`

**Description**: Serves 3D model files

**Example**:
```bash
curl https://localhost:8000/models/sunglasses.glb
```

**Endpoint**: `GET /static/{path}`

**Description**: Serves static assets (CSS, JS, images)

**Example**:
```bash
curl https://localhost:8000/static/css/style.css
```

## WebSocket Connection

### Connection Details

**Endpoint**: `wss://localhost:8000/ws` (HTTPS) or `ws://localhost:8000/ws` (HTTP)

**Protocol**: WebSocket with JSON message format

**Connection Example**:
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

socket.onopen = () => {
    console.log('Connected to face tracking server');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleLandmarkData(data);
};
```

### Client to Server Messages

#### Frame Data

**Message Type**: `frame`

**Purpose**: Send video frame for face detection

**Format**:
```json
{
  "type": "frame",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "timestamp": 1640995200000
}
```

**Fields**:
- `type`: Always "frame"
- `data`: Base64-encoded JPEG image
- `timestamp`: Client timestamp (optional)

### Server to Client Messages

#### Landmark Data

**Message Type**: `landmarks`

**Purpose**: Face detection results with accessory positioning data

**Format**:
```json
{
  "type": "landmarks",
  "detected": true,
  "key_points": {
    "glasses": {"x": 320, "y": 180, "z": 0},
    "left_eye": {"x": 295, "y": 175, "z": -2},
    "right_eye": {"x": 345, "y": 175, "z": -2},
    "nose_bridge": {"x": 320, "y": 190, "z": 0},
    "hat": {"x": 320, "y": 120, "z": 0},
    "left_ear": {"x": 280, "y": 180, "z": 10},
    "right_ear": {"x": 360, "y": 180, "z": 10},
    "eye_distance": 50.5,
    "glasses_width": 120.8,
    "face_width": 180.2,
    "face_height": 220.5,
    "face_confidence": 0.95,
    "face_contour": {
      "is_dynamic": true,
      "oval_points": [
        {"x": 160, "y": 100},
        {"x": 170, "y": 105},
        {"x": 180, "y": 115}
      ],
      "bounds": [140, 480, 80, 380],
      "center": {"x": 320, "y": 230}
    }
  },
  "processing_time": 23.5,
  "timestamp": 1640995200100
}
```

**Key Points Description**:
- `glasses`: Optimal glasses center position
- `left_eye`/`right_eye`: Eye center coordinates
- `nose_bridge`: Glasses bridge position
- `hat`: Hat placement position
- `left_ear`/`right_ear`: Estimated ear positions for temples
- `eye_distance`: Inter-pupillary distance in pixels
- `glasses_width`: Recommended glasses width
- `face_width`/`face_height`: Face dimensions
- `face_confidence`: Detection confidence (0-1)
- `face_contour`: Dynamic face boundary data

#### Error Messages

**Message Type**: `error`

**Purpose**: Error notifications

**Format**:
```json
{
  "type": "error",
  "code": "FACE_NOT_DETECTED",
  "message": "No face detected in frame",
  "timestamp": 1640995200000
}
```

**Error Codes**:
- `FACE_NOT_DETECTED`: No face found in image
- `INVALID_IMAGE_FORMAT`: Image format not supported
- `PROCESSING_FAILED`: MediaPipe processing error
- `CONNECTION_ERROR`: WebSocket connection issue

## MediaPipe Integration

### Face Detection Configuration

```python
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,          # Video stream mode
    max_num_faces=1,                  # Single face detection
    refine_landmarks=True,            # 468-point precision
    min_detection_confidence=0.7,     # Detection threshold
    min_tracking_confidence=0.7       # Tracking threshold
)
```

### Landmark Indices

**Eye Centers**: 
- Left iris: landmarks 468-471
- Right iris: landmarks 472-477

**Face Contour**:
- Face oval: landmarks 10, 338, 297, 332, 284, 251...
- Forehead: landmarks 9, 10, 151, 337, 299, 333...
- Jawline: landmarks 172, 136, 150, 149, 176, 148...

**Ear Approximation**:
- Calculated from face contour geometry
- Left ear: face_left - (ipd * 0.15)
- Right ear: face_right + (ipd * 0.15)

## Performance Metrics

### Latency Expectations

- **Frame Processing**: 20-30ms per frame
- **WebSocket Round-trip**: 5-15ms on localhost
- **Total Latency**: 25-45ms end-to-end

### Throughput

- **Input**: 30 FPS video frames
- **Output**: Real-time landmark data
- **Bandwidth**: ~50KB/s for frame data

### Resource Usage

- **CPU**: 15-25% on modern processors
- **Memory**: 200-400MB RAM
- **GPU**: WebGL for frontend rendering

## Error Handling

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (invalid file format)
- `413`: Payload Too Large (file size exceeded)
- `500`: Internal Server Error

### WebSocket Error Handling

**Connection Errors**:
```javascript
socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    // Implement reconnection logic
};

socket.onclose = (event) => {
    if (event.code !== 1000) {
        // Unexpected close, attempt reconnection
        setTimeout(() => reconnect(), 1000);
    }
};
```

**Message Validation**:
```javascript
socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'error') {
            handleError(data);
        } else {
            processLandmarks(data);
        }
    } catch (error) {
        console.error('Invalid message format:', error);
    }
};
```

## Security Considerations

### HTTPS Requirements

- Camera access requires HTTPS in modern browsers
- WebSocket connections upgrade to WSS automatically
- SSL certificates must be properly configured

### File Upload Security

- File type validation (only .glb/.gltf)
- File size limits (10MB maximum)
- No server-side execution of uploaded files
- Sanitized filename handling

### CORS Policy

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Restrict in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

## Rate Limiting

### WebSocket Frame Rate

- Maximum 30 FPS frame submission
- Automatic frame dropping if processing queue full
- Client-side frame rate limiting recommended

### HTTP Endpoints

- File upload: 1 request per second per IP
- Model listing: No limits (cacheable)
- Static assets: Standard web server limits

## Development Tools

### Testing WebSocket Connection

```javascript
// Test connection in browser console
const testWS = new WebSocket('wss://localhost:8000/ws');
testWS.onopen = () => console.log('Connected');
testWS.onmessage = (e) => console.log('Received:', e.data);
testWS.send(JSON.stringify({type: 'test'}));
```

### Debug Mode

```javascript
// Enable debug visualization
app.debugMode = true;

// Shows:
// - Face landmark points
// - Bounding boxes  
// - FPS counter
// - WebSocket status
```

## Integration Examples

### React Component

```jsx
import React, { useEffect, useRef } from 'react';

const ARFaceTryOn = () => {
    const wsRef = useRef(null);
    const videoRef = useRef(null);
    
    useEffect(() => {
        // Initialize WebSocket connection
        wsRef.current = new WebSocket('wss://localhost:8000/ws');
        
        wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'landmarks') {
                updateAccessoryPositions(data.key_points);
            }
        };
        
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);
    
    const sendFrame = () => {
        if (videoRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            
            const frameData = canvas.toDataURL('image/jpeg', 0.8);
            wsRef.current.send(JSON.stringify({
                type: 'frame',
                data: frameData
            }));
        }
    };
    
    return (
        <div>
            <video ref={videoRef} autoPlay muted />
            <button onClick={sendFrame}>Process Frame</button>
        </div>
    );
};

export default ARFaceTryOn;
```

### Python Client

```python
import asyncio
import websockets
import json
import base64

async def face_tracking_client():
    uri = "ws://localhost:8000/ws"
    
    async with websockets.connect(uri) as websocket:
        # Send test frame
        with open("test_face.jpg", "rb") as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
            
        message = {
            "type": "frame",
            "data": f"data:image/jpeg;base64,{image_data}"
        }
        
        await websocket.send(json.dumps(message))
        
        # Receive landmarks
        response = await websocket.recv()
        data = json.loads(response)
        
        if data['type'] == 'landmarks':
            print("Face detected!")
            print(f"Glasses position: {data['key_points']['glasses']}")
            print(f"Confidence: {data['key_points']['face_confidence']}")

asyncio.run(face_tracking_client())
```

This API documentation provides complete integration details for developers working with the AR Face Try-On system.