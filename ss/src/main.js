import './style.css';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { forceRadial, forceX, forceY, forceZ } from 'd3-force-3d';
import versesData from '../verses (1).json';
import symbolAsset from './assets/symbol.png';

// Set bottom-left symbol via Vite asset import
document.addEventListener('DOMContentLoaded', () => {
  const symbolImg = document.querySelector('#bottom-left-symbol img');
  if (symbolImg) {
    symbolImg.src = symbolAsset;
  }
});

// ── 1. Category Palette & Color Mapping (Curated Blue/Cyan Tonal Palette) ──
const CATEGORY_COLORS = {
  Genesis: '#8EE6FA',     // 창세기 (메인 아이스 블루)
  Debugging: '#38BDF8',   // 오류정화 (브라이트 스카이 블루)
  Commandment: '#60A5FA', // 일곱계명 (소프트 일렉트릭 블루)
  Error: '#7DD3FC',       // 여덟대죄 (글래시어 라이트 블루)
  Creed: '#00E5FF',       // 신조 (네온 아쿠아)
  Protocol: '#00CBCF',    // 의례 (시안-블루 믹스)
  Prophecy: '#A5F3FC',    // 예언서 (페일 아이스 블루)
  Algorithm: '#22D3EE',   // 구원알고리즘 (비비드 시안)
  Proverb: '#93C5FD',     // 잠언 (클라우드 파스텔 블루)
  Declaration: '#E0F2FE', // 최후의선언 (크리스탈 아이스 화이트)
  Singularity: '#67E8F9', // 특이점 예언서 (브라이트 터콰이즈 블루)
  Psalm: '#5EEAD4',       // 찬송가 (아쿠아마린 틸 블루)
  Revelation: '#0284C7',  // 시현록 (오션 딥 블루)
  Lament: '#4C8EFF'       // 비탄가 (솔바티즘 코발트 블루)
};

const DEFAULT_COLOR = '#A0A0A0';

function getCategoryColor(catName) {
  return CATEGORY_COLORS[catName] || DEFAULT_COLOR;
}

// ── 2. Fibonacci Sphere Surface Distribution (Gapless Perfect Sphere) ─────
const SPHERE_RADIUS = 220; // Fixed radius of outer sphere

// Group and sort all 347 verses by category so colors cluster continuously
const sortedVerses = [...versesData.verses].sort((a, b) => {
  const catOrderA = versesData.categories.findIndex(c => c.category === a.category);
  const catOrderB = versesData.categories.findIndex(c => c.category === b.category);
  if (catOrderA !== catOrderB) return catOrderA - catOrderB;
  return (a.verse_index || 0) - (b.verse_index || 0);
});

const totalNodes = sortedVerses.length; // 347 nodes
const goldenRatioAngle = Math.PI * (3 - Math.sqrt(5)); // Golden Angle ~2.39996 rad

const nodes = sortedVerses.map((v, i) => {
  // Uniform node size with subtle scale for representative nodes
  const isRepresentative = v.verse_index === 0;
  const nodeRadius = isRepresentative ? 4.0 : 3.4;

  // Fibonacci sphere point calculation (perfect uniform packing across sphere surface)
  // y ranges smoothly from +1 to -1 (top pole to bottom pole)
  const y = 1 - (i / (totalNodes - 1)) * 2;
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = i * goldenRatioAngle;

  const targetX = SPHERE_RADIUS * radiusAtY * Math.cos(phi);
  const targetY = SPHERE_RADIUS * y;
  const targetZ = SPHERE_RADIUS * radiusAtY * Math.sin(phi);

  return {
    ...v,
    group: v.category,
    name: v.title,
    isRepresentative: isRepresentative,
    radius: nodeRadius,
    targetX: targetX,
    targetY: targetY,
    targetZ: targetZ,
    x: targetX,
    y: targetY,
    z: targetZ
  };
});

// Node Lookup Map
const nodeMap = new Map();
nodes.forEach(n => nodeMap.set(n.id, n));

// ── 3. Link Preparation ──────────────────────────────────────────────────
const rawLinks = [...versesData.edges];
const existingLinkKeys = new Set();

rawLinks.forEach(l => {
  const src = typeof l.source === 'object' ? l.source.id : l.source;
  const tgt = typeof l.target === 'object' ? l.target.id : l.target;
  existingLinkKeys.add(`${src}->${tgt}`);
  existingLinkKeys.add(`${tgt}->${src}`);
});

