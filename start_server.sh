#!/bin/bash

# AR Face Try-On Startup Script
# Handles camera permissions and server startup

echo "🎭 AR Face Try-On System - Setup & Start"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "app.py" ]; then
    echo "❌ Error: app.py not found. Please run this script from the face-try-on directory."
    exit 1
fi

# Check if certificates exist, generate if needed
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    echo "🔐 Generating SSL certificates for HTTPS..."
    openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=ARTryOn/CN=localhost" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL certificates generated successfully"
    else
        echo "⚠️  Warning: Could not generate SSL certificates, will use HTTP"
    fi
fi

# Check if models exist, generate if needed
if [ ! -f "models/basic_glasses.gltf" ] || [ ! -f "models/basic_hat.gltf" ]; then
    echo "🎨 Generating sample 3D models..."
    /home/shakaut/Desktop/AR-VR/ar-vr/bin/python generate_models.py
    
    if [ $? -eq 0 ]; then
        echo "✅ Sample models generated successfully"
    else
        echo "❌ Error: Could not generate sample models"
    fi
fi

echo ""
echo "🚀 Starting AR Face Try-On Server..."
echo ""

# Detect if SSL certificates are available
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    SERVER_URL="https://localhost:8000"
    echo "🔒 HTTPS Mode: SSL certificates found"
else
    SERVER_URL="http://localhost:8000"
    echo "🌐 HTTP Mode: No SSL certificates"
fi

echo ""
echo "📱 CAMERA PERMISSION INSTRUCTIONS:"
echo "======================================"
echo "1. Open your browser and navigate to: $SERVER_URL"
echo "2. When prompted, CLICK 'Allow' for camera access"
echo "3. If camera is blocked:"
echo "   - Click the 🔒 lock icon (or ⚙️ settings) in the address bar"
echo "   - Set Camera to 'Allow'"
echo "   - Refresh the page (F5 or Ctrl+R)"
echo ""
echo "🎮 USAGE:"
echo "========="
echo "• Click 'Start Camera' button"
echo "• Select accessory type (glasses/hat)"  
echo "• Choose a 3D model"
echo "• Position your face in the camera view"
echo "• Press 'D' key for debug mode"
echo ""
echo "Server starting at: $SERVER_URL"
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
/home/shakaut/Desktop/AR-VR/ar-vr/bin/python app.py