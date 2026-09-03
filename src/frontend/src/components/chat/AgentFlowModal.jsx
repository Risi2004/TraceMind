import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  XIcon,
  RotateCcwIcon,
  SparklesIcon,
  SearchIcon,
  BrainIcon,
  ShieldCheckIcon,
  FileTextIcon,
  NetworkIcon,
  ActivityIcon
} from '../common/Icons';
import './AgentFlowModal.css';

// Visual color palette and icons for each agent type
const AGENT_CONFIG = {
  planner: {
    label: 'Planner Agent',
    color: '#00f2fe',
    emissive: '#00c6ff',
    icon: BrainIcon,
    description: 'Deconstructs question and formulates search plan',
  },
  retrieval: {
    label: 'Retrieval Agent',
    color: '#3b82f6',
    emissive: '#1d4ed8',
    icon: SearchIcon,
    description: 'Executes dense vector search in Qdrant Cloud',
  },
  evidence: {
    label: 'Evidence Agent',
    color: '#a855f7',
    emissive: '#7e22ce',
    icon: FileTextIcon,
    description: 'Analyzes retrieved passages & extracts verified claims',
  },
  conflict: {
    label: 'Conflict Agent',
    color: '#f59e0b',
    emissive: '#d97706',
    icon: ActivityIcon,
    description: 'Cross-examines evidence & resolves source discrepancies',
  },
  sufficiency: {
    label: 'Sufficiency Agent',
    color: '#10b981',
    emissive: '#059669',
    icon: ShieldCheckIcon,
    description: 'Verifies evidence completeness & grounding standards',
  },
  followup: {
    label: 'Follow-up Agent',
    color: '#6366f1',
    emissive: '#4338ca',
    icon: NetworkIcon,
    description: 'Generates targeted query for missing information',
  },
  answer: {
    label: 'Answer Agent',
    color: '#ec4899',
    emissive: '#db2777',
    icon: SparklesIcon,
    description: 'Synthesizes grounded answer with source citations',
  },
};

