/**
 * Real-time face tracking module using WebSocket communication
 * Handles facial landmark detection, processing, and visualization
 */
class FaceTracker {
    /**
     * Initialize FaceTracker with WebSocket connection management
     * Sets up debug visualization and performance monitoring
     */
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.lastLandmarks = null;
        this.onLandmarksCallback = null;
        this.onStatusCallback = null;
        
        // Debug canvas for landmark visualization
        this.debugCanvas = null;
        this.debugCtx = null;
        
        try {
            this.initDebugCanvas();
        } catch (error) {
            console.error('Failed to initialize debug canvas:', error);
        }
        
        // Skeleton visibility control
        this.isSkeletonVisible = true;
        
        // Performance tracking
        this.fpsCounter = 0;
        this.lastFpsTime = Date.now();
    }

    /**
     * Establish WebSocket connection to face tracking backend
     * @returns {Promise<void>} Resolves when connection is established
     * @throws {Error} If WebSocket connection fails
     */
    async connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.socket = new WebSocket(wsUrl);
            
            return new Promise((resolve, reject) => {
                this.socket.onopen = () => {
                    this.isConnected = true;
                    this.updateStatus('Connected to face tracking server');
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    try {
                        this.handleMessage(JSON.parse(event.data));
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.socket.onclose = (event) => {
                    this.isConnected = false;
                    this.updateStatus('Disconnected from server');
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                // Add timeout for connection
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 5000);
            });
        } catch (error) {
            console.error('Failed to connect to face tracking server:', error);
            throw error;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
    }

    /**
     * Send video frame for face detection
     */
    sendFrame(imageData) {
        if (!this.isConnected || !this.socket) return;

        const message = {
            type: 'frame',
            image: imageData
        };

        this.socket.send(JSON.stringify(message));
    }

    /**
     * Handle incoming messages from server
     */
    handleMessage(message) {
        if (message.type === 'landmarks') {
            this.handleLandmarks(message.data);
            this.updateFPS();
        }
    }

    /**
     * Process received face landmarks
     */
    handleLandmarks(data) {
        if (data.detected && data.landmarks) {
            this.lastLandmarks = data;
            
            // Draw debug landmarks if enabled
            this.drawDebugLandmarks(data);
            
            // Call landmarks callback
            if (this.onLandmarksCallback) {
                this.onLandmarksCallback(data);
            }
        } else {
            this.lastLandmarks = null;
            this.clearDebugCanvas();
        }
    }

    /**
     * Draw debug landmarks on canvas
     */
    drawDebugLandmarks(data) {
        if (!data.landmarks || !this.debugCanvas || !this.isSkeletonVisible) return;

        const ctx = this.debugCtx;
        const canvas = this.debugCanvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw face landmarks
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 1;

        // Draw all landmarks as small dots
        data.landmarks.forEach(landmark => {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw key points for accessories
        if (data.key_points) {
            this.drawKeyPoints(ctx, data.key_points);
        }
    }

    /**
     * Draw key points for accessory placement with enhanced detail
     */
    drawKeyPoints(ctx, keyPoints) {
        // Draw glasses position with enhanced visual feedback
        if (keyPoints.glasses) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(keyPoints.glasses.x, keyPoints.glasses.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText('Glasses Center', keyPoints.glasses.x + 10, keyPoints.glasses.y);
            
            // Draw glasses width indicator if available
            if (keyPoints.glasses_width) {
                const halfWidth = keyPoints.glasses_width / 2;
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(keyPoints.glasses.x - halfWidth, keyPoints.glasses.y);
                ctx.lineTo(keyPoints.glasses.x + halfWidth, keyPoints.glasses.y);
                ctx.stroke();
            }
        }

        // Draw enhanced eye landmarks with precision indicators
        if (keyPoints.left_eye && keyPoints.right_eye) {
            // Left eye landmarks
            ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            if (keyPoints.left_eye.center) {
                ctx.beginPath();
                ctx.arc(keyPoints.left_eye.center.x, keyPoints.left_eye.center.y, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
            if (keyPoints.left_eye.inner_corner) {
                ctx.beginPath();
                ctx.arc(keyPoints.left_eye.inner_corner.x, keyPoints.left_eye.inner_corner.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            if (keyPoints.left_eye.outer_corner) {
                ctx.beginPath();
                ctx.arc(keyPoints.left_eye.outer_corner.x, keyPoints.left_eye.outer_corner.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Right eye landmarks
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            if (keyPoints.right_eye.center) {
                ctx.beginPath();
                ctx.arc(keyPoints.right_eye.center.x, keyPoints.right_eye.center.y, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
            if (keyPoints.right_eye.inner_corner) {
                ctx.beginPath();
                ctx.arc(keyPoints.right_eye.inner_corner.x, keyPoints.right_eye.inner_corner.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            if (keyPoints.right_eye.outer_corner) {
                ctx.beginPath();
                ctx.arc(keyPoints.right_eye.outer_corner.x, keyPoints.right_eye.outer_corner.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Draw inter-pupillary distance line with enhanced precision
            if (keyPoints.left_eye.center && keyPoints.right_eye.center) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(keyPoints.left_eye.center.x, keyPoints.left_eye.center.y);
                ctx.lineTo(keyPoints.right_eye.center.x, keyPoints.right_eye.center.y);
                ctx.stroke();
                
                // Show enhanced eye distance measurement
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                const midX = (keyPoints.left_eye.center.x + keyPoints.right_eye.center.x) / 2;
                const midY = (keyPoints.left_eye.center.y + keyPoints.right_eye.center.y) / 2;
                ctx.fillText(`IPD: ${keyPoints.eye_distance?.toFixed(1)}px`, midX - 25, midY - 10);
            }
        }

        // Draw nose bridge point for glasses alignment
        if (keyPoints.nose_bridge) {
            ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(keyPoints.nose_bridge.x, keyPoints.nose_bridge.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Draw hat position
        if (keyPoints.hat) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(keyPoints.hat.x, keyPoints.hat.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText('Hat', keyPoints.hat.x + 10, keyPoints.hat.y);
        }

        // Draw enhanced glasses fitting rectangle with precision indicators
        if (keyPoints.glasses_width && keyPoints.avg_eye_height && keyPoints.glasses) {
            // Main glasses frame rectangle
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                keyPoints.glasses.x - keyPoints.glasses_width / 2,
                keyPoints.glasses.y - keyPoints.avg_eye_height,
                keyPoints.glasses_width,
                keyPoints.avg_eye_height * 2
            );
            
            // Enhanced measurement display with fixed text mirroring
            ctx.save(); // Save the current transform
            ctx.scale(-1, 1); // Flip horizontally to fix mirroring
            
            ctx.fillStyle = 'white';
            ctx.fillRect(-320, 10, 300, 130); // Adjust position for flipped canvas
            ctx.fillStyle = 'black';
            ctx.font = '12px Arial';
            
            const measurements = [
                `Detection: ${keyPoints.has_refined_landmarks ? 'ENHANCED' : 'Basic'} (${keyPoints.landmark_count || '?'} pts)`,
                `Eye Distance: ${keyPoints.eye_distance?.toFixed(1) || 'N/A'}px`,
                `Glasses Span: ${keyPoints.glasses_span?.toFixed(1) || 'N/A'}px`,
                `Glasses Width: ${keyPoints.glasses_width?.toFixed(1) || 'N/A'}px`,
                `Avg Eye: ${keyPoints.avg_eye_width?.toFixed(1) || 'N/A'} x ${keyPoints.avg_eye_height?.toFixed(1) || 'N/A'}px`,
                `Face Score: ${keyPoints.face_confidence?.toFixed(2) || 'N/A'}`,
                `Left Eye: ${keyPoints.left_eye?.width?.toFixed(0) || 'N/A'} x ${keyPoints.left_eye?.height?.toFixed(0) || 'N/A'}px`,
                `Right Eye: ${keyPoints.right_eye?.width?.toFixed(0) || 'N/A'} x ${keyPoints.right_eye?.height?.toFixed(0) || 'N/A'}px`
            ];
            
            measurements.forEach((text, i) => {
                ctx.fillText(text, -305, 25 + i * 14); // Adjust position for flipped canvas
            });
            
            ctx.restore(); // Restore the original transform
        }
    }

    /**
     * Clear debug canvas
     */
    clearDebugCanvas() {
        if (this.debugCtx && this.debugCanvas) {
            this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        this.fpsCounter++;
        const now = Date.now();
        
        if (now - this.lastFpsTime >= 1000) {
            const fps = this.fpsCounter;
            this.fpsCounter = 0;
            this.lastFpsTime = now;
            
            // Update FPS display
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${fps}`;
            }
        }
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        if (this.onStatusCallback) {
            this.onStatusCallback(message);
        }
        
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = this.isConnected ? 'status-connected' : 'status-disconnected';
        }
    }

    /**
     * Set skeleton visibility
     */
    setSkeletonVisible(visible) {
        this.isSkeletonVisible = visible;
        if (!visible) {
            this.clearDebugCanvas();
        }
    }

    /**
     * Set callback for landmarks updates
     */
    setLandmarksCallback(callback) {
        this.onLandmarksCallback = callback;
    }

    /**
     * Set callback for status updates
     */
    setStatusCallback(callback) {
        this.onStatusCallback = callback;
    }

    /**
     * Get last detected landmarks
     */
    getLastLandmarks() {
        return this.lastLandmarks;
    }

    /**
     * Check if face is currently detected
     */
    isFaceDetected() {
        return this.lastLandmarks && this.lastLandmarks.detected;
    }
}

// Export for use in other modules
window.FaceTracker = FaceTracker;