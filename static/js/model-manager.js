/**
 * 3D Model management system for AR accessories
 * Handles model loading, caching, upload functionality, and Three.js integration
 * Supports GLB and GLTF format models with automatic type detection
 */
class ModelManager {
    /**
     * Initialize ModelManager with Three.js scene integration
     * @param {ThreeJSScene} threeScene - Three.js scene manager for model rendering
     */
    constructor(threeScene) {
        console.log('ModelManager constructor called');
        this.threeScene = threeScene;
        this.availableModels = [];
        this.loadedModels = new Map();
        // Use HTTP for API calls since server might be on HTTP even if page is HTTPS
        this.baseURL = `http://${window.location.hostname}:8000`;
        
        console.log('ModelManager initialized with baseURL:', this.baseURL);
        
        this.initializeUI();
        
        // Load models from API endpoint immediately
        setTimeout(() => {
            console.log('Initial model loading from API endpoint...');
            console.log('Available models cache:', this.availableModels.length, 'models');
            this.loadAvailableModels();
        }, 1000);
    }
    
    /**
     * Initialize user interface event handlers and DOM element references
     * Sets up model selection, accessory type change, and file upload functionality
     */
    initializeUI() {
        // Model selection dropdown
        this.modelSelect = document.getElementById('model-select');
        this.modelSelect.addEventListener('change', (e) => {
            this.handleModelSelection(e.target.value);
        });

        // Accessory type selection
        this.accessorySelect = document.getElementById('accessory-select');
        this.accessorySelect.addEventListener('change', (e) => {
            this.handleAccessoryTypeChange(e.target.value);
        });

        // File upload
        this.fileUpload = document.getElementById('file-upload');
        this.uploadBtn = document.getElementById('upload-btn');
        this.refreshModelsBtn = document.getElementById('refresh-models-btn');
        this.debugModelsBtn = document.getElementById('debug-models-btn');
        
        this.fileUpload.addEventListener('change', (e) => {
            this.uploadBtn.disabled = !e.target.files.length;
        });
        
        this.uploadBtn.addEventListener('click', () => {
            this.handleFileUpload();
        });
        
        // Refresh models button
        if (this.refreshModelsBtn) {
            this.refreshModelsBtn.addEventListener('click', () => {
                console.log('🔄 Manual model refresh requested - clearing cache');
                this.availableModels = []; // Clear cache
                this.loadedModels.clear(); // Clear loaded model cache too
                this.loadAvailableModels();
            });
        }
        
        // Debug models button
        if (this.debugModelsBtn) {
            this.debugModelsBtn.addEventListener('click', () => {
                this.debugModelState();
            });
        }
    }