export const AgentFlowModal = ({ isOpen, onClose, flowData }) => {
  const mountRef = useRef(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState(null);
  const [isRotating, setIsRotating] = useState(true);

  // Extract events and summary metrics
  const rawEvents = flowData?.events || flowData?.investigationFlow?.events || [];
  const searchRounds = flowData?.searchRounds || flowData?.investigationFlow?.searchRounds || 1;
  const sourcesReviewed = flowData?.sourcesReviewed || flowData?.investigationFlow?.sourcesReviewed || 0;
  const conflictsDetected = flowData?.conflictsDetected || flowData?.investigationFlow?.conflictsDetected || 0;

  // If events are empty, construct clean fallback events from steps
  const events = React.useMemo(() => {
    if (rawEvents.length > 0) return rawEvents;

    const steps = flowData?.investigationSteps || flowData?.investigationFlow?.investigationSteps || [];
    if (steps.length > 0) {
      return steps.map((s, idx) => {
        let agent = 'retrieval';
        if (s.icon === 'brain' || s.title?.toLowerCase().includes('plan')) agent = 'planner';
        else if (s.icon === 'layers' || s.title?.toLowerCase().includes('evidence')) agent = 'evidence';
        else if (s.icon === 'alert' || s.title?.toLowerCase().includes('conflict')) agent = 'conflict';
        else if (s.icon === 'shield' || s.title?.toLowerCase().includes('sufficient')) agent = 'sufficiency';
        else if (s.icon === 'sparkles' || s.title?.toLowerCase().includes('answer')) agent = 'answer';
        else if (s.title?.toLowerCase().includes('follow')) agent = 'followup';

        return {
          agent,
          event: `${agent.toUpperCase()}_STEP`,
          round: 1,
          message: s.title || 'Operational step executed',
          timestamp: new Date().toISOString(),
          metadata: { details: s.details, found: s.found },
        };
      });
    }

    // Default minimal flow
    return [
      { agent: 'planner', event: 'PLANNING_COMPLETED', round: 1, message: 'Planning investigation', timestamp: new Date().toISOString() },
      { agent: 'retrieval', event: 'SEARCH_COMPLETED', round: 1, message: 'Searching documents', timestamp: new Date().toISOString(), metadata: { sourcesFound: sourcesReviewed } },
      { agent: 'evidence', event: 'EVIDENCE_ANALYZED', round: 1, message: 'Analyzing retrieved evidence', timestamp: new Date().toISOString() },
      { agent: 'sufficiency', event: 'SUFFICIENCY_EVALUATED', round: 1, message: 'Evidence sufficient', timestamp: new Date().toISOString() },
      { agent: 'answer', event: 'ANSWER_GENERATED', round: 1, message: 'Generating final answer', timestamp: new Date().toISOString(), metadata: { sourcesUsed: sourcesReviewed } },
    ];
  }, [rawEvents, flowData, sourcesReviewed]);

  // When live events update, auto-select the active or latest running step
  useEffect(() => {
    if (flowData?.isLive) {
      const runningIdx = events.findIndex(e => e.status === 'running');
      if (runningIdx >= 0) {
        setSelectedNodeIndex(runningIdx);
      } else if (events.length > 0) {
        setSelectedNodeIndex(events.length - 1);
      }
    }
  }, [events, flowData?.isLive]);

  const sceneRefs = useRef({
    scene: null,
    camera: null,
    renderer: null,
    nodesGroup: null,
    linesGroup: null,
    particlesGroup: null,
    animationId: null,
    nodeMeshes: [],
    curvePoints: [],
    targetCameraPos: new THREE.Vector3(0, 0, 18),
    targetLookAt: new THREE.Vector3(0, 0, 0),
  });

  // Calculate 3D node coordinates
  const nodePositions = React.useMemo(() => {
    const total = events.length;
    const positions = [];

    events.forEach((ev, idx) => {
      const round = ev.round || 1;
      const progress = idx / Math.max(1, total - 1);
      
      // Vertical descent
      const y = 6 - progress * 12;

      // Lateral S-curve / helix layout
      const angle = progress * Math.PI * 2.5 + (round - 1) * 0.8;
      const radius = 3.5 + Math.sin(progress * Math.PI) * 1.2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * (radius * 0.7);

      positions.push(new THREE.Vector3(x, y, z));
    });

    return positions;
  }, [events]);

  // Handle camera reset
  const handleResetCamera = useCallback(() => {
    if (sceneRefs.current.camera) {
      sceneRefs.current.targetCameraPos.set(0, 0, 18);
      sceneRefs.current.targetLookAt.set(0, 0, 0);
      setIsRotating(true);
    }
  }, []);

  // Setup Three.js Scene
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.025);
    sceneRefs.current.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);
    sceneRefs.current.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    sceneRefs.current.renderer = renderer;

    // Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.5);
    dirLight1.position.set(10, 15, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 1.2);
    dirLight2.position.set(-10, -15, -10);
    scene.add(dirLight2);

    // Subtle Particle Background
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 40;
      particlePositions[i + 1] = (Math.random() - 0.5) * 40;
      particlePositions[i + 2] = (Math.random() - 0.5) * 40;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const backgroundParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(backgroundParticles);

    // Groups
    const nodesGroup = new THREE.Group();
    const linesGroup = new THREE.Group();
    const particlesGroup = new THREE.Group();
    scene.add(nodesGroup);
    scene.add(linesGroup);
    scene.add(particlesGroup);
    sceneRefs.current.nodesGroup = nodesGroup;
    sceneRefs.current.linesGroup = linesGroup;
    sceneRefs.current.particlesGroup = particlesGroup;

    // Create 3D Nodes
    const nodeMeshes = [];
    nodePositions.forEach((pos, i) => {
      const ev = events[i];
      const cfg = AGENT_CONFIG[ev.agent] || AGENT_CONFIG.retrieval;

      const nodeContainer = new THREE.Group();
      nodeContainer.position.copy(pos);

      // Core Sphere
      const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.color),
        emissive: new THREE.Color(cfg.emissive),
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.8,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.userData = { index: i, event: ev, agent: ev.agent };
      nodeContainer.add(sphere);

      // Outer Wireframe Glow Ring
      const ringGeo = new THREE.TorusGeometry(0.85, 0.03, 16, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(cfg.color),
        transparent: true,
        opacity: 0.7,
        wireframe: true,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      nodeContainer.add(ring);

      // Point Light per node
      const pLight = new THREE.PointLight(cfg.color, 1.2, 5);
      nodeContainer.add(pLight);

      // Text Sprite Label
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(10, 16, 30, 0.85)';
      ctx.roundRect(0, 0, 256, 64, 12);
      ctx.fill();
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.roundRect(0, 0, 256, 64, 12);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg.label.split(' ')[0]} (R${ev.round || 1})`, 128, 38);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 1.1, 0);
      sprite.scale.set(2.2, 0.55, 1);
      nodeContainer.add(sprite);

      nodesGroup.add(nodeContainer);
      nodeMeshes.push({ container: nodeContainer, sphere, ring, sprite, baseColor: cfg.color });
    });
    sceneRefs.current.nodeMeshes = nodeMeshes;

    // Create Connection Lines and Energy Particles
    const flowCurves = [];
    for (let i = 0; i < nodePositions.length - 1; i++) {
      const start = nodePositions[i];
      const end = nodePositions[i + 1];

      // Create smooth 3D curved link
      const mid = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0.5, 0.3, 0.5));

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      flowCurves.push(curve);

      // Tube Geometry for glow
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.04, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      linesGroup.add(tubeMesh);

      // Animated energy particle along tube
      const particleGeom = new THREE.SphereGeometry(0.12, 16, 16);
      const particleM = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const particle = new THREE.Mesh(particleGeom, particleM);
      particlesGroup.add(particle);
      particle.userData = { curve, progress: Math.random() };
    }

    // Raycasting for Mouse Hover and Clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map(n => n.sphere));

      if (intersects.length > 0) {
        const idx = intersects[0].object.userData.index;
        setHoveredNodeIndex(idx);
        container.style.cursor = 'pointer';
      } else {
        setHoveredNodeIndex(null);
        container.style.cursor = 'grab';
      }
    };

    const handlePointerDown = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map(n => n.sphere));

      if (intersects.length > 0) {
        const idx = intersects[0].object.userData.index;
        setSelectedNodeIndex(idx);
        setIsRotating(false);

        // Smoothly focus camera towards selected node
        const targetPos = nodePositions[idx];
        sceneRefs.current.targetCameraPos.set(targetPos.x * 0.7, targetPos.y, targetPos.z + 8);
        sceneRefs.current.targetLookAt.copy(targetPos);
      }
    };

    // Drag-to-rotate handling
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      if (e.target !== renderer.domElement) return;
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
      setIsRotating(false);
    };

    const onMouseMove = (e) => {
      handlePointerMove(e);
      if (!isDragging) return;

      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      nodesGroup.rotation.y += deltaX * 0.008;
      linesGroup.rotation.y += deltaX * 0.008;
      particlesGroup.rotation.y += deltaX * 0.008;

      nodesGroup.rotation.x += deltaY * 0.005;
      linesGroup.rotation.x += deltaY * 0.005;
      particlesGroup.rotation.x += deltaY * 0.005;

      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Zoom on wheel
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.015, 6, 30);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Gentle auto-rotation
      if (isRotating) {
        nodesGroup.rotation.y += 0.004;
        linesGroup.rotation.y += 0.004;
        particlesGroup.rotation.y += 0.004;
      }

      // Smooth camera lerp
      camera.position.lerp(sceneRefs.current.targetCameraPos, 0.05);

      // Animate rings and node glow
      nodeMeshes.forEach((mesh, idx) => {
        mesh.ring.rotation.z += 0.02;
        mesh.ring.rotation.x += 0.01;

        // Hover / Select scale pulse
        const isSelected = idx === selectedNodeIndex;
        const isHovered = idx === hoveredNodeIndex;
        const targetScale = isSelected ? 1.35 : isHovered ? 1.2 : 1.0;
        mesh.container.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        if (isSelected) {
          mesh.ring.material.opacity = 0.9 + Math.sin(time * 6) * 0.1;
        }
      });

      // Animate flowing particles along curves
      particlesGroup.children.forEach((p) => {
        if (p.userData?.curve) {
          p.userData.progress += delta * 0.6;
          if (p.userData.progress > 1) p.userData.progress = 0;
          const pos = p.userData.curve.getPoint(p.userData.progress);
          p.position.copy(pos);
        }
      });

      // Rotate background particles
      backgroundParticles.rotation.y = time * 0.02;

      renderer.render(scene, camera);
      sceneRefs.current.animationId = requestAnimationFrame(animate);
    };

    animate();

    // Window Resize handling
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (sceneRefs.current.animationId) {
        cancelAnimationFrame(sceneRefs.current.animationId);
      }
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isOpen, events, nodePositions, selectedNodeIndex, hoveredNodeIndex, isRotating]);

  if (!isOpen) return null;

  const currentEvent = events[selectedNodeIndex] || events[0] || {};
  const currentAgentCfg = AGENT_CONFIG[currentEvent.agent] || AGENT_CONFIG.retrieval;
  const CurrentIcon = currentAgentCfg.icon;

  return (
    <div className="agent-flow-modal-overlay" onClick={onClose}>
      <div className="agent-flow-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header with Live Investigation Summary */}
        <div className="agent-flow-header">
          <div className="agent-flow-title-group">
            <div className="flow-badge-glow">
              <NetworkIcon size={20} className="text-cyan" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h2 className="agent-flow-title">Investigation Execution Flow</h2>
                {flowData?.isLive && (
                  <div className="flow-live-indicator-pill">
                    <span className="live-pulsing-dot" />
                    <span>LIVE PIPELINE ACTIVE</span>
                  </div>
                )}
              </div>
              <p className="agent-flow-subtitle">
                Interactive 3D trace of the real Google ADK multi-agent execution
              </p>
            </div>
          </div>

          <div className="agent-flow-metrics-bar">
            <div className="flow-metric-pill">
              <span className="metric-label">Search Rounds:</span>
              <span className="metric-val text-cyan">{searchRounds}</span>
            </div>
            <div className="flow-metric-pill">
              <span className="metric-label">Sources Reviewed:</span>
              <span className="metric-val text-blue">{sourcesReviewed}</span>
            </div>
            <div className={`flow-metric-pill ${conflictsDetected > 0 ? 'conflict-pill' : ''}`}>
              <span className="metric-label">Conflicts Detected:</span>
              <span className={`metric-val ${conflictsDetected > 0 ? 'text-amber' : 'text-emerald'}`}>
                {conflictsDetected}
              </span>
            </div>
          </div>

          <div className="flow-header-actions">
            <button
              type="button"
              className="flow-icon-btn"
              onClick={handleResetCamera}
              title="Reset 3D Camera View"
            >
              <RotateCcwIcon size={16} />
              <span>Reset View</span>
            </button>
            <button
              type="button"
              className="flow-close-btn"
              onClick={onClose}
              title="Close Agent Flow Modal"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: 3D Canvas + Side Details Drawer */}
        <div className="agent-flow-body">
          {/* 3D WebGL Canvas Container */}
          <div className="threejs-canvas-wrapper" ref={mountRef}>
            <div className="canvas-interaction-hint">
              <span>🖱️ Drag to rotate 3D view | Scroll to zoom | Click any node to inspect</span>
            </div>
          </div>

          {/* Right-hand Node Details Drawer */}
          <div className="flow-details-drawer">
            <div className="drawer-header" style={{ borderLeftColor: currentAgentCfg.color }}>
              <div className="agent-avatar-icon" style={{ backgroundColor: `${currentAgentCfg.color}20`, color: currentAgentCfg.color }}>
                <CurrentIcon size={20} />
              </div>
              <div className="drawer-heading">
                <div className="drawer-step-tag-row">
                  <span className="drawer-step-tag">
                    Step {selectedNodeIndex + 1} of {events.length} • Round {currentEvent.round || 1}
                  </span>
                  {currentEvent.status === 'running' ? (
                    <span className="agent-status-tag running">🟡 Running</span>
                  ) : (
                    <span className="agent-status-tag completed">🟢 Completed</span>
                  )}
                </div>
                <h3 className="drawer-agent-name" style={{ color: currentAgentCfg.color }}>
                  {currentAgentCfg.label}
                </h3>
              </div>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">
                <span className="section-label">Operational Event</span>
                <p className="drawer-event-msg">{currentEvent.message || 'Executed verification task'}</p>
              </div>

              <div className="drawer-section">
                <span className="section-label">Agent Role</span>
                <p className="drawer-agent-desc">{currentAgentCfg.description}</p>
              </div>

              {/* Safe Operational Metadata (No private Chain-of-thought) */}
              {currentEvent.metadata && Object.keys(currentEvent.metadata).length > 0 && (
                <div className="drawer-section">
                  <span className="section-label">Operational Metadata</span>
                  <div className="metadata-grid">
                    {currentEvent.metadata.sourcesFound !== undefined && (
                      <div className="meta-card">
                        <span className="meta-key">Passages Found</span>
                        <span className="meta-value text-blue">{currentEvent.metadata.sourcesFound}</span>
                      </div>
                    )}
                    {currentEvent.metadata.factsExtracted !== undefined && (
                      <div className="meta-card">
                        <span className="meta-key">Facts Extracted</span>
                        <span className="meta-value text-purple">{currentEvent.metadata.factsExtracted}</span>
                      </div>
                    )}
                    {currentEvent.metadata.isSufficient !== undefined && (
                      <div className="meta-card">
                        <span className="meta-key">Sufficiency Status</span>
                        <span className={`meta-value ${currentEvent.metadata.isSufficient ? 'text-emerald' : 'text-amber'}`}>
                          {currentEvent.metadata.isSufficient ? 'Verified & Complete' : 'Additional Search Needed'}
                        </span>
                      </div>
                    )}
                    {currentEvent.metadata.confidenceScore !== undefined && (
                      <div className="meta-card">
                        <span className="meta-key">Confidence Score</span>
                        <span className="meta-value text-emerald">{currentEvent.metadata.confidenceScore}%</span>
                      </div>
                    )}
                    {currentEvent.metadata.conflictType && (
                      <div className="meta-card full-width">
                        <span className="meta-key">Discrepancy Category</span>
                        <span className="meta-value text-amber">{currentEvent.metadata.conflictType}</span>
                      </div>
                    )}
                    {currentEvent.metadata.searchRationale && (
                      <div className="meta-card full-width">
                        <span className="meta-key">Search Focus</span>
                        <span className="meta-value text-indigo">{currentEvent.metadata.searchRationale}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentEvent.timestamp && (
                <div className="drawer-footer-timestamp">
                  <span>Timestamp: {new Date(currentEvent.timestamp).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Stepper Navigation Controls */}
            <div className="drawer-footer-nav">
              <button
                type="button"
                className="step-nav-btn"
                disabled={selectedNodeIndex === 0}
                onClick={() => setSelectedNodeIndex((prev) => Math.max(0, prev - 1))}
              >
                ← Prev Step
              </button>
              <button
                type="button"
                className="step-nav-btn primary"
                disabled={selectedNodeIndex === events.length - 1}
                onClick={() => setSelectedNodeIndex((prev) => Math.min(events.length - 1, prev + 1))}
              >
                Next Step →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentFlowModal;
