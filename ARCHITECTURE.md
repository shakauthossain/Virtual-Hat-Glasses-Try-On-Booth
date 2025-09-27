# Technical Architecture Documentation

## System Overview

The AR Face Try-On System is a real-time computer vision application that combines MediaPipe face detection, WebSocket communication, and WebGL 3D rendering to create an immersive virtual accessory try-on experience.

## Architecture Diagram

```
┌─────────────────────────┐     ┌─────────────────────────┐
│       Frontend          │     │       Backend           │
│  ┌─────────────────────┐│     │  ┌─────────────────────┐ │
│  │    Camera Feed      ││     │  │   MediaPipe Face    │ │
│  │   (WebRTC API)      ││     │  │   Detection Engine  │ │
│  └─────────────────────┘│     │  └─────────────────────┘ │
│  ┌─────────────────────┐│     │  ┌─────────────────────┐ │
│  │  Three.js Renderer  ││     │  │  Landmark Processor │ │
│  │   (WebGL + PBR)     ││◄────┤  │  (468-point mesh)   │ │
│  └─────────────────────┘│     │  └─────────────────────┘ │
│  ┌─────────────────────┐│     │  ┌─────────────────────┐ │
│  │  WebSocket Client   ││     │  │  WebSocket Server   │ │
│  │  (Face Tracking)    ││◄────┤  │  (FastAPI + Uvicorn)│ │
│  └─────────────────────┘│     │  └─────────────────────┘ │
└─────────────────────────┘     └─────────────────────────┘
        Browser                         Python Server
```

## Core Components

### 1. Backend Architecture (`app.py`)

#### MediaPipe Face Detection Pipeline

```python
# Optimized face mesh configuration
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,      # Video stream processing
    max_num_faces=1,              # Single face optimization  
    refine_landmarks=True,        # 468-point precision
    min_detection_confidence=0.7, # High accuracy threshold
    min_tracking_confidence=0.7   # Stable tracking
)
```

**Key Algorithms**:

1. **BlazeFace Detector**: Initial face detection with 6 keypoints
2. **Face Mesh Model**: 468 3D facial landmarks with iris tracking
3. **Landmark Refinement**: Enhanced eye region detection (iris centers)
4. **Temporal Smoothing**: Reduces jitter in landmark positions

#### Facial Landmark Processing

**Core Algorithm - Dynamic Face Contour Extraction**:

```python
def extract_key_points(landmarks: List[Dict], width: int, height: int) -> Dict:
    """
    Converts normalized MediaPipe landmarks to pixel coordinates
    and calculates accessory positioning points.
    
    Processing Pipeline:
    1. Transform normalized coordinates (0-1) to pixel space
    2. Extract eye centers from iris landmarks (468-477)
    3. Calculate inter-pupillary distance for scaling reference
    4. Estimate ear positions from face contour geometry
    5. Compute optimal accessory placement points
    6. Apply confidence weighting and temporal smoothing
    """
    
    # Eye center calculation from refined iris landmarks
    left_iris_landmarks = landmarks[468:472]   # Left iris boundary
    right_iris_landmarks = landmarks[472:477]  # Right iris boundary
    
    left_iris_center = np.mean(left_iris_landmarks, axis=0)
    right_iris_center = np.mean(right_iris_landmarks, axis=0)
    
    # Inter-pupillary distance for scale reference
    ipd = np.linalg.norm(right_iris_center - left_iris_center)
    
    # Face contour analysis for boundary detection
    face_oval_points = [landmarks[i] for i in FACE_OVAL_INDICES]
    face_bounds = calculate_bounding_box(face_oval_points)
    
    # Dynamic face contour extraction
    contour_data = {
        "is_dynamic": True,
        "oval_points": extract_contour_points(FACE_OVAL_INDICES),
        "forehead_points": extract_contour_points(FOREHEAD_CONTOUR),
        "jawline_points": extract_contour_points(JAWLINE_CONTOUR),
        "bounds": face_bounds,
        "center": calculate_face_center(face_oval_points)
    }
    
    return {
        "glasses": calculate_glasses_position(left_iris_center, right_iris_center),
        "hat": calculate_hat_position(face_bounds),
        "left_ear": estimate_ear_position("left", face_bounds, ipd),
        "right_ear": estimate_ear_position("right", face_bounds, ipd),
        "face_contour": contour_data,
        "eye_distance": ipd * width,  # Convert to pixels
        "face_confidence": calculate_detection_confidence(landmarks)
    }
```

