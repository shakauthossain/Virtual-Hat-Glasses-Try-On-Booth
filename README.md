# AR Face Try-On System

A professional-grade real-time augmented reality face try-on application using MediaPipe face detection and Three.js 3D rendering.

## Overview

This system enables users to virtually try on glasses, hats, and other accessories in real-time using their webcam. It combines MediaPipe's advanced face mesh detection with Three.js 3D rendering for precise accessory positioning.

## Architecture

```
┌─────────────────┐    WebSocket    ┌──────────────────┐
│   Frontend      │ ◄──────────────► │    Backend       │
│                 │                  │                  │
│ • Three.js      │                  │ • FastAPI        │
│ • WebRTC        │                  │ • MediaPipe      │
│ • JavaScript    │                  │ • OpenCV         │
└─────────────────┘                  └──────────────────┘
```

## Features

- **Real-time Face Detection**: 468-point MediaPipe Face Mesh
- **Precise Accessory Fitting**: Dynamic positioning based on facial features
- **3D Model Support**: GLB/GLTF format with PBR materials
- **WebSocket Communication**: Low-latency real-time processing
- **Size Adjustments**: Real-time scaling controls
- **Multiple Accessories**: Glasses, hats, and custom models
- **HTTPS Support**: SSL certificates for camera access
- **Debug Visualization**: Face landmarks and fitting guides

## Tech Stack

### Backend
- **FastAPI**: High-performance web framework
- **MediaPipe**: Google's face detection library
- **OpenCV**: Computer vision processing
- **WebSockets**: Real-time communication
- **Python 3.10+**

### Frontend
- **Three.js r128**: 3D rendering engine
- **WebRTC**: Camera access
- **Vanilla JavaScript**: No framework dependencies
- **Three.js r128**: 3D rendering engine
- **WebRTC**: Camera access
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern styling

## Project Structure

```
face-try-on/
├── app.py                     # FastAPI server with MediaPipe integration
├── requirements.txt           # Python dependencies
├── Dockerfile                # Container configuration
├── cert.pem / key.pem        # SSL certificates
├── models/                   # 3D assets directory
│   ├── sunglasses.glb
│   ├── basic_hat.gltf
│   └── ...
├── static/
│   ├── index.html           # Main application interface
│   ├── css/
│   │   └── style.css        # Application styling
│   └── js/
│       ├── main.js          # Application controller
│       ├── webcam.js        # Camera management
│       ├── face-tracking.js # WebSocket & face detection
│       ├── three-scene.js   # 3D rendering engine
│       └── model-manager.js # Asset loading system
└── start_server.sh         # Launch script
```

## Installation

### Prerequisites
- Python 3.10+
- Modern web browser (Chrome/Firefox/Safari)
- Webcam access

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd face-try-on
```

2. **Create virtual environment**
```bash
python -m venv ar-vr
source ar-vr/bin/activate  # Linux/Mac
# or
ar-vr\\Scripts\\activate   # Windows
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Generate SSL certificates** (required for camera access)
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

5. **Start the server**
```bash
python app.py
```

6. **Open in browser**
```
https://localhost:8000
```

## Core Components

### 1. Face Detection Engine (`app.py`)

The backend processes video frames using MediaPipe Face Mesh:

```python
def extract_key_points(landmarks, width, height):
    """Extract facial landmarks for accessory positioning"""
    # 468-point face mesh processing
    # Dynamic face contour calculation
    # Precise eye/nose/ear positioning
    return key_points
```

**Key Features:**
- 468-point face mesh detection
- Dynamic face contour extraction
- Ear position approximation
- Real-time landmark processing

### 2. 3D Rendering Engine (`three-scene.js`)

Handles 3D model loading and positioning:

```javascript
class ThreeJSScene {
    positionAccessory(keyPoints, accessory) {
        // Precise 3D positioning
        // Scale adjustment based on face dimensions
        // Temple-to-ear alignment for glasses
    }
}
```

**Key Features:**
- GLB/GLTF model loading
- Dynamic scaling and positioning
- PBR material support
- Temple alignment for glasses

### 3. WebSocket Communication (`face-tracking.js`)

Real-time communication layer:

```javascript
class FaceTracker {
    async connect() {
        // WebSocket connection
        // Frame sending
        // Landmark receiving
    }
}
```

### 4. Camera Management (`webcam.js`)

Handles video stream processing:

```javascript
class WebcamManager {
    async startCamera() {
        // getUserMedia setup
        // Frame capture
        // Base64 encoding
    }
}
```

## Performance Optimization

