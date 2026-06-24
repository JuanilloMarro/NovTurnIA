import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * AIOrb — esfera de dots (nube de puntos) deformada por olas (Three.js / WebGL).
 * ─────────────────────────────────────────────────────────────────────────────
 * Una esfera cubierta de ~6000 dots distribuidos uniformemente (esfera de
 * Fibonacci). Cada dot se desplaza a lo largo de su normal con ruido simplex en
 * capas → la superficie ondula como un blob vivo. Respira (escala pulsante) y
 * gira muy lento para leerse como volumen 3D. Degradado cyan→azul→violeta + glow
 * aditivo, igual que la referencia.
 *
 * Respeta prefers-reduced-motion y se pausa cuando la pestaña está oculta.
 */

const POINT_COUNT = 6000;
const SPHERE_RADIUS = 1.35;

// Degradado del fondo del sistema (violeta → azul → índigo)
const C_TOP = [0.62, 0.58, 0.98];  // violeta claro (acento del fondo)
const C_MID = [0.40, 0.56, 0.96];  // azul
const C_BOT = [0.36, 0.40, 0.82];  // índigo profundo

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const vertexShader = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uHeight;
  attribute float aSize;
  attribute vec3  aColor;
  varying vec3  vColor;
  varying float vGlow;

  // ── Simplex noise 3D (Ashima / Stefan Gustavson) ──
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vec3 n = normalize(position);
    float t = uTime * 0.4;

    // Olas: ruido en capas que deforman la esfera en un blob vivo
    float disp = 0.0;
    disp += snoise(n * 1.5 + vec3(0.0, t, 0.0))            * 0.55;
    disp += snoise(n * 3.0 + vec3(t * 0.7, 0.0, t * 0.5))  * 0.28;
    disp += snoise(n * 6.0 - vec3(t * 0.45))               * 0.13;

    // Respiración + desplazamiento por las olas a lo largo de la normal
    // (amplitud baja → dots más unidos, blob más cohesivo)
    float breathe = 1.0 + sin(uTime * 1.05) * 0.05;
    vec3 pos = position * breathe + n * disp * 0.26;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Tamaño de dot responsive (más grande las crestas de las olas)
    float sz = aSize * (0.85 + 0.5 * clamp(disp, 0.0, 1.0));
    gl_PointSize = max(1.2, sz * (uHeight * 0.010) / -mv.z);

    vColor = aColor;
    vGlow  = 0.6 + 0.4 * clamp(disp * 0.5 + 0.5, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  varying vec3  vColor;
  varying float vGlow;

  void main() {
    // Dot circular suave
    vec2  uv   = gl_PointCoord - 0.5;
    float d    = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.06, d) * vGlow;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export default function AIOrb({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 4.0);

    // ── Nube de puntos: esfera de Fibonacci (distribución uniforme) ──
    const positions = new Float32Array(POINT_COUNT * 3);
    const colors = new Float32Array(POINT_COUNT * 3);
    const sizes = new Float32Array(POINT_COUNT);
    const golden = Math.PI * (3 - Math.sqrt(5));
    let seed = 1;
    const rand = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (i / (POINT_COUNT - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * golden;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      positions[i * 3] = x * SPHERE_RADIUS;
      positions[i * 3 + 1] = y * SPHERE_RADIUS;
      positions[i * 3 + 2] = z * SPHERE_RADIUS;

      // Color por altura: violeta abajo → azul medio → cyan arriba
      const ty = y * 0.5 + 0.5;
      const c = ty > 0.5 ? mix3(C_MID, C_TOP, (ty - 0.5) * 2) : mix3(C_BOT, C_MID, ty * 2);
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];

      sizes[i] = 1.6 + rand() * 1.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: 600 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const cloud = new THREE.Points(geo, mat);
    scene.add(cloud);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      mat.uniforms.uHeight.value = renderer.domElement.height;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;

    function render(time) {
      mat.uniforms.uTime.value = time;
      // Giro muy lento para leerse como volumen 3D (sutil, no un spin)
      cloud.rotation.y = time * 0.12;
      cloud.rotation.x = Math.sin(time * 0.15) * 0.12;
      renderer.render(scene, camera);
    }
    function frame(now) {
      if (!document.hidden) render((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    }

    if (reduce) render(0);
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
