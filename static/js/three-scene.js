/**
 * Three.js scene management for AR overlay rendering
 * Manages 3D model loading, positioning, lighting, and real-time rendering
 * Synchronizes with face tracking data for accurate accessory placement
 */
class ThreeJSScene {
    /**
     * Initialize Three.js scene with AR overlay configuration
     * @param {HTMLCanvasElement} canvas - Canvas element for WebGL rendering
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.loader = null;
        
        // Model containers
        this.glassesModel = null;
        this.hatModel = null;
        this.currentAccessories = {};
        
        // Face tracking data
        this.lastFaceData = null;
        
        // Size adjustment multipliers
        this.glassesSizeMultiplier = 1.0;
        this.hatSizeMultiplier = 1.0;
        
        // Animation
        this.animationId = null;
        this.isRendering = false;
        
        this.init();
    }

    /**
     * Initialize Three.js scene components including camera, renderer, and lighting
     * Sets up transparent background for AR overlay functionality
     */
    init() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create camera (will be adjusted based on video feed)
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.z = 1;

        // Create renderer with transparency
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(640, 480);
        this.renderer.setClearColor(0x000000, 0); // Transparent background

        // Add lighting
        this.setupLighting();

        // Initialize GLTF loader
        if (typeof THREE.GLTFLoader !== 'undefined') {
            this.loader = new THREE.GLTFLoader();
        } else {
            console.error('GLTFLoader not available. Please check Three.js imports.');
        }