### Backend Optimizations
- **Landmark Caching**: Reduces computation overhead
- **Selective Processing**: Only process when face detected
- **WebSocket Compression**: Minimizes data transfer

### Frontend Optimizations  
- **RequestAnimationFrame**: Smooth 60fps rendering
- **Object Pooling**: Reuse Three.js objects
- **Texture Compression**: Optimized asset loading

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC  | ✅     | ✅      | ✅     | ✅   |
| WebGL2  | ✅     | ✅      | ✅     | ✅   |
| WebSocket| ✅    | ✅      | ✅     | ✅   |
| HTTPS Camera| ✅  | ✅      | ✅     | ✅   |

## Troubleshooting

### Camera Issues
```
Error: Camera permission denied
```
**Solution**: Ensure HTTPS is enabled and grant camera permissions

### WebSocket Connection Failed
```
Error: WebSocket connection timeout
```
**Solution**: Check server is running on correct port and SSL certificates exist

### 3D Models Not Loading
```
Error: GLTFLoader not available
```
**Solution**: Verify Three.js r128 is loaded before GLTFLoader

### Face Detection Not Working
```
Error: MediaPipe initialization failed
```
**Solution**: Ensure all Python dependencies are installed correctly

## License

This project is licensed under the MIT License.

## Acknowledgments

- **MediaPipe**: Google's face detection framework
- **Three.js**: 3D rendering library
- **FastAPI**: Modern Python web framework

---

**Built with precision for real-time AR experiences**
- ✅ Create sample 3D models if missing
- ✅ Start the server with proper configuration
- ✅ Show camera permission instructions

### 📱 **Using the Application**

1. **Open Browser**: Navigate to `https://localhost:8000` (or `http://localhost:8000`)
2. **Allow Camera**: Click "Allow" when browser asks for camera permission
3. **Start Session**: Click "Start Camera" button
4. **Select Accessories**: Choose glasses/hat and pick a model
5. **Try It On**: Position your face to see AR overlay!

### 🛠️ **Manual Setup (Alternative)**

### 1. Clone and Setup

```bash
# Navigate to the project directory
cd /home/shakaut/Desktop/AR-VR/face-try-on

# Create and activate virtual environment (recommended)
python -m venv ar-vr-env
source ar-vr-env/bin/activate  # Linux/Mac
# or
ar-vr-env\\Scripts\\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Generate Sample Models

```bash
# Create sample 3D models (glasses and hat)
python generate_models.py
```

### 3. Start the Application

```bash
# Start the FastAPI server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# The application will be available at:
# http://localhost:8000
```

### 4. Using the Application

1. **Open your browser** and navigate to `http://localhost:8000`
2. **Allow camera access** when prompted
3. **Click "Start Camera"** to begin the AR session
4. **Select an accessory type** (glasses or hat) from the dropdown
5. **Choose a 3D model** from the available models
6. **Position your face** in front of the camera to see the overlay

## Project Structure

```
face-try-on/
├── app.py                 # FastAPI backend server
├── requirements.txt       # Python dependencies
├── generate_models.py     # 3D model generator
├── Dockerfile            # Docker configuration
├── README.md             # This file
├── models/               # 3D model storage (.glb/.gltf files)
└── static/               # Frontend files
    ├── index.html        # Main HTML page
    ├── css/
    │   └── style.css     # Styling
    └── js/
        ├── main.js       # Main application controller
        ├── webcam.js     # Camera management
        ├── face-tracking.js  # Face detection integration
        ├── three-scene.js    # 3D rendering with Three.js
        └── model-manager.js  # 3D model loading/management
```

## API Endpoints

### REST Endpoints
- `GET /` - Serve main HTML page
- `GET /api/models` - List available 3D models
- `POST /api/upload` - Upload new 3D model files

### WebSocket
- `WS /ws` - Real-time face tracking data exchange

## Supported 3D Formats

- **.glb** (Binary glTF) - Recommended
- **.gltf** (JSON glTF) - Also supported

## Face Detection Details

The system uses **MediaPipe Face Mesh** which provides:
- **468 face landmarks** for detailed face mapping
- **Real-time performance** (30+ FPS on most hardware)
- **Robust tracking** in various lighting conditions
- **3D coordinates** for accurate depth positioning

### Key Landmark Points Used:
- **Eyes** (landmarks 159, 386) - For glasses positioning
- **Forehead** (landmark 9) - For hat placement
- **Face boundaries** - For scaling and rotation

## Customization

### Adding New Accessories

1. **Create/obtain .glb/.gltf model**
2. **Upload via web interface** or place in `models/` directory
3. **Name convention**: Include "glasses", "hat", etc. in filename for automatic categorization

