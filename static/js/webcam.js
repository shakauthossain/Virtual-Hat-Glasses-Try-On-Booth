/**
 * Webcam management module for AR face tracking
 * Handles video stream initialization, frame capture, and real-time processing
 */
class WebcamManager {
    /**
     * Initialize WebcamManager with DOM element references
     */
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.debugCanvas = document.getElementById('debug-canvas');
        this.stream = null;
        this.isActive = false;
        
        this.onFrameCallback = null;
    }

    /**
     * Initialize and start the webcam stream with optimal settings
     * @returns {Promise<void>} Resolves when camera is successfully started
     * @throws {Error} If camera access is denied or initialization fails
     */
    async startCamera() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    facingMode: 'user',
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            };

            console.log('Requesting camera access...');
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    console.log('Video metadata loaded, starting playback...');
                    this.video.play().then(() => {
                        this.isActive = true;
                        
                        // Set canvas dimensions to match video
                        this.updateCanvasDimensions();
                        
                        // Start frame processing
                        this.startFrameProcessing();
                        
                        console.log('Camera started successfully');
                        resolve();
                    }).catch(reject);
                };
                
                this.video.onerror = (error) => {
                    console.error('Video error:', error);
                    reject(new Error('Video playback failed'));
                };

                // Add timeout for camera initialization
                setTimeout(() => {
                    if (!this.isActive) {
                        reject(new Error('Camera initialization timeout'));
                    }
                }, 10000);
            });
        } catch (error) {
            console.error('Error starting camera:', error);
            let errorMessage = 'Camera access failed';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found. Please ensure a camera is connected.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is being used by another application.';
            }
            
            throw new Error(errorMessage);
        }
    }

    /**
     * Stop the webcam stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isActive = false;
        this.video.srcObject = null;
    }

    /**
     * Update canvas dimensions to match video
     */
    updateCanvasDimensions() {
        const rect = this.video.getBoundingClientRect();
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.debugCanvas.width = this.video.videoWidth;
        this.debugCanvas.height = this.video.videoHeight;
        this.debugCanvas.style.width = rect.width + 'px';
        this.debugCanvas.style.height = rect.height + 'px';
    }

    /**
     * Start processing video frames
     */
    startFrameProcessing() {
        if (!this.isActive) return;

        // Create a temporary canvas for frame capture
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const processFrame = () => {
            if (!this.isActive || !this.video.videoWidth || !this.video.videoHeight) {
                if (this.isActive) {
                    // Retry after a short delay if video dimensions aren't ready
                    setTimeout(processFrame, 100);
                }
                return;
            }

            try {
                // Set canvas dimensions to match video
                tempCanvas.width = this.video.videoWidth;
                tempCanvas.height = this.video.videoHeight;

                // Draw current video frame to temporary canvas
                tempCtx.drawImage(this.video, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // Convert to base64 for sending to backend
                const imageData = tempCanvas.toDataURL('image/jpeg', 0.8);
                
                // Call the frame callback if set
                if (this.onFrameCallback) {
                    this.onFrameCallback(imageData);
                }
            } catch (error) {
                console.error('Error processing video frame:', error);
            }

            // Continue processing at ~30 FPS
            if (this.isActive) {
                setTimeout(processFrame, 33);
            }
        };

        // Start processing after a short delay to ensure video is ready
        setTimeout(processFrame, 500);
    }

    /**
     * Set callback function for frame processing
     */
    setFrameCallback(callback) {
        this.onFrameCallback = callback;
    }

    /**
     * Get video dimensions
     */
    getVideoDimensions() {
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    }

    /**
     * Check if camera is active
     */
    isRunning() {
        return this.isActive;
    }
}

// Export for use in other modules
window.WebcamManager = WebcamManager;