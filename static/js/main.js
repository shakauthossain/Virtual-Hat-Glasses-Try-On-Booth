/**
 * Main application controller
 * Coordinates webcam, face tracking, 3D scene, and model management
 */
class ARFaceTryOnApp {
    constructor() {
        // Core components
        this.webcam = null;
        this.faceTracker = null;
        this.threeScene = null;
        this.modelManager = null;
        
        // Get DOM elements
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.skeletonBtn = document.getElementById('skeleton-btn');
        this.debugModelBtn = document.getElementById('debug-model-btn');
        this.accessorySelect = document.getElementById('accessory-select');
        this.modelSelect = document.getElementById('model-select');
        this.fileUpload = document.getElementById('file-upload');
        this.uploadBtn = document.getElementById('upload-btn');
        this.statusElement = document.getElementById('status');
        this.fpsElement = document.getElementById('fps');
        
        // Size adjustment sliders
        this.glassesSizeSlider = document.getElementById('glasses-size');
        this.glassesSizeValue = document.getElementById('glasses-size-value');
        this.hatSizeSlider = document.getElementById('hat-size');
        this.hatSizeValue = document.getElementById('hat-size-value');
        
        // State variables
        this.isSkeletonVisible = false;        // State
        this.isRunning = false;
        this.debugMode = false; // Can be toggled for debug visualization
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.updateStatus('Initializing AR Face Try-On...');
            
            // Initialize components
            this.setupUI();
            await this.initializeComponents();
            
            this.updateStatus('Ready to start! Click "Start Camera" to begin.');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.updateStatus('Initialization failed: ' + error.message);
        }
    }

    /**
     * Setup UI event handlers
     */
    setupUI() {
        this.startBtn.addEventListener('click', () => this.startSession());
        this.stopBtn.addEventListener('click', () => this.stopSession());
        
        // Skeleton toggle button (with null check)
        if (this.skeletonBtn) {
            this.skeletonBtn.addEventListener('click', () => this.toggleSkeleton());
        }
        
        // Debug model button
        if (this.debugModelBtn) {
            this.debugModelBtn.addEventListener('click', () => this.debugCurrentModel());
        }
        
        // Size adjustment sliders
        if (this.glassesSizeSlider) {
            this.glassesSizeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.glassesSizeValue.textContent = `${value}x`;
                if (this.threeScene) {
                    this.threeScene.setGlassesSizeMultiplier(value);
                }
            });
        }
        
        if (this.hatSizeSlider) {
            this.hatSizeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.hatSizeValue.textContent = `${value}x`;
                if (this.threeScene) {
                    this.threeScene.setHatSizeMultiplier(value);
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ') { // Spacebar to toggle camera
                e.preventDefault();
                if (this.isRunning) {
                    this.stopSession();
                } else {
                    this.startSession();
                }
            } else if (e.key === 'd') { // 'D' key to toggle debug mode
                this.toggleDebugMode();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.webcam && this.threeScene) {
                this.updateCanvasSizes();
            }
        });
    }

    /**
     * Initialize core components
     */
    async initializeComponents() {
        // Initialize webcam manager
        this.webcam = new WebcamManager();
        
        // Initialize face tracker
        if (typeof FaceTracker === 'undefined') {
            throw new Error('FaceTracker class not available');
        }
        
        try {
            this.faceTracker = new FaceTracker();
            
            if (this.faceTracker && this.faceTracker.setStatusCallback) {
                this.faceTracker.setStatusCallback((message) => this.updateStatus(message));
            } else {
                console.error('Face tracker missing setStatusCallback method');
            }
        } catch (error) {
            console.error('Failed to create FaceTracker:', error.message);
            this.faceTracker = null;
        }
        
        // Initialize Three.js scene
        const canvas = document.getElementById('canvas');
        this.threeScene = new ThreeJSScene(canvas);
        
        // Initialize model manager
        this.modelManager = new ModelManager(this.threeScene);
        
        // Setup face tracking callback
        if (this.faceTracker && this.faceTracker.setLandmarksCallback) {
            this.faceTracker.setLandmarksCallback((landmarks) => {
                this.handleFaceLandmarks(landmarks);
            });
            console.log('Face tracking callback set');
        } else {
            console.warn('Face tracker landmarks callback not available');
        }

        // Setup webcam frame callback
        if (this.webcam && this.webcam.setFrameCallback) {
            this.webcam.setFrameCallback((imageData) => {
                if (this.faceTracker && this.faceTracker.isConnected) {
                    this.faceTracker.sendFrame(imageData);
                }
            });
            console.log('Webcam frame callback set');
        } else {
            console.warn('Webcam frame callback not available');
        }
        
        console.log('All components initialized successfully');
    }

    /**
     * Debug current model rendering
     */
    debugCurrentModel() {
        console.log('Debugging current model state');
        
        if (!this.threeScene) {
            console.error('ThreeJS Scene not initialized');
            return;
        }
        
        const currentAccessories = this.threeScene.getCurrentAccessories();
        console.log('Current accessories:', currentAccessories);
        
        const selectedType = this.accessorySelect.value;
        const selectedModel = this.modelSelect.value;
        
        console.log('UI State:');
        console.log('- Selected accessory type:', selectedType);
        console.log('- Selected model URL:', selectedModel);
        console.log('- Model manager:', this.modelManager);
        
        if (selectedType && this.threeScene.currentAccessories[selectedType]) {
            const model = this.threeScene.currentAccessories[selectedType];
            console.log('Found model in scene for type:', selectedType);
            this.threeScene.validateModel(model, selectedModel, selectedType);
            
            // Test model visibility
            this.testModelVisibility(model, selectedType);
        } else {
            console.warn('No model found in scene for type:', selectedType);
        }
        
        // Scene debugging
        this.debugScene();
    }
    
    /**
     * Test model visibility and positioning
     */
    testModelVisibility(model, type) {
        console.log('\nTESTING MODEL VISIBILITY...');
        
        // Test visibility
        console.log('Model visible:', model.visible);
        console.log('Model position:', model.position);
        console.log('Model scale:', model.scale);
        console.log('Model in scene:', this.threeScene.scene.children.includes(model));
        
        // Force position for testing
        console.log('Testing model positioning...');
        const originalPosition = model.position.clone();
        
        // Move model to center of screen for 2 seconds
        model.position.set(0, 0, 0);
        model.scale.setScalar(0.5);
        console.log('Model moved to center for visibility test');
        
        setTimeout(() => {
            model.position.copy(originalPosition);
            console.log('Model position restored');
        }, 2000);
    }
    
    /**
     * Debug Three.js scene
     */
    debugScene() {
        console.log('\nSCENE DEBUG INFO:');
        console.log('Scene children count:', this.threeScene.scene.children.length);
        console.log('Renderer info:', this.threeScene.renderer.info);
        console.log('Camera:', {
            position: this.threeScene.camera.position,
            rotation: this.threeScene.camera.rotation,
            fov: this.threeScene.camera.fov,
            aspect: this.threeScene.camera.aspect
        });
        
        // List all scene children
        console.log('Scene children:');
        this.threeScene.scene.children.forEach((child, index) => {
            console.log(`  ${index}: ${child.type} (${child.name || 'unnamed'}) - visible: ${child.visible}`);
        });
    }

    /**
     * Toggle skeleton visibility
     */
    toggleSkeleton() {
        this.isSkeletonVisible = !this.isSkeletonVisible;
        if (this.skeletonBtn) {
            this.skeletonBtn.textContent = this.isSkeletonVisible ? 'Hide Skeleton' : 'Show Skeleton';
        }
        
        if (this.faceTracker && this.faceTracker.setSkeletonVisible) {
            this.faceTracker.setSkeletonVisible(this.isSkeletonVisible);
        }
        
        console.log(`Skeleton visibility: ${this.isSkeletonVisible}`);
    }

    /**
     * Start AR session
     */
    async startSession() {
        if (this.isRunning) return;
        
        try {
            this.updateStatus('Starting camera...');
            this.startBtn.disabled = true;
            
            console.log('Step 1: Starting webcam...');
            // Start webcam
            await this.webcam.startCamera();
            console.log('Step 2: Webcam started successfully');
            
            this.updateStatus('Camera started. Connecting to face tracker...');
            
            console.log('Step 3: Connecting to face tracker...');
            console.log('Face tracker object:', this.faceTracker);
            
            // Connect to face tracking server
            await this.faceTracker.connect();
            console.log('Step 4: Face tracker connected');
            
            this.updateStatus('Face tracker connected. Starting AR session...');
            
            // Update canvas sizes
            console.log('Step 5: Updating canvas sizes...');
            this.updateCanvasSizes();
            
            // Start 3D rendering
            console.log('Step 6: Starting 3D rendering...');
            this.threeScene.startRendering();
            
            // Update UI
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            if (this.skeletonBtn) this.skeletonBtn.disabled = false;
            if (this.debugModelBtn) this.debugModelBtn.disabled = false;
            
            this.updateStatus('AR Face Try-On active! Position your face in front of the camera.');
            console.log('AR session started successfully');
            
        } catch (error) {
            console.error('Failed to start session at step:', error);
            console.error('Error stack:', error.stack);
            this.updateStatus('Failed to start: ' + error.message);
            this.startBtn.disabled = false;
            
            // Clean up on failure
            this.cleanup();
        }
    }

    /**
     * Stop AR session
     */
    stopSession() {
        if (!this.isRunning) return;
        
        this.updateStatus('Stopping AR session...');
        
        // Stop components
        this.cleanup();
        
        // Update UI
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        if (this.skeletonBtn) this.skeletonBtn.disabled = true;
        if (this.debugModelBtn) this.debugModelBtn.disabled = true;
        
        this.updateStatus('AR session stopped. Ready to restart.');
    }

    /**
     * Handle face landmarks update
     */
    handleFaceLandmarks(landmarkData) {
        if (!landmarkData || !this.threeScene) return;
        
        if (landmarkData.detected) {
            // Update 3D model positions based on face landmarks
            this.threeScene.updateAccessoryPositions(landmarkData);
        }
    }

    /**
     * Update canvas sizes to match video
     */
    updateCanvasSizes() {
        if (!this.webcam || !this.threeScene) return;
        
        const dimensions = this.webcam.getVideoDimensions();
        if (dimensions.width && dimensions.height) {
            this.threeScene.updateSize(dimensions.width, dimensions.height);
            console.log('Canvas sizes updated:', dimensions);
        }
    }

    /**
     * Toggle debug visualization mode
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        const debugCanvas = document.getElementById('debug-canvas');
        if (debugCanvas) {
            debugCanvas.style.display = this.debugMode ? 'block' : 'none';
        }
        
        console.log('Debug mode:', this.debugMode ? 'enabled' : 'disabled');
        this.updateStatus(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.webcam) {
            this.webcam.stopCamera();
        }
        
        if (this.faceTracker) {
            this.faceTracker.disconnect();
        }
        
        if (this.threeScene) {
            this.threeScene.stopRendering();
        }
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        console.log('App Status:', message);
    }

    /**
     * Get application state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            debugMode: this.debugMode,
            cameraActive: this.webcam ? this.webcam.isRunning() : false,
            faceTrackerConnected: this.faceTracker ? this.faceTracker.isConnected : false,
            currentModel: this.modelManager ? this.modelManager.getCurrentModel() : null
        };
    }

    /**
     * Handle application errors
     */
    handleError(error, context = '') {
        console.error(`App Error ${context}:`, error);
        this.updateStatus(`Error ${context}: ${error.message}`);
        
        // Stop session on critical errors
        if (this.isRunning) {
            this.stopSession();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for required browser features
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access. Please use a modern browser.');
        return;
    }
    
    if (!window.WebSocket) {
        alert('Your browser does not support WebSockets. Please use a modern browser.');
        return;
    }
    
    // Initialize application
    window.app = new ARFaceTryOnApp();
    console.log('AR Face Try-On App initialized');
});

// Export for debugging
window.ARFaceTryOnApp = ARFaceTryOnApp;