    /**
     * Load available models from server API
     */
    async loadAvailableModels() {
        console.log('Loading available models from API endpoint:', `${this.baseURL}/api/models`);
        
        // Set loading state
        this.modelSelect.innerHTML = '<option value="">Loading models from server...</option>';
        this.modelSelect.disabled = true;
        
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                attempt++;
                console.log(`Attempt ${attempt}/${maxRetries}: Fetching models from server...`);
                
                const response = await fetch(`${this.baseURL}/api/models`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    // Add timeout
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('📡 Raw API Response:', data);
                console.log('Response validation:');
                console.log('  - Has models property:', !!data.models);
                console.log('  - Is array:', Array.isArray(data.models));
                console.log('  - Array length:', data.models ? data.models.length : 'N/A');
                console.log('  - Model names:', data.models ? data.models.map(m => m.name) : 'N/A');
                
                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                    this.availableModels = data.models;
                    console.log('Successfully loaded', this.availableModels.length, 'models from server');
                    console.log('📋 Loaded models:', this.availableModels.map(m => `${m.name} (${m.type})`));
                    this.updateModelSelect();
                    this.updateStatus(`Loaded ${this.availableModels.length} models from server`);
                    return; // Success, exit the retry loop
                } else {
                    throw new Error('No models returned from server or invalid format');
                }
                
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    console.log(`Retrying in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    // All attempts failed
                    console.error('All attempts to load models failed');
                    this.availableModels = [];
                    this.modelSelect.innerHTML = '<option value="">Failed to load models - Check server connection</option>';
                    this.modelSelect.disabled = true;
                    this.updateStatus('Failed to load models after 3 attempts. Check server connection.');
                }
            }
        }
    }
    
    /**
     * Update model selection dropdown with improved filtering
     */

    /**
     * Update model selection dropdown with improved filtering
     */
    updateModelSelect() {
        const accessoryType = this.accessorySelect.value;
        console.log('Updating model select for accessory type:', accessoryType);
        console.log('Available models:', this.availableModels);
        
        // Clear current options
        this.modelSelect.innerHTML = '<option value="">Select a model...</option>';
        
        if (!accessoryType) {
            this.modelSelect.disabled = true;
            return;
        }
        
        // Filter models by type with improved matching and prioritization
        let filteredModels = this.availableModels.filter(model => {
            const name = model.name.toLowerCase();
            console.log('Checking model:', name, 'for type:', accessoryType);
            
            if (accessoryType === 'glasses') {
                return name.includes('glass') || name.includes('sunglass') || name.includes('specs') || name.includes('eyewear');
            } else if (accessoryType === 'hat') {
                return name.includes('hat') || name.includes('cap') || name.includes('beanie') || name.includes('helmet');
            }
            return false;
        });
        
        // Sort filtered models to prioritize user uploads over basic models
        filteredModels.sort((a, b) => {
            const aIsBasic = a.name.toLowerCase().includes('basic');
            const bIsBasic = b.name.toLowerCase().includes('basic');
            
            // Non-basic models should come first
            if (!aIsBasic && bIsBasic) return -1;
            if (aIsBasic && !bIsBasic) return 1;
            
            // Within same category, sort alphabetically
            return a.name.localeCompare(b.name);
        });
        
        console.log('Available models from server:', this.availableModels.map(m => m.name));
        console.log('Filtered models for', accessoryType + ':', filteredModels.map(m => m.name));
        console.log('Models after prioritization:', filteredModels.map(m => `${m.name} (${m.name.includes('basic') ? 'basic' : 'user'})`));
        
        if (filteredModels.length === 0) {
            this.modelSelect.innerHTML = '<option value="">No models available for ' + accessoryType + '</option>';
            this.modelSelect.disabled = true;
            return;
        }
        
        // Add filtered models to dropdown
        filteredModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.url;
            option.textContent = model.name;
            option.dataset.type = model.type;
            this.modelSelect.appendChild(option);
        });
        
        // Enable dropdown and auto-select first model if available
        this.modelSelect.disabled = false;
        if (filteredModels.length > 0) {
            const selectedModel = filteredModels[0];
            this.modelSelect.value = selectedModel.url;
            console.log('Auto-selected FIRST model:', selectedModel.name);
            console.log('   - URL:', selectedModel.url);
            console.log('   - Type:', selectedModel.type);
            console.log('   - Is Basic:', selectedModel.name.toLowerCase().includes('basic') ? 'YES' : 'NO');
            
            // Auto-load the first model after a short delay
            setTimeout(() => {
                console.log('Auto-loading selected model:', selectedModel.name);
                this.handleModelSelection(selectedModel.url);
            }, 100);
        } else {
            console.log('No models match the selected accessory type:', accessoryType);
        }
    }

    /**
     * Handle accessory type change (glasses, hat, etc.)
     */
    handleAccessoryTypeChange(accessoryType) {
        console.log('Accessory type changed to:', accessoryType);
        
        // Clear current accessory
        this.threeScene.clearAccessory(accessoryType);
        
        // Update model dropdown
        this.updateModelSelect();
        
        if (!accessoryType) {
            this.updateStatus('Select an accessory type');
        }
    }

    /**
     * Handle model selection from dropdown
     */
    async handleModelSelection(modelUrl) {
        if (!modelUrl) {
            console.log('No model URL provided');
            return;
        }

        const accessoryType = this.accessorySelect.value;
        if (!accessoryType) {
            this.updateStatus('Please select an accessory type first');
            return;
        }

        try {
            console.log(`Loading model: ${modelUrl} for ${accessoryType}`);
            this.updateStatus('Loading 3D model...');
            
            // Clear previous model of this type
            this.threeScene.clearAccessory(accessoryType);
            
            // Load the selected model
            await this.loadModel(modelUrl, accessoryType);
            
            this.updateStatus(`${accessoryType} loaded successfully`);
            
        } catch (error) {
            console.error('Failed to load model:', error);
            this.updateStatus('Failed to load model: ' + error.message);
            
            // Try to load fallback model
            this.loadFallbackModel(accessoryType);
        }
    }

    /**
     * Load fallback model when primary loading fails
     */
    async loadFallbackModel(accessoryType) {
        console.log(`Loading fallback model for ${accessoryType}`);
        try {
            // Create simple fallback geometry
            const fallbackModel = this.threeScene.createFallbackModel(accessoryType);
            this.threeScene.setAccessoryModel(fallbackModel, accessoryType);
            this.updateStatus(`Using fallback ${accessoryType} model`);
        } catch (error) {
            console.error('Failed to load fallback model:', error);
            this.updateStatus('Failed to load any model');
        }
    }

    /**
     * Load 3D model from URL
     */
    async loadModel(url, type) {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (this.loadedModels.has(url)) {
                console.log('Using cached model:', url);
                const cachedModel = this.loadedModels.get(url);
                this.threeScene.setAccessoryModel(cachedModel.clone(), type);
                resolve(cachedModel);
                return;
            }

            // Determine file type
            const fileExtension = url.toLowerCase().split('.').pop();
            let loader;

            if (fileExtension === 'glb' || fileExtension === 'gltf') {
                // Use GLTF loader for .glb and .gltf files
                console.log('Checking GLTFLoader availability...');
                console.log('THREE object:', typeof THREE);
                console.log('THREE.GLTFLoader:', typeof THREE.GLTFLoader);
                
                if (typeof THREE === 'undefined') {
                    reject(new Error('Three.js not loaded. Please check script imports.'));
                    return;
                }
                
                if (typeof THREE.GLTFLoader === 'undefined') {
                    console.error('GLTFLoader not available. Available THREE properties:', Object.keys(THREE).filter(k => k.includes('Loader')));
                    reject(new Error('GLTF Loader not available. Please include THREE.GLTFLoader.'));
                    return;
                }
                
                console.log('GLTFLoader available, creating instance...');
                loader = new THREE.GLTFLoader();
            } else {
                reject(new Error(`Unsupported file format: ${fileExtension}`));
                return;
            }

            console.log('Loading model from:', url);

            loader.load(
                url,
                (result) => {
                    console.log('\nMODEL LOADING SUCCESS:', url);
                    console.log('Load result:', result);
                    
                    let model;

                    if (result.scene) {
                        // GLTF format
                        model = result.scene;
                        console.log('GLTF scene extracted');
                    } else {
                        // Direct geometry/mesh
                        model = result;
                        console.log('Direct model extracted');
                    }
                    
                    // Detailed model inspection
                    console.log('Model properties:');
                    console.log('- Type:', model.type);
                    console.log('- Children:', model.children.length);
                    console.log('- Visible:', model.visible);
                    console.log('- UserData:', model.userData);
                    
                    // Check for common issues
                    if (model.children.length === 0) {
                        console.warn('Model has no children - might be empty');
                    }
                    
                    if (!model.visible) {
                        console.warn('Model is not visible');
                        model.visible = true;
                    }

                    // Cache the model
                    this.loadedModels.set(url, model);
                    console.log('Model cached with key:', url);
                    
                    // Clone the model for scene use
                    const sceneModel = model.clone();
                    console.log('Model cloned for scene use');
                    
                    // Set the model in the scene
                    this.threeScene.setAccessoryModel(sceneModel, type);
                    console.log('Model set in ThreeJS scene as type:', type);
                    
                    // Final validation
                    const currentAccessories = this.threeScene.getCurrentAccessories();
                    console.log('Current accessories in scene:', currentAccessories);
                    
                    resolve(model);
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total) * 100;
                    console.log(`Loading progress: ${percent.toFixed(1)}%`);
                    this.updateStatus(`Loading model... ${percent.toFixed(0)}%`);
                },
                (error) => {
                    console.error('\nMODEL LOADING ERROR:', url);
                    console.error('Error details:', error);
                    console.error('Error message:', error.message);
                    console.error('Error stack:', error.stack);
                    
                    // Additional debugging info
                    console.error('File extension:', url.toLowerCase().split('.').pop());
                    console.error('Loader type:', loader.constructor.name);
                    console.error('THREE.js version:', THREE.REVISION);
                    
                    reject(new Error(`Failed to load model: ${error.message || 'Unknown error'}`));
                }
            );
        });
    }

    /**
     * Handle file upload for new models
     */
    async handleFileUpload() {
        const file = this.fileUpload.files[0];
        if (!file) {
            this.updateStatus('No file selected');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.updateStatus('Uploading model...');
            this.uploadBtn.disabled = true;

            const response = await fetch(`${this.baseURL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // Add to available models
                this.availableModels.push({
                    name: result.filename,
                    url: result.url,
                    type: result.type
                });
                
                // Refresh the entire model list from server to ensure consistency
                console.log('Upload successful, refreshing model list from server...');
                await this.loadAvailableModels();
                
                // Clear upload
                this.fileUpload.value = '';
                this.updateStatus('Model uploaded and list refreshed successfully');
            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.updateStatus('Upload failed: ' + error.message);
        } finally {
            this.uploadBtn.disabled = false;
        }
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        console.log('Status:', message);
        const statusElement = document.getElementById('status');
        if (statusElement && message) {
            statusElement.textContent = message;
        }
    }

    /**
     * Get currently selected model info
     */
    getCurrentModel() {
        return {
            accessoryType: this.accessorySelect.value,
            modelUrl: this.modelSelect.value
        };
    }

    /**
     * Debug current model state
     */
    debugModelState() {
        console.log('\n🔍 MODEL STATE DEBUG REPORT');
        console.log('════════════════════════════════════');
        
        // API availability
        console.log('🌐 API Status:');
        console.log('  Base URL:', this.baseURL);
        console.log('  Available models count:', this.availableModels.length);
        
        // Current models
        console.log('\n📦 Available Models:');
        this.availableModels.forEach((model, index) => {
            console.log(`  ${index + 1}. ${model.name}`);
            console.log(`     - URL: ${model.url}`);
            console.log(`     - Type: ${model.type}`);
            console.log(`     - Is Basic: ${model.name.toLowerCase().includes('basic') ? 'YES' : 'NO'}`);
        });
        
        // Current UI state
        console.log('\n🖼️ UI State:');
        console.log('  Selected accessory type:', this.accessorySelect.value);
        console.log('  Selected model URL:', this.modelSelect.value);
        console.log('  Model dropdown options count:', this.modelSelect.options.length);
        
        // Current dropdown contents
        console.log('\n📋 Dropdown Contents:');
        for (let i = 0; i < this.modelSelect.options.length; i++) {
            const option = this.modelSelect.options[i];
            const isSelected = option.selected;
            console.log(`  ${isSelected ? '👉' : '  '} ${option.text} (${option.value})`);
        }
        
        // Filter test
        const accessoryType = this.accessorySelect.value;
        if (accessoryType) {
            console.log(`\n🔍 Filter Test for "${accessoryType}":`);
            const filtered = this.availableModels.filter(model => {
                const name = model.name.toLowerCase();
                if (accessoryType === 'glasses') {
                    return name.includes('glass') || name.includes('sunglass') || name.includes('specs') || name.includes('eyewear');
                } else if (accessoryType === 'hat') {
                    return name.includes('hat') || name.includes('cap') || name.includes('beanie') || name.includes('helmet');
                }
                return false;
            });
            
            console.log('  Filtered results:', filtered.map(m => m.name));
            
            // Sorted results
            const sorted = [...filtered].sort((a, b) => {
                const aIsBasic = a.name.toLowerCase().includes('basic');
                const bIsBasic = b.name.toLowerCase().includes('basic');
                if (!aIsBasic && bIsBasic) return -1;
                if (aIsBasic && !bIsBasic) return 1;
                return a.name.localeCompare(b.name);
            });
            
            console.log('  After prioritization:', sorted.map(m => `${m.name} (${m.name.includes('basic') ? 'basic' : 'user'})`));
        }
        
        console.log('════════════════════════════════════');
        console.log('🔍 END MODEL STATE DEBUG REPORT\n');
    }

    /**
     * Clear model cache
     */
    clearCache() {
        this.loadedModels.clear();
        console.log('Model cache cleared');
    }
}

// Export for use in other modules
window.ModelManager = ModelManager;