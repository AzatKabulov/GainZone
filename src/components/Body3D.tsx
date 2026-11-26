/* eslint-disable react-hooks/refs -- imperative WebGL bridge: all mutable scene state lives in refs and is only touched from GL / gesture callbacks */
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import { BODY_MESH } from '@/data/bodyMesh';
import type { MuscleId } from '@/data/muscles';

/**
 * Anatomical 3D figure (BodyParts3D muscles via open-anatomy-3d, CC BY 4.0), rendered with three.js on expo-gl.
 * Every vertex carries a muscle region, so the whole body is one mesh that is recoloured on the fly.
 * One finger rotates, two fingers zoom, a tap selects a muscle.
 */

export const ANATOMY_CREDIT = 'Anatomy: BodyParts3D © DBCLS (CC BY 4.0) via open-anatomy-3d';

const SKIN = 255;
const UNDER = 254;
const IDLE_LABEL = 253;

interface Decoded {
  geometry: THREE.BufferGeometry;
  lab: Uint8Array;
  lab2: Uint8Array;
  blend: Uint8Array;
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

/** Decode the packed mesh once per app run. */
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
  const nor = take(Int8Array, V * 3, M.sizes[1]);
  const lab = take(Uint8Array, V, M.sizes[2]);
  const lab2 = take(Uint8Array, V, M.sizes[3]);
  const blend = take(Uint8Array, V, M.sizes[4]);
  const ind = M.bigIndex ? take(Uint32Array, M.indexCount, M.sizes[5]) : take(Uint16Array, M.indexCount, M.sizes[5]);
  const P = new Float32Array(V * 3);
  const N = new Float32Array(V * 3);
  for (let i = 0; i < V; i++)
    for (let a = 0; a < 3; a++) {
      P[i * 3 + a] = M.min[a] + ((pos[i * 3 + a] + 32768) / 65535) * (M.max[a] - M.min[a]);
      N[i * 3 + a] = nor[i * 3 + a] / 127;
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geometry.setIndex(new THREE.BufferAttribute(ind, 1));
  geometry.computeBoundingSphere();
  cache = { geometry, lab, lab2, blend, center: (M.min[1] + M.max[1]) / 2, height: M.max[1] - M.min[1] };
  return cache;
}

export interface BodyPalette {
  skin: string;
  under: string;
  idle: string;
}

export const DARK_BODY: BodyPalette = { skin: '#26262B', under: '#121215', idle: '#4C4C55' };
export const LIGHT_BODY: BodyPalette = { skin: '#9C968B', under: '#6E6A63', idle: '#C9C3B7' };

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
  const tmp = new THREE.Color();
  for (let i = 0; i < d.lab.length; i++) {
    tmp.copy(table[d.lab[i]]);
    if (d.blend[i]) tmp.lerp(table[d.lab2[i]], (d.blend[i] / 255) * 0.5);
    arr[i * 3] = tmp.r;
    arr[i * 3 + 1] = tmp.g;
    arr[i * 3 + 2] = tmp.b;
  }
  col.needsUpdate = true;
}

export interface Body3DProps {
  colors: Partial<Record<MuscleId, string>>;
  palette: BodyPalette;
  background: string;
  selected?: MuscleId | null;
  onSelect?: (m: MuscleId | null) => void;
  /** horizontal shift of the figure (−1 … 1), used to make room for a side panel */
  shift?: number;
  /** turn to an angle (0 = front, π = back) when this changes */
  facing?: { angle: number; n: number };
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
  selected = null,
  onSelect,
  shift = 0,
  facing,
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
  const props = useRef({ colors, palette, selected, onSelect, background, onInteract });
  useLayoutEffect(() => {
    props.current = { colors, palette, selected, onSelect, background, onInteract };
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

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  function pick(x: number, y: number) {
    const s = st.current;
    const { w, h } = s.size;
    if (!s.camera || !s.mesh || !w || !props.current.onSelect) return;
    s.mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), s.camera);
    const hit = ray.intersectObject(s.mesh, false)[0];
    if (!hit?.face) return props.current.onSelect(null);
    const l = getBody().lab[hit.face.a];
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

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
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
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
    renderer.debug.checkShaderErrors = false;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(props.current.background);
    const camera = new THREE.PerspectiveCamera(28, dual ? w / 2 / h : w / h, 0.05, 20);

    scene.add(new THREE.HemisphereLight('#f2eee6', '#141416', 1.0));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#bcc8ff', 0.7);
    fill.position.set(-2.5, 0.8, 1.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 2.0);
    rim.position.set(-0.5, 1.8, -3);
    scene.add(rim);

    const body = getBody();
    // shared positions / normals / indices, own colours (several figures can be on screen)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', body.geometry.getAttribute('position'));
    geo.setAttribute('normal', body.geometry.getAttribute('normal'));
    geo.setIndex(body.geometry.getIndex());
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(body.lab.length * 3), 3));
    geo.boundingSphere = body.geometry.boundingSphere;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        gl_FragColor.rgb += fres * vec3(0.14, 0.15, 0.18);`,
      );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -body.center;
    paint(geo, body, props.current.colors, props.current.palette, props.current.selected ?? null);
    scene.add(mesh);

    // soft floor shadow
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 48),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -body.center + 0.002;
    scene.add(disc);

    Object.assign(s, { renderer, scene, camera, mesh, dirty: true });

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
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

  return (
    <View style={style} onLayout={onLayout} {...(interactive ? pan.panHandlers : {})} pointerEvents={interactive ? 'auto' : 'none'}>
      {size.w > 0 ? <GLView key={`${size.w}x${size.h}`} style={{ flex: 1 }} onContextCreate={onContextCreate} msaaSamples={4} /> : null}
    </View>
  );
}