### Adjusting Positioning

Modify the positioning logic in `static/js/three-scene.js`:

```javascript
// Example: Adjust glasses Y position
if (type === 'glasses') {
    model.position.y += 0.05; // Move up slightly
}
```

## Performance Optimization

### For Better FPS:
- **Reduce video resolution** in `webcam.js`
- **Limit face mesh landmarks** in backend
- **Use simpler 3D models** with fewer polygons
- **Enable hardware acceleration** in browser

### Memory Usage:
- **Model caching** - Models are cached after first load
- **WebSocket buffering** - Frames are processed asynchronously
- **Garbage collection** - Resources cleaned up on stop

## Browser Compatibility

### Fully Supported:
- Chrome 80+
- Firefox 75+  
- Safari 13+
- Edge 80+

### Required Features:
- WebGL 2.0
- WebRTC (getUserMedia)
- WebSocket
- ES6 Modules

## Camera Permission Issues

### ⚠️ **"Camera permission denied" Error**

This is a common security feature in modern browsers. Here are the solutions:

#### **Solution 1: Allow Camera Access (Recommended)**
1. **Look for the camera permission popup** when you first visit the site
2. **Click "Allow"** when prompted
3. If you missed it or clicked "Block":
   - **Chrome/Edge**: Click the 🔒 lock icon or 📷 camera icon in the address bar → Set Camera to "Allow" → Refresh page
   - **Firefox**: Click the 🛡️ shield icon → Permissions → Camera → Allow → Refresh page
   - **Safari**: Safari menu → Settings → Websites → Camera → Allow for localhost

#### **Solution 2: Use HTTPS (More Secure)**
Modern browsers prefer HTTPS for camera access:

```bash
# The system auto-generates SSL certificates and runs HTTPS server
./start_server.sh

# Or manually:
/home/shakaut/Desktop/AR-VR/ar-vr/bin/python app.py
# Visit: https://localhost:8000
```

#### **Solution 3: Browser Flags (Chrome/Edge)**
If still having issues:
1. Go to: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Add: `http://localhost:8000`
3. Set to "Enabled"
4. Restart browser

### 🔍 **Debug Camera Issues**
```bash
# Check if camera is being used by another app:
lsof | grep video

# Test camera directly:
# Visit chrome://settings/content/camera in Chrome
# Or about:permissions in Firefox
```

## Troubleshooting

### Camera Not Working
```bash
# Check camera permissions in browser
# Try different browsers
# Ensure no other apps are using camera
```

### Face Detection Issues
```bash
# Ensure good lighting
# Position face clearly in center
# Check browser console for errors
```

### Performance Problems
```bash
# Close other browser tabs
# Check GPU acceleration: chrome://gpu/
# Reduce video quality in code
```

### WebSocket Connection Failed
```bash
# Check firewall settings
# Verify server is running on correct port
# Try different port: uvicorn app:app --port 8001
```

## Docker Deployment

### Build and Run
```bash
# Build the image
docker build -t ar-face-try-on .

# Run the container
docker run -p 8000:8000 ar-face-try-on

# Access at http://localhost:8000
```

## Development

### Debug Mode
Press `D` key while using the app to toggle debug visualization showing face landmarks.

### Adding Features
The modular architecture makes it easy to extend:
- **New accessory types** - Add to `model-manager.js`
- **Advanced positioning** - Modify `three-scene.js`
- **Additional face features** - Extend MediaPipe processing in `app.py`

## Performance Benchmarks

### Typical Performance:
- **Face Detection**: 30-60 FPS
- **3D Rendering**: 60 FPS  
- **Memory Usage**: ~200MB
- **CPU Usage**: 10-30% (depends on hardware)

## Future Enhancements

- [ ] **Multi-face support** - Handle multiple people
- [ ] **Advanced physics** - Hair/clothing simulation  
- [ ] **Texture mapping** - Apply custom textures
- [ ] **Mobile optimization** - Better touch controls
- [ ] **AR filters** - Instagram-style effects
- [ ] **Export functionality** - Save photos/videos

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Credits

- **MediaPipe** by Google for face detection
- **Three.js** community for 3D graphics
- **FastAPI** for the excellent web framework
- Sample 3D models generated programmatically

## Support

For issues, questions, or contributions:
- 🐛 **Bug reports**: Use GitHub Issues
- 💡 **Feature requests**: Use GitHub Discussions  
- 📧 **Email**: [your-email@example.com]
- 📖 **Documentation**: Check code comments

---

**Happy AR Development!** 🚀✨