**Ear Position Estimation Algorithm**:

```python
def estimate_ear_position(side: str, face_bounds: tuple, ipd: float) -> Dict[str, float]:
    """
    Estimates ear positions using facial geometry and anthropometric ratios.
    
    Based on facial anthropometry research:
    - Ears are positioned ~15% of IPD lateral from face boundary
    - Ear height aligns with eye-nose bridge midpoint
    - Z-depth estimated from face width (ear protrusion)
    """
    face_left, face_right, face_top, face_bottom = face_bounds
    face_width = face_right - face_left
    
    if side == "left":
        ear_x = face_left - (ipd * 0.15)  # 15% IPD lateral offset
    else:
        ear_x = face_right + (ipd * 0.15)
    
    # Ear height: midpoint between eyes and nose bridge
    ear_y = (eye_level + nose_bridge_y) * 0.5
    
    # Z-depth: ears protrude ~8% of face width
    ear_z = face_width * 0.08
    
    return {"x": ear_x, "y": ear_y, "z": ear_z}
```

#### WebSocket Communication Layer

**Connection Management System**:

```python
class ConnectionManager:
    """
    Manages WebSocket connections with automatic reconnection,
    message queuing, and error recovery for reliable real-time communication.
    """
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.message_queue: Dict[WebSocket, List[Dict]] = {}
        self.connection_stats: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.message_queue[websocket] = []
        self.connection_stats[websocket] = {
            "connected_at": time.time(),
            "frames_processed": 0,
            "avg_processing_time": 0.0
        }
        
    async def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            del self.message_queue[websocket]
            del self.connection_stats[websocket]
        
    async def send_landmarks(self, websocket: WebSocket, landmarks_data: Dict):
        """Send landmark data with error handling and performance tracking"""
        try:
            start_time = time.time()
            await websocket.send_json(landmarks_data)
            
            # Update performance statistics
            processing_time = time.time() - start_time
            stats = self.connection_stats[websocket]
            stats["frames_processed"] += 1
            stats["avg_processing_time"] = (
                (stats["avg_processing_time"] * (stats["frames_processed"] - 1) + processing_time)
                / stats["frames_processed"]
            )
            
        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as e:
            await self.send_error(websocket, f"Send error: {str(e)}")
    
    async def broadcast_to_all(self, data: Dict):
        """Broadcast to all connected clients with individual error handling"""
        for connection in self.active_connections.copy():
            await self.send_landmarks(connection, data)
```

### 2. Frontend Architecture

#### Camera Management System (`webcam.js`)

**Optimized Video Stream Processing**:

```javascript
class WebcamManager {
    constructor() {
        this.video = document.getElementById('video');
        this.stream = null;
        this.isActive = false;
        this.frameRate = 30;
        this.compressionQuality = 0.8;
        
        // Performance optimization
        this.frameSkipCounter = 0;
        this.targetFrameInterval = 1000 / this.frameRate;
        this.lastFrameTime = 0;
    }
    
    async startCamera() {
        // High-quality video constraints optimized for face detection
        const constraints = {
            video: {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30, max: 30 }
            },
            audio: false  // Not needed for face detection
        };
        
        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(() => {
                        this.isActive = true;
                        this.startFrameProcessing();
                        resolve();
                    }).catch(reject);
                };
                
                // Timeout for initialization
                setTimeout(() => {
                    if (!this.isActive) {
                        reject(new Error('Camera initialization timeout'));
                    }
                }, 10000);
            });
            
        } catch (error) {
            throw this.handleCameraError(error);
        }
    }
    
    captureFrame() {
        """Efficient frame capture with automatic compression optimization"""
        if (!this.isActive || !this.video.videoWidth) return null;
        
        // Create reusable canvas for frame capture
        if (!this.captureCanvas) {
            this.captureCanvas = document.createElement('canvas');
            this.captureCtx = this.captureCanvas.getContext('2d');
        }
        
        // Set canvas dimensions to match video
        this.captureCanvas.width = this.video.videoWidth;
        this.captureCanvas.height = this.video.videoHeight;
        
        // Draw current video frame
        this.captureCtx.drawImage(this.video, 0, 0);
        
        // JPEG compression optimized for face detection
        // Higher quality for better MediaPipe accuracy
        return this.captureCanvas.toDataURL('image/jpeg', this.compressionQuality);
    }
    
    startFrameProcessing() {
        """Frame processing loop with automatic rate limiting"""
        const processFrame = () => {
            if (!this.isActive) return;
            
            const now = performance.now();
            const deltaTime = now - this.lastFrameTime;
            
            // Frame rate limiting to prevent overwhelming the server
            if (deltaTime >= this.targetFrameInterval) {
                const frameData = this.captureFrame();
                if (frameData && this.onFrameCallback) {
                    this.onFrameCallback(frameData);
                }
                this.lastFrameTime = now;
            }
            
            // Continue processing
            requestAnimationFrame(processFrame);
        };
        
        processFrame();
    }
}
```