        console.log('Three.js scene initialized');
    }

    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light for realistic shading
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0.5).normalize();
        this.scene.add(directionalLight);

        // Additional point light from camera position
        const pointLight = new THREE.PointLight(0xffffff, 0.4, 100);
        pointLight.position.set(0, 0, 1);
        this.scene.add(pointLight);
    }

    /**
     * Update canvas size to match video
     */
    updateSize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Load a 3D model from URL
     */
    async loadModel(url, type = 'accessory') {
        if (!this.loader) {
            // Fallback: create simple geometry if GLTFLoader is not available
            return this.createFallbackModel(type);
        }

        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Center the model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);

                    // Scale model appropriately
                    const size = box.getSize(new THREE.Vector3());
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    const scale = type === 'glasses' ? 0.1 : 0.15; // Different scales for different accessories
                    model.scale.setScalar(scale / maxDimension);

                    console.log(`Model loaded: ${url}, type: ${type}`);
                    
                    // Validate the loaded model
                    this.validateModel(model, url, type);
                    
                    resolve(model);
                },
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading model:', error);
                    // Fallback to simple geometry on error
                    resolve(this.createFallbackModel(type));
                }
            );
        });
    }

    /**
     * Create fallback models when GLTFLoader fails or is unavailable
     */
    createFallbackModel(type) {
        let geometry, material, model;
        
        if (type === 'glasses') {
            // Create realistic glasses that properly cover eyes
            const glassesGroup = new THREE.Group();
            
            // Lens parameters - sized to cover typical eyes
            const lensRadius = 0.08; // Larger lenses to cover eyes properly
            const lensDistance = 0.12; // Distance between lens centers (inter-pupillary distance)
            const frameThickness = 0.004;
            
            // Materials
            const frameMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x2c2c2c, 
                shininess: 30,
                transparent: true,
                opacity: 0.9
            });
            
            const lensMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x4a4a4a, 
                transparent: true, 
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            
            // Left lens with frame
            const leftLensGeometry = new THREE.RingGeometry(lensRadius - frameThickness, lensRadius, 32);
            const leftLensFrame = new THREE.Mesh(leftLensGeometry, frameMaterial);
            leftLensFrame.position.set(-lensDistance/2, 0, 0);
            
            const leftLensGlass = new THREE.Mesh(
                new THREE.CircleGeometry(lensRadius - frameThickness, 32), 
                lensMaterial
            );
            leftLensGlass.position.set(-lensDistance/2, 0, 0.001);
            
            // Right lens with frame
            const rightLensGeometry = new THREE.RingGeometry(lensRadius - frameThickness, lensRadius, 32);
            const rightLensFrame = new THREE.Mesh(rightLensGeometry, frameMaterial);
            rightLensFrame.position.set(lensDistance/2, 0, 0);
            
            const rightLensGlass = new THREE.Mesh(
                new THREE.CircleGeometry(lensRadius - frameThickness, 32), 
                lensMaterial
            );
            rightLensGlass.position.set(lensDistance/2, 0, 0.001);
            
            // Bridge connecting the lenses
            const bridgeGeometry = new THREE.CylinderGeometry(frameThickness, frameThickness, lensDistance * 0.6, 8);
            const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
            bridge.rotation.z = Math.PI / 2;
            bridge.position.set(0, -0.02, 0); // Slightly below lens centers
            
            // Temple arms (earpieces)
            const templeLength = 0.15;
            const leftTempleGeometry = new THREE.CylinderGeometry(frameThickness/2, frameThickness/2, templeLength, 8);
            const leftTemple = new THREE.Mesh(leftTempleGeometry, frameMaterial);
            leftTemple.rotation.z = Math.PI / 2;
            leftTemple.position.set(-lensDistance/2 - lensRadius - templeLength/2, 0, 0);
            
            const rightTemple = new THREE.Mesh(leftTempleGeometry.clone(), frameMaterial);
            rightTemple.rotation.z = Math.PI / 2;
            rightTemple.position.set(lensDistance/2 + lensRadius + templeLength/2, 0, 0);
            
            // Assemble glasses
            glassesGroup.add(leftLensFrame);
            glassesGroup.add(leftLensGlass);
            glassesGroup.add(rightLensFrame);
            glassesGroup.add(rightLensGlass);
            glassesGroup.add(bridge);
            glassesGroup.add(leftTemple);
            glassesGroup.add(rightTemple);
            
            model = glassesGroup;
            
        } else if (type === 'hat') {
            // Create simple hat shape (unchanged)
            geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
            material = new THREE.MeshPhongMaterial({ color: 0x4444aa });
            model = new THREE.Mesh(geometry, material);
            
            // Add brim
            const brimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16);
            const brimMaterial = new THREE.MeshPhongMaterial({ color: 0x333388 });
            const brim = new THREE.Mesh(brimGeometry, brimMaterial);
            brim.position.y = -0.06;
            
            const hatGroup = new THREE.Group();
            hatGroup.add(model);
            hatGroup.add(brim);
            model = hatGroup;
        }
        
        console.log(`Created enhanced fallback model for ${type}`);
        return model;
    }

    /**
     * Add accessory to scene
     */
    addAccessory(model, type) {
        // Remove existing accessory of the same type
        this.removeAccessory(type);
        
        // Add new model to scene
        this.scene.add(model);
        this.currentAccessories[type] = model;
        
        console.log(`Added ${type} accessory to scene`);
    }

    /**
     * Remove accessory from scene
     */
    removeAccessory(type) {
        if (this.currentAccessories[type]) {
            this.scene.remove(this.currentAccessories[type]);
            delete this.currentAccessories[type];
            console.log(`Removed ${type} accessory from scene`);
        }
    }

    /**
     * Update accessory positions based on face landmarks
     */
    updateAccessoryPositions(faceData) {
        if (!faceData.key_points || !faceData.detected) return;

        // Store face data for use in positioning calculations
        this.lastFaceData = faceData;
        
        const keyPoints = faceData.key_points;
        const videoWidth = faceData.image_width || 640;
        const videoHeight = faceData.image_height || 480;

        // Update glasses position
        if (this.currentAccessories.glasses && keyPoints.glasses) {
            this.positionAccessory(
                this.currentAccessories.glasses,
                keyPoints.glasses,
                videoWidth,
                videoHeight,
                'glasses'
            );
        }

        // Update hat position
        if (this.currentAccessories.hat && keyPoints.hat) {
            this.positionAccessory(
                this.currentAccessories.hat,
                keyPoints.hat,
                videoWidth,
                videoHeight,
                'hat'
            );
        }
    }

    /**
     * Position accessory in 3D space based on enhanced face landmarks
     */
    positionAccessory(model, keyPoint, videoWidth, videoHeight, type) {
        // Convert 2D screen coordinates to 3D world coordinates
        const x = (keyPoint.x / videoWidth - 0.5) * 2;
        const y = -(keyPoint.y / videoHeight - 0.5) * 2;
        const z = keyPoint.z ? (keyPoint.z / videoWidth - 0.5) * 0.5 : 0;

        model.position.set(x, y, z);

        // Apply type-specific adjustments with ENHANCED precision
        if (type === 'glasses') {
            const faceData = this.lastFaceData;
            if (faceData && faceData.key_points) {
                const kp = faceData.key_points;
                
                console.log('Glasses positioning with enhanced face detection:');
                console.log(`- Eye distance: ${kp.eye_distance?.toFixed(1)}px`);
                console.log(`- Glasses span: ${kp.glasses_span?.toFixed(1)}px`);
                console.log(`- Glasses width: ${kp.glasses_width?.toFixed(1)}px`);
                console.log(`- Avg eye size: ${kp.avg_eye_width?.toFixed(1)} x ${kp.avg_eye_height?.toFixed(1)}px`);
                console.log(`- Has refined landmarks: ${kp.has_refined_landmarks}, count: ${kp.landmark_count}`);
                
                // FACE-PROPORTIONAL SCALING: Scale glasses based on actual face dimensions
                if (kp.glasses_width && kp.avg_eye_height && kp.eye_distance) {
                    // Get face dimensions for proportional scaling
                    const faceWidth = kp.face_width || kp.eye_distance * 2.5; // Estimate if not available
                    const faceHeight = kp.face_height || kp.avg_eye_height * 8; // Estimate if not available
                    
                    // Scale based on face proportions (not fixed references)
                    // Glasses should be ~40% of face width and ~15% of face height
                    const targetGlassesWidthRatio = 1.5;  // 40% of face width
                    const targetGlassesHeightRatio = 1.5; // 15% of face height
                    
                    const scaleX = (faceWidth * targetGlassesWidthRatio) / 100; // Normalize to model units
                    const scaleY = (faceHeight * targetGlassesHeightRatio) / 100;
                    const scaleZ = (scaleX + scaleY) / 2;
                    
                    // Apply face-proportional scaling with user adjustment
                    model.scale.set(
                        Math.max(0.2, Math.min(2.5, scaleX * this.glassesSizeMultiplier)),
                        Math.max(0.2, Math.min(2.5, scaleY * this.glassesSizeMultiplier)),
                        Math.max(0.2, Math.min(2.5, scaleZ * this.glassesSizeMultiplier))
                    );
                    
                    console.log(`Face-proportional glasses: face=${faceWidth.toFixed(0)}x${faceHeight.toFixed(0)}px, scale=${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
                    
                } else {
                    console.log('Warning: Missing face measurements, using face size calculation');
                    const faceScale = this.calculateFaceScale(keyPoint);
                    // Use face-proportional fallback scaling with user adjustment
                    model.scale.setScalar(faceScale * 0.6 * this.glassesSizeMultiplier); // Directly proportional to face size
                }
                
                // ENHANCED positioning using eye alignment
                if (kp.left_eye && kp.right_eye && kp.left_eye.center && kp.right_eye.center) {
                    // Calculate face rotation based on eye alignment
                    const eyeYDiff = kp.right_eye.center.y - kp.left_eye.center.y;
                    const eyeXDiff = kp.right_eye.center.x - kp.left_eye.center.x;
                    const rotation = Math.atan2(eyeYDiff, eyeXDiff);
                    model.rotation.z = rotation * 0.5; // Apply 50% of the rotation for stability
                    
                    console.log(`Applied rotation: ${(rotation * 180 / Math.PI).toFixed(1)}°`);
                    
                    // Fine-tune Y position to sit properly on nose bridge
                    if (kp.nose_bridge && kp.glasses) {
                        const noseOffset = (kp.nose_bridge.y - kp.glasses.y) / videoHeight * 0.1;
                        model.position.y += noseOffset + 0.05; // Slight upward adjustment
                        console.log(`Applied nose bridge offset: ${noseOffset.toFixed(3)}`);
                    }
                }
                
            } else {
                console.log('Warning: No enhanced face data available, using basic scaling');
                const faceScale = this.calculateFaceScale(keyPoint);
                model.scale.setScalar(0.5 * faceScale);
            }
            
        } else if (type === 'hat') {
            // Position hat slightly above the forehead
            model.position.y += 0.15;
            
            // FACE-PROPORTIONAL HAT SCALING
            const faceData = this.lastFaceData;
            if (faceData && faceData.key_points) {
                const kp = faceData.key_points;
                const faceWidth = kp.face_width || kp.eye_distance * 2.5;
                // Hat should be ~160% of face width for proper proportions
                const targetHatWidthRatio = 1.6;
                const hatScale = (faceWidth * targetHatWidthRatio) / 150; // Normalize to model units
                
                model.scale.setScalar(Math.max(0.3, Math.min(3.0, hatScale * this.hatSizeMultiplier)));
                console.log(`Face-proportional hat: face_width=${faceWidth.toFixed(0)}px, scale=${hatScale.toFixed(2)}, multiplier=${this.hatSizeMultiplier}`);
            } else {
                // Fallback: use face size calculation with user adjustment
                const faceScale = this.calculateFaceScale(keyPoint);
                model.scale.setScalar(faceScale * 0.8 * this.hatSizeMultiplier); // Proportional to detected face size
            }
        }
    }

    /**
     * Calculate face rotation for accessory alignment
     */
    calculateFaceRotation(keyPoint) {
        // Simple rotation calculation - could be improved with more landmarks
        return 0; // Placeholder for now
    }

    /**
     * Calculate face scale for accessory sizing
     */
    calculateFaceScale(keyPoint) {
        const faceData = this.lastFaceData;
        
        if (faceData && faceData.key_points) {
            // Use inter-pupillary distance for more accurate scaling
            const baseEyeDistance = 65; // Average inter-pupillary distance in pixels
            const currentEyeDistance = faceData.key_points.eye_distance || baseEyeDistance;
            return Math.max(0.4, Math.min(2.5, currentEyeDistance / baseEyeDistance));
        } else {
            // Fallback to face width
            const baseFaceWidth = 150; // Approximate baseline face width in pixels
            const currentFaceWidth = keyPoint.face_width || baseFaceWidth;
            return Math.max(0.5, Math.min(2.0, currentFaceWidth / baseFaceWidth));
        }
    }

    /**
     * Start rendering loop
     */
    startRendering() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.render();
    }

    /**
     * Stop rendering loop
     */
    stopRendering() {
        this.isRendering = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Render loop
     */
    render() {
        if (!this.isRendering) return;

        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue animation loop
        this.animationId = requestAnimationFrame(() => this.render());
    }

    /**
     * Clear all accessories from scene
     */
    clearAccessories() {
        Object.keys(this.currentAccessories).forEach(type => {
            this.removeAccessory(type);
        });
    }

    /**
     * Get current accessory models
     */
    getCurrentAccessories() {
        return Object.keys(this.currentAccessories);
    }

    /**
     * Clear accessory of specified type
     */
    clearAccessory(type) {
        if (type === 'glasses' && this.glassesModel) {
            this.scene.remove(this.glassesModel);
            this.glassesModel = null;
            console.log('Cleared glasses model');
        } else if (type === 'hat' && this.hatModel) {
            this.scene.remove(this.hatModel);
            this.hatModel = null;
            console.log('Cleared hat model');
        }
    }

    /**
     * Set accessory model of specified type
     */
    setAccessoryModel(model, type) {
        // Clear existing model of this type first
        this.clearAccessory(type);
        
        if (type === 'glasses') {
            this.glassesModel = model;
            this.scene.add(model);
            console.log('Set glasses model');
        } else if (type === 'hat') {
            this.hatModel = model;
            this.scene.add(model);
            console.log('Set hat model');
        }
        
        // Store in currentAccessories
        this.currentAccessories[type] = model;
    }

    /**
     * Comprehensive model validation and debugging
     */
    validateModel(model, modelUrl, type) {
        console.log('\n=== MODEL VALIDATION REPORT ===');
        console.log('Model URL:', modelUrl);
        console.log('Model Type:', type);
        console.log('Model Object:', model);
        
        if (!model) {
            console.error('Model is null or undefined');
            return false;
        }
        
        // Basic model properties
        console.log('Model exists');
        console.log('Model type:', model.type);
        console.log('Model UUID:', model.uuid);
        console.log('Model visible:', model.visible);
        
        // Geometry validation
        let geometryCount = 0;
        let materialCount = 0;
        let textureCount = 0;
        
        model.traverse((child) => {
            console.log('Child:', child.type, child.name || 'unnamed');
            
            if (child.isMesh) {
                geometryCount++;
                console.log('  └─ Mesh found:', child.name || 'unnamed');
                
                if (child.geometry) {
                    const geom = child.geometry;
                    console.log('    └─ Geometry:', geom.type);
                    console.log('      ├─ Vertices:', geom.attributes.position?.count || 0);
                    console.log('      ├─ Faces:', geom.index?.count / 3 || 0);
                    console.log('      └─ Bounding box:', geom.boundingBox);
                    
                    if (!geom.boundingBox) {
                        geom.computeBoundingBox();
                    }
                }
                
                if (child.material) {
                    materialCount++;
                    const mat = child.material;
                    console.log('    └─ Material:', mat.type);
                    console.log('      ├─ Color:', mat.color);
                    console.log('      ├─ Transparent:', mat.transparent);
                    console.log('      └─ Opacity:', mat.opacity);
                    
                    if (mat.map) {
                        textureCount++;
                        console.log('      └─ Texture found:', mat.map.image?.src || 'data texture');
                    }
                }
            }
        });
        
        // Model dimensions
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log('\n📐 Model Dimensions:');
        console.log('Size:', size.x.toFixed(3), 'x', size.y.toFixed(3), 'x', size.z.toFixed(3));
        console.log('Center:', center.x.toFixed(3), center.y.toFixed(3), center.z.toFixed(3));
        console.log('Bounding box:', box.min, box.max);
        
        console.log('\nModel Statistics:');
        console.log('Meshes found:', geometryCount);
        console.log('Materials found:', materialCount);
        console.log('Textures found:', textureCount);
        
        // Rendering validation
        console.log('\nRendering Validation:');
        console.log('Model position:', model.position);
        console.log('Model rotation:', model.rotation);
        console.log('Model scale:', model.scale);
        console.log('Model matrix world:', model.matrixWorld);
        
        // Scene validation
        console.log('\n🌍 Scene Context:');
        console.log('Model in scene:', this.scene.children.includes(model));
        console.log('Scene children count:', this.scene.children.length);
        console.log('Camera position:', this.camera.position);
        console.log('Camera target:', this.camera.lookAt);
        
        const isValid = geometryCount > 0 && model.visible;
        console.log('\n' + (isValid ? 'MODEL VALIDATION PASSED' : 'MODEL VALIDATION FAILED'));
        console.log('=== END VALIDATION REPORT ===\n');
        
        return isValid;
    }

    /**
     * Set glasses size multiplier
     */
    setGlassesSizeMultiplier(multiplier) {
        this.glassesSizeMultiplier = multiplier;
        console.log(`Glasses size multiplier set to: ${multiplier}`);
    }

    /**
     * Set hat size multiplier
     */
    setHatSizeMultiplier(multiplier) {
        this.hatSizeMultiplier = multiplier;
        console.log(`Hat size multiplier set to: ${multiplier}`);
    }

    /**
     * Dispose of Three.js resources
     */
    dispose() {
        this.stopRendering();
        this.clearAccessories();
        
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Export for use in other modules
window.ThreeJSScene = ThreeJSScene;