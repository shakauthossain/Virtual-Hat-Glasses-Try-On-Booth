#!/usr/bin/env python3
"""
3D Model Generator for AR Face Try-On System

Generates basic GLB format models for virtual accessories including glasses and hats.
Creates wireframe and solid geometry models for real-time AR overlay rendering.
Supports export to GLB format compatible with Three.js GLTF loader.

Usage:
    python generate_models.py
    
Output:
    - sunglasses.glb: Basic wireframe glasses model
    - basic_hat.glb: Simple cap/hat geometry
"""

import numpy as np
import json
import base64
import struct
import os

def create_basic_glasses():
    """
    Generate basic glasses model geometry with wireframe construction.
    
    Creates a simplified glasses frame with left and right lens outlines,
    connecting bridge, and temple arms. Uses line segments for wireframe
    rendering suitable for AR overlay applications.
    
    Returns:
        tuple: (vertices, indices) where:
            - vertices: List of 3D coordinates [x, y, z] for frame points
            - indices: List of line segment indices for wireframe rendering
    """
    # Vertices for glasses frame (simplified wireframe)
    vertices = [
        # Left lens frame (circle approximation)
        [-0.3, 0.1, 0], [-0.25, 0.15, 0], [-0.2, 0.1, 0], [-0.25, 0.05, 0],
        [-0.3, 0.0, 0], [-0.25, -0.05, 0], [-0.2, 0.0, 0], [-0.25, 0.05, 0],
        
        # Right lens frame 
        [0.2, 0.1, 0], [0.25, 0.15, 0], [0.3, 0.1, 0], [0.25, 0.05, 0],
        [0.3, 0.0, 0], [0.25, -0.05, 0], [0.2, 0.0, 0], [0.25, 0.05, 0],
        
        # Bridge
        [-0.05, 0.05, 0], [0.05, 0.05, 0],
        
        # Left temple
        [-0.35, 0.02, 0], [-0.4, 0.0, 0.1], [-0.45, -0.02, 0.15],
        
        # Right temple
        [0.35, 0.02, 0], [0.4, 0.0, 0.1], [0.45, -0.02, 0.15]
    ]
    
    # Indices for line segments (wireframe)
    indices = [
        # Left lens
        0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 0,
        # Right lens  
        8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 8,
        # Bridge
        16, 17,
        # Left temple
        0, 18, 18, 19, 19, 20,
        # Right temple
        8, 21, 21, 22, 22, 23
    ]
    
    return vertices, indices

def create_basic_hat():
    """Create a simple hat model (cylinder with brim)"""
    vertices = []
    indices = []
    
    # Hat crown (cylinder)
    radius = 0.25
    height = 0.2
    segments = 12
    
    # Bottom circle
    for i in range(segments):
        angle = 2 * np.pi * i / segments
        x = radius * np.cos(angle)
        z = radius * np.sin(angle)
        vertices.append([x, 0, z])
    
    # Top circle
    for i in range(segments):
        angle = 2 * np.pi * i / segments
        x = radius * np.cos(angle)
        z = radius * np.sin(angle)
        vertices.append([x, height, z])
    
    # Brim (larger circle at bottom)
    brim_radius = 0.35
    for i in range(segments):
        angle = 2 * np.pi * i / segments
        x = brim_radius * np.cos(angle)
        z = brim_radius * np.sin(angle)
        vertices.append([x, -0.02, z])
    
    # Generate indices for wireframe
    # Crown sides
    for i in range(segments):
        next_i = (i + 1) % segments
        indices.extend([i, next_i])  # Bottom circle
        indices.extend([i + segments, next_i + segments])  # Top circle
        indices.extend([i, i + segments])  # Vertical lines
    
    # Brim
    for i in range(segments):
        next_i = (i + 1) % segments
        indices.extend([i + 2 * segments, next_i + 2 * segments])  # Brim circle
        indices.extend([i, i + 2 * segments])  # Connect to crown
    
    return vertices, indices

def create_gltf_buffer(vertices, indices, name="model"):
    """Create a complete glTF file structure"""
    
    # Convert vertices to binary buffer
    vertex_data = []
    for vertex in vertices:
        vertex_data.extend([float(v) for v in vertex])
    
    vertex_buffer = struct.pack(f'{len(vertex_data)}f', *vertex_data)
    
    # Convert indices to binary buffer  
    index_buffer = struct.pack(f'{len(indices)}H', *indices)
    
    # Combine buffers
    total_buffer = vertex_buffer + index_buffer
    
    # Calculate bounds
    vertices_array = np.array(vertices)
    min_vals = vertices_array.min(axis=0).tolist()
    max_vals = vertices_array.max(axis=0).tolist()
    
    # Create glTF JSON structure
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "AR-Face-Try-On Model Generator"
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [
            {
                "mesh": 0,
                "name": name
            }
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": 0
                        },
                        "indices": 1,
                        "mode": 1,  # LINES mode for wireframe
                        "material": 0
                    }
                ]
            }
        ],
        "materials": [
            {
                "name": f"{name}_material",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.1, 0.1, 0.1, 1.0],
                    "metallicFactor": 0.8,
                    "roughnessFactor": 0.2
                }
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices),
                "type": "VEC3",
                "min": min_vals,
                "max": max_vals
            },
            {
                "bufferView": 1, 
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": len(indices),
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(vertex_buffer),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_buffer),
                "byteLength": len(index_buffer),
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "buffers": [
            {
                "byteLength": len(total_buffer),
                "uri": f"data:application/octet-stream;base64,{base64.b64encode(total_buffer).decode()}"
            }
        ]
    }
    
    return json.dumps(gltf, indent=2)

def main():
    """Generate sample 3D models"""
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    
    print("Generating sample 3D models...")
    
    # Create glasses model
    glasses_vertices, glasses_indices = create_basic_glasses()
    glasses_gltf = create_gltf_buffer(glasses_vertices, glasses_indices, "basic_glasses")
    
    with open(os.path.join(models_dir, "basic_glasses.gltf"), "w") as f:
        f.write(glasses_gltf)
    
    print("✓ Created basic_glasses.gltf")
    
    # Create hat model
    hat_vertices, hat_indices = create_basic_hat()
    hat_gltf = create_gltf_buffer(hat_vertices, hat_indices, "basic_hat")
    
    with open(os.path.join(models_dir, "basic_hat.gltf"), "w") as f:
        f.write(hat_gltf)
    
    print("✓ Created basic_hat.gltf")
    print("Sample models generated successfully!")

if __name__ == "__main__":
    main()