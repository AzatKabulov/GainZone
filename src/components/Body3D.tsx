/* eslint-disable react-hooks/refs -- imperative WebGL bridge: all mutable scene state lives in refs and is only touched from GL / gesture callbacks */
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Platform, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import { BODY_MESH } from '@/data/bodyMesh';
import { Body2D } from './Body2D';
import type { MuscleId } from '@/data/muscles';

/**
 * Stylised low-poly muscle figure (built from BodyParts3D via open-anatomy-3d, CC BY 4.0), rendered with
 * three.js on expo-gl. Every facet carries a muscle region, so the whole body is one flat-shaded mesh that is
 * recoloured on the fly. One finger spins it, two fingers zoom, a tap selects a muscle.
 */

export const ANATOMY_CREDIT = 'Anatomy: BodyParts3D © DBCLS (CC BY 4.0) via open-anatomy-3d';

const SKIN = 255;
const UNDER = 254;
const IDLE_LABEL = 253;


interface Decoded {
  /** non-indexed, flat-shaded triangles */
  geometry: THREE.BufferGeometry;
  /** region of every triangle */
  faceLab: Uint8Array;
  center: number;
  height: number;
}

let cache: Decoded | null = null;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(b64: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // fallback decoder (no atob)
  const lut = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lut[B64.charCodeAt(i)] = i;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((b64.length * 3) / 4 - pad);
  let o = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const n = (lut[b64.charCodeAt(i)] << 18) | (lut[b64.charCodeAt(i + 1)] << 12) | (lut[b64.charCodeAt(i + 2)] << 6) | lut[b64.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Decode the packed mesh once per app run and unweld it into flat facets. */
function getBody(): Decoded {
  if (cache) return cache;
  const M = BODY_MESH;
  const bytes = decodeBase64(M.data);
  const buf = bytes.buffer as ArrayBuffer;
  let off = 0;
  const take = <T,>(C: new (b: ArrayBuffer, o: number, n: number) => T, n: number, size: number) => {
    const a = new C(buf, off, n);
    off += size;
    return a;
  };
  const V = M.vertexCount;
  const pos = take(Int16Array, V * 3, M.sizes[0]);
  take(Int8Array, V * 3, M.sizes[1]); // smooth normals: unused by the faceted look
  const lab = take(Uint8Array, V, M.sizes[2]);
  take(Uint8Array, V, M.sizes[3]);
  take(Uint8Array, V, M.sizes[4]);
  const ind = M.bigIndex ? take(Uint32Array, M.indexCount, M.sizes[5]) : take(Uint16Array, M.indexCount, M.sizes[5]);
  const P = new Float32Array(V * 3);
  for (let i = 0; i < V; i++)
    for (let a = 0; a < 3; a++) P[i * 3 + a] = M.min[a] + ((pos[i * 3 + a] + 32768) / 65535) * (M.max[a] - M.min[a]);

  const F = M.indexCount / 3;
  const fp = new Float32Array(F * 9);
  const fn = new Float32Array(F * 9);
  const faceLab = new Uint8Array(F);
  for (let f = 0; f < F; f++) {
    const a = ind[f * 3] * 3;
    const b = ind[f * 3 + 1] * 3;
    const c = ind[f * 3 + 2] * 3;
    const la = lab[a / 3];
    const lb = lab[b / 3];
    const lc = lab[c / 3];
    faceLab[f] = lb === lc ? lb : la;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    let k = f * 9;
    for (const v of [a, b, c]) {
      fp[k] = P[v];
      fp[k + 1] = P[v + 1];
      fp[k + 2] = P[v + 2];
      fn[k] = nx;
      fn[k + 1] = ny;
      fn[k + 2] = nz;
      k += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(fn, 3));
  geometry.computeBoundingSphere();
  cache = { geometry, faceLab, center: (M.min[1] + M.max[1]) / 2, height: M.max[1] - M.min[1] };
  return cache;
}

/**
 * three r163+ only renders with WebGL 2 and refuses any context that is `instanceof WebGLRenderingContext`.
 * Expo Go's native expo-gl can hand out a WebGL 2-capable (OpenGL ES 3) context whose class still inherits from
 * WebGLRenderingContext, so the check is hidden while the renderer is constructed. A real WebGL 1 context
 * (no `supportsWebGL2`) is rejected up front; the caller then shows the flat fallback.
 */
function createRenderer(gl: ExpoWebGLRenderingContext, canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const flags = gl as unknown as { supportsWebGL2?: boolean };
  if (Platform.OS !== 'web' && flags.supportsWebGL2 === false) throw new Error('WebGL 2 is not available');
  const g = globalThis as unknown as { WebGLRenderingContext?: unknown };
  const saved = g.WebGLRenderingContext;
  const hide = Platform.OS !== 'web' && typeof saved === 'function';
  if (hide) g.WebGLRenderingContext = function NotWebGL1() {};
  try {
    return new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
  } finally {
    if (hide) g.WebGLRenderingContext = saved;
  }
}

export interface BodyPalette {
  skin: string;
  under: string;
  idle: string;
}

export const DARK_BODY: BodyPalette = { skin: '#55555F', under: '#17171B', idle: '#6A6A75' };
export const LIGHT_BODY: BodyPalette = { skin: '#A9A49A', under: '#8A857C', idle: '#C4BEB2' };

function paint(geo: THREE.BufferGeometry, d: Decoded, colors: Partial<Record<MuscleId, string>>, palette: BodyPalette, selected: MuscleId | null) {
  const muscles = BODY_MESH.muscles as MuscleId[];
  const table: THREE.Color[] = [];
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i < 256; i++) {
    let c: THREE.Color;
    if (i === SKIN) c = new THREE.Color(palette.skin);
    else if (i === UNDER) c = new THREE.Color(palette.under);
    else if (i === IDLE_LABEL || i >= muscles.length) c = new THREE.Color(palette.idle);
    else {
      const id = muscles[i];
      c = new THREE.Color(colors[id] ?? palette.idle);
      if (selected) c = id === selected ? c.lerp(white, 0.25) : c.multiplyScalar(0.5);
    }
    if (selected && i >= muscles.length) c.multiplyScalar(0.6);
    table.push(c);
  }
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const arr = col.array as Float32Array;
  for (let f = 0; f < d.faceLab.length; f++) {
    const t = table[d.faceLab[f]];
    for (let k = f * 9; k < f * 9 + 9; k += 3) {
      arr[k] = t.r;
      arr[k + 1] = t.g;
      arr[k + 2] = t.b;
    }
  }
  col.needsUpdate = true;
}

export interface Body3DProps {
  colors: Partial<Record<MuscleId, string>>;
  palette: BodyPalette;
  background: string;
  /** colour of the floor ring (the accent) */
  ring?: string;
  selected?: MuscleId | null;
  onSelect?: (m: MuscleId | null) => void;
  /** horizontal shift of the figure (−1 … 1), used to make room for a side panel */
  shift?: number;
  /** turn to an angle (0 = front, π = back) when this changes */
  facing?: { angle: number; n: number };
  /** turn 180° (to the nearest front / back view) whenever this number changes */
  flip?: number;
  /** start angle */
  initialAngle?: number;
  /** frame only the upper body / lower body */
  focus?: 'full' | 'upper' | 'lower';
  /** slow idle spin until touched */
  autoRotate?: boolean;
  /** called with true when a drag starts and false when it ends (to lock a parent ScrollView) */
  onInteract?: (active: boolean) => void;
  /** show front and back side by side (static) */
  dual?: boolean;
  /** disable touch (rotate / zoom / select) */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FOCUS = {
  full: { y: 0.02, dist: 3.85 },
  upper: { y: 0.42, dist: 2.3 },
  lower: { y: -0.32, dist: 2.9 },
};

export function Body3D({
  colors,
  palette,
  background,
  ring,
  selected = null,
  onSelect,
  shift = 0,
  facing,
  flip = 0,
  initialAngle = 0.32,
  focus = 'full',
  autoRotate = false,
  onInteract,
  dual = false,
  interactive = true,
  style,
}: Body3DProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const st = useRef({
    renderer: null as THREE.WebGLRenderer | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    mesh: null as THREE.Mesh | null,
    ring: null as THREE.Mesh | null,
    rotY: initialAngle,
    targetY: NaN,
    velY: 0,
    dist: FOCUS[focus].dist,
    camY: FOCUS[focus].y,
    shift: 0,
    shiftTarget: 0,
    spin: autoRotate,
    dirty: true,
    raf: 0,
    size: { w: 0, h: 0 },
    pinch: 0,
  });
  const props = useRef({ colors, palette, selected, onSelect, background, onInteract, ring });
  useLayoutEffect(() => {
    props.current = { colors, palette, selected, onSelect, background, onInteract, ring };
  });

  useEffect(() => {
    const s = st.current;
    if (!s.mesh) return;
    paint(s.mesh.geometry, getBody(), colors, palette, selected);
    s.dirty = true;
  }, [colors, palette, selected]);

  useEffect(() => {
    const s = st.current;
    if (s.scene?.background) (s.scene.background as THREE.Color).set(background);
    s.dirty = true;
  }, [background]);

  useEffect(() => {
    st.current.shiftTarget = shift;
    st.current.dirty = true;
  }, [shift]);

  useEffect(() => {
    if (!facing) return;
    const s = st.current;
    const full = Math.PI * 2;
    const cur = s.rotY;
    s.targetY = cur + ((((facing.angle - cur) % full) + full + Math.PI) % full) - Math.PI;
    s.velY = 0;
    s.spin = false;
    s.dirty = true;
  }, [facing]);

  const flipped = useRef(flip);
  useEffect(() => {
    if (flip === flipped.current) return;
    flipped.current = flip;
    const s = st.current;
    const from = Number.isNaN(s.targetY) ? s.rotY : s.targetY;
    s.targetY = Math.round((from + Math.PI) / Math.PI) * Math.PI;
    s.velY = 0;
    s.spin = false;
    s.dirty = true;
  }, [flip]);

  useEffect(() => {
    const s = st.current;
    if (s.ring) (s.ring.material as THREE.MeshBasicMaterial).color.set(ring ?? '#C9F03F');
    s.dirty = true;
  }, [ring]);

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  function pick(x: number, y: number) {
    const s = st.current;
    const { w, h } = s.size;
    if (!s.camera || !s.mesh || !w || !props.current.onSelect) return;
    s.mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), s.camera);
    const hit = ray.intersectObject(s.mesh, false)[0];
    if (!hit || hit.faceIndex == null) return props.current.onSelect(null);
    const l = getBody().faceLab[hit.faceIndex];
    const muscles = BODY_MESH.muscles as MuscleId[];
    const id = l < muscles.length ? muscles[l] : null;
    props.current.onSelect(id && id !== props.current.selected ? id : null);
  }

  const touchDist = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches;
    if (t.length < 2) return 0;
    return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  };

  const drag = useRef({ x: 0, y: 0, moved: 0, lastX: 0, lastY: 0, lastT: 0 });
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const d = drag.current;
        d.x = e.nativeEvent.locationX;
        d.y = e.nativeEvent.locationY;
        d.moved = 0;
        d.lastX = e.nativeEvent.pageX;
        d.lastY = e.nativeEvent.pageY;
        d.lastT = e.nativeEvent.timestamp;
        const s = st.current;
        s.velY = 0;
        s.targetY = NaN;
        s.spin = false;
        s.pinch = 0;
        props.current.onInteract?.(true);
      },
      onPanResponderMove: (e) => {
        const s = st.current;
        const d = drag.current;
        const pd = touchDist(e);
        if (pd) {
          // pinch zoom
          if (s.pinch) s.dist = Math.max(1.4, Math.min(5, s.dist * (s.pinch / pd)));
          s.pinch = pd;
          d.moved = 99;
          s.dirty = true;
          return;
        }
        s.pinch = 0;
        const dx = e.nativeEvent.pageX - d.lastX;
        const dy = e.nativeEvent.pageY - d.lastY;
        const now = e.nativeEvent.timestamp;
        s.rotY += dx * 0.011;
        s.velY = ((dx * 0.011) / Math.max(1, now - d.lastT)) * 16;
        // vertical drag pans when zoomed in
        const zoom = Math.max(0, (3.85 - s.dist) / 2.4);
        s.camY = Math.max(-0.75, Math.min(0.75, s.camY + dy * 0.0035 * (0.3 + zoom)));
        d.lastX = e.nativeEvent.pageX;
        d.lastY = e.nativeEvent.pageY;
        d.lastT = now;
        d.moved += Math.abs(dx) + Math.abs(dy);
        s.dirty = true;
      },
      onPanResponderRelease: () => {
        const d = drag.current;
        props.current.onInteract?.(false);
        if (d.moved < 8) pick(d.x, d.y);
      },
      onPanResponderTerminate: () => props.current.onInteract?.(false),
    }),
  );

  const [failed, setFailed] = useState(false);
  const fail = (e: unknown) => {
    cancelAnimationFrame(st.current.raf);
    console.warn('Body3D: 3D view unavailable', e);
    setFailed(true);
  };

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      setup(gl);
    } catch (e) {
      fail(e);
    }
  };

  const setup = (gl: ExpoWebGLRenderingContext) => {
    const s = st.current;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const canvas = {
      width: w,
      height: h,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientHeight: h,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    const renderer = createRenderer(gl, canvas);
    // a shader that doesn't compile on this GPU means an empty view: fall back to the flat map instead
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = () => fail(new Error('shader compile failed'));
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(props.current.background);
    const camera = new THREE.PerspectiveCamera(28, dual ? w / 2 / h : w / h, 0.05, 20);

    scene.add(new THREE.HemisphereLight('#e8ecf5', '#101014', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.6);
    key.position.set(1.2, 2.2, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#9fb4ff', 1.6);
    rim.position.set(-1.5, 1.5, -2.5);
    scene.add(rim);

    const body = getBody();
    // shared positions / normals, own colours (several figures can be on screen)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', body.geometry.getAttribute('position'));
    geo.setAttribute('normal', body.geometry.getAttribute('normal'));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(body.faceLab.length * 9), 3));
    geo.boundingSphere = body.geometry.boundingSphere;
    const under = new THREE.Color(props.current.palette.under);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec3 base = vColor.rgb;
        float sat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
        gl_FragColor.rgb += base * sat * 0.15;
        float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
        gl_FragColor.rgb += fres * mix(vec3(0.10, 0.11, 0.14), base, sat);
        if (!gl_FrontFacing) gl_FragColor.rgb = vec3(${under.r.toFixed(3)}, ${under.g.toFixed(3)}, ${under.b.toFixed(3)});`,
      );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -body.center;
    paint(geo, body, props.current.colors, props.current.palette, props.current.selected ?? null);
    scene.add(mesh);

    // floor: soft shadow + a thin ring in the accent (a little pedestal)
    const disc = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 48), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45 }));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.412, 72),
      new THREE.MeshBasicMaterial({ color: props.current.ring ?? '#C9F03F', transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    disc.add(shadow, ring);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -body.center + 0.002;
    scene.add(disc);

    Object.assign(s, { renderer, scene, camera, mesh, ring, dirty: true });

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      try {
        frame();
      } catch (e) {
        fail(e);
      }
    };
    const frame = () => {
      if (s.spin && !dual) {
        s.rotY += 0.004;
        s.dirty = true;
      } else if (!Number.isNaN(s.targetY)) {
        const d = s.targetY - s.rotY;
        if (Math.abs(d) > 0.002) {
          s.rotY += d * 0.14;
          s.dirty = true;
        } else s.targetY = NaN;
      } else if (Math.abs(s.velY) > 0.0005) {
        s.rotY += s.velY;
        s.velY *= 0.93;
        s.dirty = true;
      }
      if (Math.abs(s.shiftTarget - s.shift) > 0.001) {
        s.shift += (s.shiftTarget - s.shift) * 0.16;
        s.dirty = true;
      }
      if (!s.dirty) return;
      s.dirty = false;
      camera.position.set(0, s.camY + 0.03, s.dist);
      camera.lookAt(0, s.camY, 0);
      if (dual) {
        // front and back, side by side
        renderer.setScissorTest(true);
        for (const [k, ang] of [[0, 0], [1, Math.PI]] as const) {
          mesh.rotation.y = ang;
          renderer.setViewport((k * w) / 2, 0, w / 2, h);
          renderer.setScissor((k * w) / 2, 0, w / 2, h);
          renderer.render(scene, camera);
        }
      } else {
        mesh.rotation.y = s.rotY;
        disc.position.x = mesh.position.x = s.shift * 0.5 * (s.dist / 3.85);
        renderer.render(scene, camera);
      }
      gl.endFrameEXP();
    };
    loop();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    st.current.size = { w: width, h: height };
    setSize({ w: width, h: height });
  };

  if (failed || dual) return <Body2D colors={colors} labels={!dual} style={[style, { paddingVertical: dual ? 2 : 16 }]} />;

  return (
    <View style={style} onLayout={onLayout} {...(interactive ? pan.panHandlers : {})} pointerEvents={interactive ? 'auto' : 'none'}>
      {size.w > 0 ? <GLView key={`${size.w}x${size.h}`} style={{ flex: 1 }} onContextCreate={onContextCreate} msaaSamples={4} /> : null}
    </View>
  );
}