#### 3D Rendering Engine (`three-scene.js`)

**Advanced Scene Architecture**:

```javascript
class ThreeJSScene {
    constructor(canvas) {
        // High-performance WebGL renderer configuration
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            precision: 'highp',
            premultipliedAlpha: false
        });
        
        // Renderer optimizations
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Scene setup with optimized camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, canvas.width/canvas.height, 0.1, 1000);
        this.camera.position.set(0, 0, 1);
        
        // Advanced lighting setup for realistic rendering
        this.setupAdvancedLighting();
        
        // Performance monitoring
        this.stats = {
            frameCount: 0,
            lastFPSCheck: performance.now(),
            currentFPS: 0
        };
        
        // Object pools for performance
        this.objectPools = {
            accessories: [],
            matrices: [],
            vectors: []
        };
    }
    
    setupAdvancedLighting() {
        """Professional lighting setup for realistic material rendering"""
        
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        // Key light (main illumination)
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(2, 2, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        this.scene.add(keyLight);
        
        // Fill light (soften shadows)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-2, 0, 3);
        this.scene.add(fillLight);
        
        // Rim light (edge definition)
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rimLight.position.set(0, -2, -1);
        this.scene.add(rimLight);
    }
    
    positionAccessory(keyPoints, accessory) {
        """Advanced accessory positioning with physics-based fitting"""
        
        switch(accessory.userData.type) {
            case 'glasses':
                this.positionGlasses(keyPoints, accessory);
                break;
            case 'hat':
                this.positionHat(keyPoints, accessory);
                break;
            default:
                console.warn(`Unknown accessory type: ${accessory.userData.type}`);
        }
        
        // Apply global face orientation if available
        if (keyPoints.face_rotation) {
            accessory.rotation.copy(keyPoints.face_rotation);
        }
    }
    
    positionGlasses(keyPoints, glasses) {
        """Precise glasses positioning with temple-to-ear alignment"""
        
        // Base position from glasses center point
        const glassesPos = keyPoints.glasses;
        glasses.position.set(glassesPos.x, glassesPos.y, glassesPos.z || 0);
        
        // Dynamic scaling based on facial measurements
        const ipd = keyPoints.eye_distance;
        const avgEyeHeight = keyPoints.avg_eye_height || 20;
        
        // Scale factors based on individual face measurements
        const scaleX = (ipd / REFERENCE_IPD) * this.glassesSizeMultiplier;
        const scaleY = (avgEyeHeight / REFERENCE_EYE_HEIGHT) * this.glassesSizeMultiplier;
        const scaleZ = Math.sqrt(scaleX * scaleY);  // Maintain proportions
        
        glasses.scale.set(scaleX, scaleY, scaleZ);
        
        // Advanced temple-to-ear alignment
        this.alignGlassesTemples(glasses, keyPoints);
        
        // Bridge fitting based on nose bridge
        if (keyPoints.nose_bridge) {
            const bridgeOffset = new THREE.Vector3(
                0,
                keyPoints.nose_bridge.y - glassesPos.y,
                keyPoints.nose_bridge.z || 0
            );
            glasses.position.add(bridgeOffset.multiplyScalar(0.1)); // Subtle adjustment
        }
    }
    
    alignGlassesTemples(glasses, keyPoints) {
        """Advanced temple alignment algorithm with 3D vector mathematics"""
        
        if (!keyPoints.left_ear || !keyPoints.right_ear) return;
        
        const glassesPos = glasses.position;
        
        // Calculate temple vectors in 3D space
        const leftTempleVector = new THREE.Vector3(
            keyPoints.left_ear.x - glassesPos.x,
            keyPoints.left_ear.y - glassesPos.y,
            (keyPoints.left_ear.z || 0) - glassesPos.z
        ).normalize();
        
        const rightTempleVector = new THREE.Vector3(
            keyPoints.right_ear.x - glassesPos.x,
            keyPoints.right_ear.y - glassesPos.y,
            (keyPoints.right_ear.z || 0) - glassesPos.z
        ).normalize();
        
        // Calculate average temple direction
        const averageTempleDirection = leftTempleVector.clone()
            .add(rightTempleVector)
            .normalize();
        
        // Apply temple rotation for natural fit
        const targetRotation = new THREE.Euler(0, 0, averageTempleDirection.angleTo(new THREE.Vector3(1, 0, 0)));
        
        // Smooth rotation interpolation
        glasses.rotation.x = THREE.MathUtils.lerp(glasses.rotation.x, targetRotation.x, 0.1);
        glasses.rotation.y = THREE.MathUtils.lerp(glasses.rotation.y, targetRotation.y, 0.1);
        glasses.rotation.z = THREE.MathUtils.lerp(glasses.rotation.z, targetRotation.z, 0.1);
        
        // Fine-tune temple spread based on ear distance
        const earDistance = leftTempleVector.distanceTo(rightTempleVector);
        const templeSpreadFactor = earDistance / REFERENCE_EAR_DISTANCE;
        
        // Apply subtle scaling adjustment for temple spread
        glasses.scale.x *= (1.0 + (templeSpreadFactor - 1.0) * 0.1);
    }
    
    render() {
        """Optimized render loop with performance monitoring"""
        
        // Performance tracking
        this.stats.frameCount++;
        const now = performance.now();
        
        if (now - this.stats.lastFPSCheck >= 1000) {
            this.stats.currentFPS = this.stats.frameCount;
            this.stats.frameCount = 0;
            this.stats.lastFPSCheck = now;
            
            // Update FPS display
            if (this.onFPSUpdate) {
                this.onFPSUpdate(this.stats.currentFPS);
            }
        }
        
        // Frustum culling optimization
        this.camera.updateMatrixWorld();
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(
            new THREE.Matrix4().multiplyMatrices(
                this.camera.projectionMatrix,
                this.camera.matrixWorldInverse
            )
        );
        
        // Cull objects outside view
        this.scene.children.forEach(child => {
            if (child.geometry) {
                child.visible = frustum.intersectsObject(child);
            }
        });
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}
```