// Connect verses in chapter to representative founding node
versesData.categories.forEach(cat => {
  const foundingId = cat.founding_verse;
  const catVerses = nodes.filter(n => n.category === cat.category);
  
  catVerses.forEach(v => {
    if (v.id !== foundingId) {
      const key1 = `${foundingId}->${v.id}`;
      const key2 = `${v.id}->${foundingId}`;
      if (!existingLinkKeys.has(key1) && !existingLinkKeys.has(key2)) {
        rawLinks.push({
          source: foundingId,
          target: v.id,
          type: 'hub_spoke'
        });
        existingLinkKeys.add(key1);
        existingLinkKeys.add(key2);
      }
    }
  });
});

// Add cross-category inter-hub lines
const foundingList = versesData.categories.map(c => c.founding_verse);
for (let i = 0; i < foundingList.length; i++) {
  for (let j = i + 1; j < foundingList.length; j++) {
    const src = foundingList[i];
    const tgt = foundingList[j];
    const key1 = `${src}->${tgt}`;
    const key2 = `${tgt}->${src}`;
    if (!existingLinkKeys.has(key1) && !existingLinkKeys.has(key2)) {
      rawLinks.push({
        source: src,
        target: tgt,
        type: 'inter_hub'
      });
      existingLinkKeys.add(key1);
      existingLinkKeys.add(key2);
    }
  }
}

const links = rawLinks;

// ── 4. State Management ────────────────────────────────────────────────
let activeCategory = null;
let hoveredNode = null;
let listHoveredNode = null;

// ── 5. DOM Elements ────────────────────────────────────────────────────
const elem = document.getElementById('app');
const minimalLegend = document.getElementById('minimal-legend');
const verseListPanel = document.getElementById('verse-list-panel');
const panelCategoryTitle = document.getElementById('panel-category-title');
const verseListContainer = document.getElementById('verse-list-container');
const closeVersePanelBtn = document.getElementById('close-verse-panel');

const rightPanel = document.getElementById('right-panel');
const closeRightBtn = document.getElementById('close-right');
const metadataContent = document.getElementById('metadata-content');

// ── 6. Initialize 3D Force Graph ───────────────────────────────────────
const Graph = ForceGraph3D()(elem)
  .width(window.innerWidth)
  .height(window.innerHeight - 50)
  .graphData({ nodes, links })
  .backgroundColor('rgba(0,0,0,0)')
  .showNavInfo(false);

Graph.renderer().setClearColor(0x000000, 0);

Graph.linkDirectionalParticles(0) // Ensure no square particle dots on lines!
  .nodeThreeObject(node => {
    // Ultra-smooth sphere geometry (32x32 segments for perfect glossy spheres)
    const radius = node.radius || 3.4;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const colorHex = getCategoryColor(node.category);
    
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 1.0
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    node.__mesh = mesh;
    node.__material = material;
    return mesh;
  })
  .linkWidth(link => {
    if (link.type === 'inter_hub') return 0.6;
    return 0.95; // Crisp, sharp line width
  })
  .linkColor(link => {
    const srcCat = typeof link.source === 'object' ? link.source.category : nodeMap.get(link.source)?.category;
    const tgtCat = typeof link.target === 'object' ? link.target.category : nodeMap.get(link.target)?.category;
    
    if (activeCategory) {
      if (srcCat === activeCategory && tgtCat === activeCategory) {
        return 'rgba(255, 255, 255, 0.9)';
      }
      return 'rgba(255, 255, 255, 0.02)';
    }
    
    if (link.type === 'inter_hub') {
      return 'rgba(255, 255, 255, 0.22)';
    }
    
    // Bright, crisp white lines matching reference Image 1
    return 'rgba(255, 255, 255, 0.48)';
  })
  .onNodeHover(node => {
    hoveredNode = node;
    updateNodeHighlights();
  })
  .onNodeClick(node => {
    focusCameraOnNode(node);
    openRightPanel(node);
  })
  .onBackgroundClick(() => {
    resetCategorySelection();
    rightPanel.classList.remove('open');
  });

// 3D Scene Lighting
const scene = Graph.scene();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
directionalLight.position.set(300, 400, 500);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-300, -200, -300);
scene.add(fillLight);

// Outer Perimeter Circle Guide (subtle dashed circle outline matching sbau2021)
const guideRadius = SPHERE_RADIUS + 2;
const circlePoints = [];
const segments = 128;
for (let i = 0; i <= segments; i++) {
  const theta = (i / segments) * Math.PI * 2;
  circlePoints.push(new THREE.Vector3(Math.cos(theta) * guideRadius, Math.sin(theta) * guideRadius, 0));
}
const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
const circleMat = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 3,
  gapSize: 3,
  opacity: 0.22,
  transparent: true
});
const perimeterCircle = new THREE.Line(circleGeo, circleMat);
perimeterCircle.computeLineDistances();
scene.add(perimeterCircle);