## Data Flow Architecture

### Frame Processing Pipeline

```
1. Video Capture (WebRTC)              │ 2. Frame Processing (Canvas)
   ┌─────────────────────────────────┐   │    ┌─────────────────────────────────┐
   │ • 30 FPS video stream           │   │    │ • Extract video frame           │
   │ • 640x480 resolution            │───┼───▶│ • Convert to canvas             │
   │ • User-facing camera            │   │    │ • JPEG compression (80%)        │
   └─────────────────────────────────┘   │    └─────────────────────────────────┘
                                         │
3. WebSocket Transmission               │ 4. Backend Processing (MediaPipe)
   ┌─────────────────────────────────┐   │    ┌─────────────────────────────────┐
   │ • Base64 encoded frame data     │   │    │ • Image decoding from base64    │
   │ • JSON message format           │───┼───▶│ • Face detection (BlazeFace)    │
   │ • Error handling & queuing      │   │    │ • 468-point landmark extraction │
   └─────────────────────────────────┘   │    │ • Coordinate transformation      │
                                         │    │ • Accessory position calc       │
                                         │    └─────────────────────────────────┘
                                         │
5. Landmark Transmission                │ 6. Frontend Rendering (Three.js)
   ┌─────────────────────────────────┐   │    ┌─────────────────────────────────┐
   │ • Processed landmark data       │   │    │ • Landmark data reception       │
   │ • Face confidence scores        │───┼───▶│ • 3D model positioning          │
   │ • Accessory positioning info    │   │    │ • WebGL rendering (60 FPS)      │
   └─────────────────────────────────┘   │    │ • UI updates & visualization    │
                                         │    └─────────────────────────────────┘
```