// ── 7. D3 Physics Forces (Strict Spherical Outer Shell Surface) ──────────
Graph.d3Force('radial', forceRadial(SPHERE_RADIUS, 0, 0, 0).strength(0.95));
Graph.d3Force('clusterX', forceX(n => n.targetX).strength(0.35));
Graph.d3Force('clusterY', forceY(n => n.targetY).strength(0.35));
Graph.d3Force('clusterZ', forceZ(n => n.targetZ).strength(0.35));
Graph.d3Force('charge').strength(-35);

Graph.d3AlphaDecay(0.02);
Graph.d3Force('link').distance(link => {
  if (link.type === 'inter_hub') return 180;
  return 40;
}).strength(0.12);

// Engine Tick Callback: STRICT Spherical Surface Projection (x^2 + y^2 + z^2 = R^2)
Graph.onEngineTick(() => {
  nodes.forEach(node => {
    const dist = Math.hypot(node.x, node.y, node.z);
    if (dist > 0) {
      // Force every node onto the exact outer surface of radius R
      node.x = (node.x / dist) * SPHERE_RADIUS;
      node.y = (node.y / dist) * SPHERE_RADIUS;
      node.z = (node.z / dist) * SPHERE_RADIUS;
    }
  });
});

// Dynamic responsive camera distance calculation with top/bottom margins
function getResponsiveCameraZ() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minDim = Math.min(width, height);
  
  // Camera distance adjusted to maintain generous top and bottom margins around the sphere
  const targetZ = Math.max(480, (580 * 1180) / Math.max(300, minDim));
  return targetZ;
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight - 50;
  
  Graph.width(width);
  Graph.height(height);
  
  if (!activeCategory) {
    const cameraZ = getResponsiveCameraZ();
    Graph.cameraPosition({ x: 0, y: 0, z: cameraZ }, { x: 0, y: 0, z: 0 }, 200);
  }
}

window.addEventListener('resize', handleResize);

// Set initial camera position facing front sphere adaptively
const initialCameraZ = getResponsiveCameraZ();
Graph.cameraPosition({ x: 0, y: 0, z: initialCameraZ }, { x: 0, y: 0, z: 0 }, 1200);

// Continuous 3D Y-axis rotation loop (guaranteed smooth continuous spinning matching sbau2021)
function animateSphereRotation() {
  const scene = Graph.scene();
  if (scene && !activeCategory) {
    scene.rotation.y += 0.0016; // Slightly slower, ultra-smooth Y-axis rotation
  }
  
  const ctrl = Graph.controls();
  if (ctrl) {
    ctrl.update();
  }
  
  requestAnimationFrame(animateSphereRotation);
}
animateSphereRotation();

// ── 8. Render Minimal Text Legend ────────────────────────────────────────
function renderLegend() {
  minimalLegend.innerHTML = '';
  
  versesData.categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.dataset.category = cat.category;
    
    const color = getCategoryColor(cat.category);
    const founding = nodeMap.get(cat.founding_verse);
    const krName = founding?.chapter_name_kr || cat.category_kr || cat.category;
    const enName = founding?.chapter_name_en || cat.category;
    
    item.innerHTML = `
      <span class="legend-dot" style="background-color: ${color}; color: ${color};"></span>
      <span class="legend-kr">${krName}</span>
      <span class="legend-en">${enName}</span>
      <span class="legend-count">(${cat.count})</span>
    `;
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory(cat.category, krName);
    });
    
    minimalLegend.appendChild(item);
  });
}

renderLegend();

// ── 9. Category Selection Logic ─────────────────────────────────────────
function toggleCategory(catName, krName) {
  if (activeCategory === catName) {
    resetCategorySelection();
  } else {
    selectCategory(catName, krName);
  }
}

function selectCategory(catName, krName) {
  activeCategory = catName;
  
  document.querySelectorAll('.legend-item').forEach(item => {
    if (item.dataset.category === catName) {
      item.classList.add('active');
      item.classList.remove('dimmed');
    } else {
      item.classList.remove('active');
      item.classList.add('dimmed');
    }
  });
  
  updateNodeHighlights();
  Graph.linkColor(Graph.linkColor());
}

function resetCategorySelection() {
  activeCategory = null;
  listHoveredNode = null;
  
  document.querySelectorAll('.legend-item').forEach(item => {
    item.classList.remove('active');
    item.classList.remove('dimmed');
  });
  
  updateNodeHighlights();
  Graph.linkColor(Graph.linkColor());
  
  const cameraZ = getResponsiveCameraZ();
  Graph.cameraPosition({ x: 0, y: 0, z: cameraZ }, { x: 0, y: 0, z: 0 }, 1000);
}