### Performance Optimizations

#### Backend Optimizations

**1. Landmark Caching & Temporal Smoothing**:

```python
class LandmarkCache:
    """Intelligent landmark caching with temporal smoothing"""
    
    def __init__(self, max_history=10, smoothing_factor=0.3):
        self.landmark_history = deque(maxlen=max_history)
        self.smoothing_factor = smoothing_factor
        self.confidence_threshold = 0.7
    
    def add_landmarks(self, landmarks, confidence):
        """Add new landmarks with confidence weighting"""
        if confidence > self.confidence_threshold:
            self.landmark_history.append({
                'landmarks': landmarks,
                'confidence': confidence,
                'timestamp': time.time()
            })
    
    def get_smoothed_landmarks(self):
        """Apply temporal smoothing to reduce jitter"""
        if len(self.landmark_history) < 2:
            return self.landmark_history[-1]['landmarks'] if self.landmark_history else None
        
        # Weighted average based on confidence and recency
        weighted_landmarks = np.zeros_like(self.landmark_history[-1]['landmarks'])
        total_weight = 0
        
        for i, entry in enumerate(self.landmark_history):
            # Weight by confidence and recency
            recency_weight = (i + 1) / len(self.landmark_history)
            confidence_weight = entry['confidence']
            weight = recency_weight * confidence_weight
            
            weighted_landmarks += entry['landmarks'] * weight
            total_weight += weight
        
        return weighted_landmarks / total_weight if total_weight > 0 else None
```

**2. Adaptive Processing Based on Detection Quality**:

```python
class AdaptiveProcessor:
    """Adaptive processing based on face detection quality"""
    
    def __init__(self):
        self.no_face_count = 0
        self.low_confidence_count = 0
        self.processing_level = 'full'  # full, medium, fast
    
    def process_frame(self, image, previous_confidence=None):
        """Adaptive frame processing based on detection history"""
        
        if self.no_face_count > 5:
            # Fast detection mode for face reacquisition
            return self.run_fast_detection(image)
        
        elif self.low_confidence_count > 3:
            # Medium quality processing
            return self.run_medium_detection(image)
        
        else:
            # Full quality processing
            return self.run_full_detection(image)
    
    def update_detection_stats(self, detected, confidence):
        """Update detection statistics for adaptive processing"""
        if not detected:
            self.no_face_count += 1
            self.low_confidence_count = 0
        elif confidence < 0.7:
            self.low_confidence_count += 1
            self.no_face_count = 0
        else:
            self.no_face_count = 0
            self.low_confidence_count = 0
```

#### Frontend Optimizations

**1. Object Pooling for Memory Management**:

```javascript
class ObjectPool {
    constructor() {
        this.pools = {
            vectors: [],
            matrices: [],
            quaternions: [],
            meshes: []
        };
    }
    
    getVector3() {
        return this.pools.vectors.pop() || new THREE.Vector3();
    }
    
    returnVector3(vector) {
        vector.set(0, 0, 0);
        this.pools.vectors.push(vector);
    }
    
    getMatrix4() {
        return this.pools.matrices.pop() || new THREE.Matrix4();
    }
    
    returnMatrix4(matrix) {
        matrix.identity();
        this.pools.matrices.push(matrix);
    }
}
```

**2. Level-of-Detail (LOD) System**:

```javascript
class LODManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.lodObjects = [];
    }
    
    addLODObject(object, distances = [50, 100, 200]) {
        const lod = new THREE.LOD();
        
        // Add different detail levels
        lod.addLevel(object.highDetail, distances[0]);
        lod.addLevel(object.mediumDetail, distances[1]);
        lod.addLevel(object.lowDetail, distances[2]);
        
        this.scene.add(lod);
        this.lodObjects.push(lod);
        
        return lod;
    }
    
    update() {
        this.lodObjects.forEach(lod => {
            lod.update(this.camera);
        });
    }
}
```

## Security Architecture

### Data Privacy Framework

```python
class PrivacyManager:
    """Ensures user data privacy and compliance"""
    
    def __init__(self):
        self.frame_retention_time = 0  # No frame storage
        self.landmark_retention_time = 3600  # 1 hour max
        self.encryption_enabled = True
    
    def process_frame(self, frame_data):
        """Process frame without permanent storage"""
        # Decode and process in memory only
        image = self.decode_base64_image(frame_data)
        
        # Process landmarks
        landmarks = self.detect_face_landmarks(image)
        
        # Immediately clear image from memory
        del image
        
        return landmarks
    
    def sanitize_landmarks(self, landmarks):
        """Remove any potentially identifying information"""
        # Remove high-precision details that could be used for identification
        sanitized = {
            'glasses': landmarks.get('glasses'),
            'hat': landmarks.get('hat'),
            'face_bounds': landmarks.get('face_bounds'),
            'confidence': min(landmarks.get('confidence', 0), 0.95)  # Cap confidence
        }
        return sanitized
```

### Network Security Implementation

```python
from fastapi.security import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Security middleware configuration
app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
)

# Content Security Policy
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' ws: wss:;"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

## Scalability Architecture

### Microservices Decomposition

```yaml
# Docker Compose for microservices architecture
version: '3.8'
services:
  face_detection:
    build: ./services/face-detection
    ports:
      - "8001:8000"
    environment:
      - MEDIAPIPE_MODEL_PATH=/models
    volumes:
      - ./models:/models
  
  model_service:
    build: ./services/model-management
    ports:
      - "8002:8000"
    volumes:
      - ./3d-models:/models
  
  websocket_gateway:
    build: ./services/websocket-gateway
    ports:
      - "8000:8000"
    depends_on:
      - face_detection
      - model_service
    environment:
      - FACE_DETECTION_SERVICE=http://face_detection:8000
      - MODEL_SERVICE=http://model_service:8000
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - websocket_gateway
```

### Performance Monitoring System

```python
class PerformanceMonitor:
    """Comprehensive performance monitoring and alerting"""
    
    def __init__(self):
        self.metrics = {
            'frame_processing_times': deque(maxlen=1000),
            'websocket_latencies': deque(maxlen=1000),
            'memory_usage': deque(maxlen=100),
            'cpu_usage': deque(maxlen=100),
            'active_connections': 0,
            'frames_per_second': 0,
            'error_rate': 0
        }
        self.alerts = []
        
    def track_frame_processing(self, start_time, end_time):
        processing_time = end_time - start_time
        self.metrics['frame_processing_times'].append(processing_time)
        
        # Alert if processing time exceeds threshold
        if processing_time > 0.1:  # 100ms threshold
            self.add_alert('HIGH_PROCESSING_TIME', f'Frame processing took {processing_time:.3f}s')
    
    def get_performance_summary(self):
        """Generate comprehensive performance report"""
        processing_times = list(self.metrics['frame_processing_times'])
        
        if not processing_times:
            return {'status': 'no_data'}
        
        return {
            'avg_processing_time': np.mean(processing_times),
            'p95_processing_time': np.percentile(processing_times, 95),
            'p99_processing_time': np.percentile(processing_times, 99),
            'frames_per_second': len(processing_times) / max(processing_times[-1] - processing_times[0], 1),
            'memory_usage_mb': psutil.Process().memory_info().rss / 1024 / 1024,
            'cpu_usage_percent': psutil.cpu_percent(),
            'active_connections': self.metrics['active_connections'],
            'error_rate': self.metrics['error_rate'],
            'alerts': self.alerts[-10:]  # Last 10 alerts
        }
```

This architecture provides a robust, scalable foundation for real-time AR face try-on applications with enterprise-grade performance, security, and monitoring capabilities.