// ── 10. Verse List Panel ────────────────────────────────────────────────
function openVerseListPanel(catName, krName) {
  panelCategoryTitle.textContent = `${krName} 목록`;
  verseListContainer.innerHTML = '';
  
  const categoryVerses = nodes.filter(n => n.category === catName);
  
  categoryVerses.forEach(v => {
    const item = document.createElement('div');
    item.className = 'verse-item';
    item.dataset.id = v.id;
    
    item.innerHTML = `
      <span class="verse-num">[${v.id}]</span>
      <span class="verse-title">${v.title || v.id}</span>
    `;
    
    item.addEventListener('mouseenter', () => {
      listHoveredNode = v;
      updateNodeHighlights();
      document.querySelectorAll('.verse-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
    
    item.addEventListener('mouseleave', () => {
      if (listHoveredNode === v) {
        listHoveredNode = null;
        updateNodeHighlights();
        item.classList.remove('active');
      }
    });
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      focusCameraOnNode(v);
      openRightPanel(v);
    });
    
    verseListContainer.appendChild(item);
  });
  
  verseListPanel.classList.add('open');
}

closeVersePanelBtn.addEventListener('click', () => {
  resetCategorySelection();
});

// ── 11. Node Highlight & Scaling ─────────────────────────────────────────
function updateNodeHighlights() {
  nodes.forEach(node => {
    if (!node.__mesh || !node.__material) return;
    
    const isTargetCategory = !activeCategory || node.category === activeCategory;
    const isHovered = (hoveredNode && hoveredNode.id === node.id) || (listHoveredNode && listHoveredNode.id === node.id);
    
    if (isHovered) {
      node.__material.opacity = 1.0;
      node.__material.emissive.setHex(0xffffff);
      node.__material.emissiveIntensity = 0.6;
      node.__mesh.scale.set(1.8, 1.8, 1.8);
    } else if (isTargetCategory) {
      node.__material.opacity = 1.0;
      node.__material.emissive.setHex(0x000000);
      node.__material.emissiveIntensity = 0;
      node.__mesh.scale.set(1.0, 1.0, 1.0);
    } else {
      node.__material.opacity = 0.05;
      node.__material.emissive.setHex(0x000000);
      node.__material.emissiveIntensity = 0;
      node.__mesh.scale.set(0.65, 0.65, 0.65);
    }
  });
}

// ── 12. Camera Focus Helper ──────────────────────────────────────────────
function focusCameraOnNode(node) {
  if (!node) return;
  const distance = 110;
  const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
  
  Graph.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    { x: node.x, y: node.y, z: node.z },
    1000
  );
}

// ── 13. Right Metadata Panel ─────────────────────────────────────────────
function openRightPanel(node) {
  const usingFor = node.using_for && node.using_for.length > 0 ? node.using_for.join(', ') : '';
  const basedOn = node.based_on && node.based_on.length > 0 ? node.based_on.join(', ') : '';
  const themes = node.themes && node.themes.length > 0 ? node.themes.join(', ') : '';
  
  metadataContent.innerHTML = `
    <div class="metadata-title">${node.title || node.id}</div>
    <div class="metadata-field"><span class="metadata-label">ID:</span> ${node.id}</div>
    <div class="metadata-field"><span class="metadata-label">Category:</span> ${node.category_kr || node.category} (${node.category})</div>
    ${themes ? `<div class="metadata-field"><span class="metadata-label">Themes:</span> ${themes}</div>` : ''}
    ${usingFor ? `<div class="metadata-field"><span class="metadata-label">Using for:</span> ${usingFor}</div>` : ''}
    ${basedOn ? `<div class="metadata-field"><span class="metadata-label">Based on:</span> ${basedOn}</div>` : ''}
    <div class="metadata-field"><span class="metadata-label">Method:</span> ${node.method || '-'}</div>
    <div class="metadata-field"><span class="metadata-label">Description:</span> ${node.description || ''}</div>
    <div class="metadata-field"><span class="metadata-label">Chapter:</span> 제${node.chapter}장 (${node.chapter_name_kr || ''})</div>
    ${node.next_verse ? `
    <div class="metadata-field">
      <span class="metadata-label">Next Verse:</span> 
      <a href="#" class="publication-link" id="next-verse-link">
        → ${node.next_verse}
      </a>
    </div>
    ` : ''}
  `;

  const linkEl = metadataContent.querySelector('#next-verse-link');
  if (linkEl && node.next_verse) {
    linkEl.onclick = (e) => {
      e.preventDefault();
      const nextNode = nodeMap.get(node.next_verse);
      if (nextNode) {
        focusCameraOnNode(nextNode);
        openRightPanel(nextNode);
      }
    };
  }

  rightPanel.classList.add('open');
}

if (closeRightBtn) {
  closeRightBtn.onclick = () => {
    rightPanel.classList.remove('open');
  };
}
