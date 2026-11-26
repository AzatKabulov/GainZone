/* eslint-disable react-hooks/refs -- imperative WebGL bridge: all mutable scene state lives in refs and is only touched from GL / gesture callbacks */
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import type { MuscleId } from '@/data/muscles';

/**
 * Procedural 3D anatomy figure (three.js on expo-gl, no model files).
 * Every muscle is its own mesh (vertex-coloured, so one mesh can hold several regions,
 * e.g. the three bands of the chest or the three heads of the delts).
 * Drag to rotate, tap a muscle to select it.
 */

export interface Body3DProps {
  colors: Record<MuscleId, string>;
  base: string;
  background: string;
  selected: MuscleId | null;
  onSelect: (m: MuscleId | null) => void;
  /** horizontal shift of the figure (−1 … 1), used to make room for the side panel */
  shift?: number;
  /** turn to face front (0) or back (π) when this changes */
  facing?: { angle: number; n: number };
  /** called with true when a drag starts and false when it ends (to lock a parent ScrollView) */
  onInteract?: (active: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

type RegionFn = (p: THREE.Vector3, n: THREE.Vector3) => MuscleId;

interface Part {
  mesh: THREE.Mesh;
  region: RegionFn;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Ellipsoid between two points (or at a point), radii in its local frame. */
function ellipsoid(
  radii: [number, number, number],
  at: THREE.Vector3,
  opts: { dir?: THREE.Vector3; rotZ?: number; rotX?: number; rotY?: number; seg?: number } = {},
) {
  const g = new THREE.SphereGeometry(1, opts.seg ?? 28, Math.round((opts.seg ?? 28) * 0.75));
  g.scale(radii[0], radii[1], radii[2]);
  const m = new THREE.Mesh(g);
  m.position.copy(at);
  if (opts.dir) {
    m.quaternion.setFromUnitVectors(v3(0, 1, 0), opts.dir.clone().normalize());
  }
  if (opts.rotZ) m.rotateZ(opts.rotZ);
  if (opts.rotX) m.rotateX(opts.rotX);
  if (opts.rotY) m.rotateY(opts.rotY);
  return m;
}

function capsule(a: THREE.Vector3, b: THREE.Vector3, r: number, scaleZ = 1) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 20);
  g.scale(1, 1, scaleZ);
  const m = new THREE.Mesh(g);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

const fixed = (id: MuscleId): RegionFn => () => id;

function buildFigure(baseMat: THREE.Material) {
  const root = new THREE.Group();
  const parts: Part[] = [];

  const addBase = (m: THREE.Mesh) => {
    m.material = baseMat;
    root.add(m);
  };
  const addMuscle = (m: THREE.Mesh, region: RegionFn) => {
    const geo = m.geometry as THREE.BufferGeometry;
    const count = geo.getAttribute('position').count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.08 });
    root.add(m);
    parts.push({ mesh: m, region });
  };

  /* ── skeleton of the figure (y up, ~1.8 tall, facing +z) ── */
  const head = ellipsoid([0.088, 0.112, 0.1], v3(0, 1.74, 0.005));
  addBase(head);
  addBase(capsule(v3(0, 1.56, -0.01), v3(0, 1.66, 0), 0.052));
  addBase(ellipsoid([0.185, 0.19, 0.115], v3(0, 1.36, -0.01))); // rib cage
  addBase(ellipsoid([0.15, 0.15, 0.1], v3(0, 1.13, -0.005))); // waist
  addBase(ellipsoid([0.165, 0.11, 0.11], v3(0, 0.95, -0.01))); // pelvis

  for (const s of [-1, 1]) {
    const sh = v3(0.215 * s, 1.47, -0.01);
    const el = v3(0.29 * s, 1.18, -0.02);
    const wr = v3(0.33 * s, 0.93, 0.02);
    addBase(capsule(sh, el, 0.046));
    addBase(capsule(el, wr, 0.037));
    addBase(ellipsoid([0.032, 0.06, 0.02], v3(0.34 * s, 0.86, 0.025)));

    const hip = v3(0.1 * s, 0.92, 0);
    const knee = v3(0.11 * s, 0.5, 0.01);
    const ankle = v3(0.115 * s, 0.1, -0.01);
    addBase(capsule(hip, knee, 0.07));
    addBase(capsule(knee, ankle, 0.046));
    addBase(ellipsoid([0.045, 0.03, 0.1], v3(0.115 * s, 0.035, 0.04)));

    const armDir = el.clone().sub(sh).normalize();
    const foreDir = wr.clone().sub(el).normalize();
    const thighDir = knee.clone().sub(hip).normalize();
    const shinDir = ankle.clone().sub(knee).normalize();
    const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);

    /* chest: one pec per side, three bands by height */
    addMuscle(
      ellipsoid([0.095, 0.072, 0.05], v3(0.088 * s, 1.385, 0.075), { rotZ: -0.12 * s, rotX: 0.12 }),
      (p) => (p.y > 1.408 ? 'chest_upper' : p.y > 1.362 ? 'chest_mid' : 'chest_lower'),
    );

    /* delts: one cap, front / side / rear by the surface normal */
    addMuscle(ellipsoid([0.066, 0.078, 0.07], v3(0.218 * s, 1.465, -0.008)), (_p, n) =>
      n.z > 0.42 ? 'delts_front' : n.z < -0.42 ? 'delts_rear' : 'delts_side',
    );

    /* traps: neck slope + upper back diamond */
    addMuscle(ellipsoid([0.085, 0.032, 0.045], v3(0.085 * s, 1.535, -0.035), { rotZ: -0.38 * s }), fixed('traps'));
    addMuscle(ellipsoid([0.05, 0.11, 0.028], v3(0.035 * s, 1.43, -0.105), { rotZ: 0.18 * s }), fixed('traps'));

    /* back */
    addMuscle(ellipsoid([0.055, 0.075, 0.03], v3(0.075 * s, 1.37, -0.105), { rotZ: -0.3 * s }), fixed('upper_back'));
    addMuscle(ellipsoid([0.07, 0.165, 0.045], v3(0.125 * s, 1.27, -0.06), { rotZ: 0.3 * s, rotY: -0.35 * s }), fixed('lats'));
    addMuscle(ellipsoid([0.03, 0.1, 0.03], v3(0.035 * s, 1.12, -0.09)), fixed('lower_back'));

    /* core */
    for (let r = 0; r < 4; r++) {
      const y = 1.245 - r * 0.068;
      addMuscle(ellipsoid([0.03, r === 3 ? 0.038 : 0.029, 0.02], v3(0.034 * s, y, 0.1 - r * 0.003)), fixed('abs'));
    }
    addMuscle(ellipsoid([0.042, 0.1, 0.07], v3(0.115 * s, 1.12, 0.03), { rotZ: 0.12 * s }), fixed('obliques'));

    /* arms */
    addMuscle(ellipsoid([0.038, 0.095, 0.04], lerp(sh, el, 0.55).add(v3(0, 0, 0.03)), { dir: armDir }), fixed('biceps'));
    addMuscle(ellipsoid([0.042, 0.105, 0.042], lerp(sh, el, 0.5).add(v3(0.006 * s, 0, -0.03)), { dir: armDir }), fixed('triceps'));
    addMuscle(ellipsoid([0.043, 0.1, 0.042], lerp(el, wr, 0.33).add(v3(0, 0, 0.004)), { dir: foreDir }), fixed('forearms'));

    /* legs */
    addMuscle(ellipsoid([0.085, 0.085, 0.072], v3(0.085 * s, 0.93, -0.075)), fixed('glutes'));
    addMuscle(ellipsoid([0.068, 0.18, 0.06], lerp(hip, knee, 0.48).add(v3(0.004 * s, 0, 0.032)), { dir: thighDir }), fixed('quads'));
    addMuscle(ellipsoid([0.062, 0.17, 0.055], lerp(hip, knee, 0.5).add(v3(0, 0, -0.035)), { dir: thighDir }), fixed('hamstrings'));
    addMuscle(ellipsoid([0.035, 0.12, 0.05], lerp(hip, knee, 0.33).add(v3(-0.045 * s, 0, 0)), { dir: thighDir }), fixed('adductors'));
    addMuscle(ellipsoid([0.046, 0.115, 0.048], lerp(knee, ankle, 0.3).add(v3(0, 0, -0.022)), { dir: shinDir }), fixed('calves'));
  }

  // figure space: feet at y=0; the root lowers it so the body is centred in view
  root.position.y = -0.9;
  return { root, parts };
}

function paint(parts: Part[], colors: Record<MuscleId, string>, selected: MuscleId | null) {
  const c = new THREE.Color();
  const white = new THREE.Color('#ffffff');
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const { mesh, region } of parts) {
    // work in figure space (the mesh's local matrix relative to the figure root)
    mesh.updateMatrix();
    nm.getNormalMatrix(mesh.matrix);
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      const id = region(p, n);
      c.set(colors[id]);
      if (selected && id === selected) c.lerp(white, 0.28);
      else if (selected) c.multiplyScalar(0.55);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
}

export function Body3D({ colors, base, background, selected, onSelect, shift = 0, facing, onInteract, style }: Body3DProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const st = useRef({
    renderer: null as THREE.WebGLRenderer | null,
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    figure: null as THREE.Group | null,
    parts: [] as Part[],
    gl: null as ExpoWebGLRenderingContext | null,
    rotY: 0.35,
    rotX: 0.04,
    targetY: 0.35,
    velY: 0,
    shift: 0,
    shiftTarget: 0,
    dirty: true,
    raf: 0 as number,
    baseMat: null as THREE.MeshStandardMaterial | null,
    size: { w: 0, h: 0 },
  });
  const props = useRef({ colors, selected, onSelect, base, background, onInteract });
  useLayoutEffect(() => {
    props.current = { colors, selected, onSelect, base, background, onInteract };
  });

  // repaint muscles when colours / selection change
  useEffect(() => {
    const s = st.current;
    if (!s.parts.length) return;
    paint(s.parts, colors, selected);
    s.dirty = true;
  }, [colors, selected]);

  useEffect(() => {
    const s = st.current;
    s.baseMat?.color.set(base);
    if (s.scene?.background) (s.scene.background as THREE.Color).set(background);
    s.dirty = true;
  }, [base, background]);

  useEffect(() => {
    st.current.shiftTarget = shift;
    st.current.dirty = true;
  }, [shift]);

  useEffect(() => {
    if (!facing) return;
    const s = st.current;
    // shortest turn to the requested side
    const full = Math.PI * 2;
    let target = facing.angle;
    const cur = s.rotY;
    target = cur + ((((target - cur) % full) + full + Math.PI) % full) - Math.PI;
    s.targetY = target;
    s.velY = 0;
    s.dirty = true;
  }, [facing]);

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  function pick(x: number, y: number) {
    const s = st.current;
    const { w, h } = s.size;
    if (!s.camera || !s.figure || !w) return;
    s.figure.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), s.camera);
    const hits = ray.intersectObjects(s.figure.children, false);
    const hit = hits[0];
    const part = hit ? s.parts.find((p) => p.mesh === hit.object) : undefined;
    if (!hit || !part || !hit.face) {
      props.current.onSelect(null);
      return;
    }
    // hit point and face normal in figure space
    const p = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(s.figure.matrixWorld).invert());
    part.mesh.updateMatrix();
    const nm = new THREE.Matrix3().getNormalMatrix(part.mesh.matrix);
    const n = hit.face.normal.clone().applyMatrix3(nm).normalize();
    const id = part.region(p, n);
    props.current.onSelect(id === props.current.selected ? null : id);
  }

  const drag = useRef({ x: 0, y: 0, moved: 0, lastX: 0, lastT: 0 });
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
        d.lastT = e.nativeEvent.timestamp;
        st.current.velY = 0;
        st.current.targetY = NaN;
        props.current.onInteract?.(true);
      },
      onPanResponderMove: (e, g) => {
        const s = st.current;
        const d = drag.current;
        const dx = e.nativeEvent.pageX - d.lastX;
        const now = e.nativeEvent.timestamp;
        s.rotY += dx * 0.011;
        s.rotX = Math.max(-0.35, Math.min(0.45, 0.04 + g.dy * 0.003));
        s.velY = (dx * 0.011) / Math.max(1, now - d.lastT) * 16;
        d.lastX = e.nativeEvent.pageX;
        d.lastT = now;
        d.moved = Math.max(d.moved, Math.abs(g.dx) + Math.abs(g.dy));
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
    s.gl = gl;
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
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(props.current.background);

    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
    camera.position.set(0, 0.05, 4.1);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#f2eee6', '#1a1a1d', 1.1));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1.6, 2.4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#cfd8ff', 0.6);
    fill.position.set(-2.5, 0.5, 1.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.6);
    rim.position.set(0, 1.5, -3);
    scene.add(rim);

    const baseMat = new THREE.MeshStandardMaterial({ color: props.current.base, roughness: 0.72, metalness: 0.05 });
    const { root, parts } = buildFigure(baseMat);
    scene.add(root);
    paint(parts, props.current.colors, props.current.selected);

    // soft floor disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 48),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.9;
    scene.add(disc);

    Object.assign(s, { renderer, scene, camera, figure: root, parts, baseMat, dirty: true });

    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      // inertia / auto-turn
      if (!Number.isNaN(s.targetY)) {
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
      root.rotation.set(s.rotX, s.rotY, 0);
      root.position.x = s.shift * 0.55;
      disc.position.x = root.position.x;
      renderer.render(scene, camera);
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
    <View style={style} onLayout={onLayout} {...pan.panHandlers}>
      {size.w > 0 ? <GLView key={`${size.w}x${size.h}`} style={{ flex: 1 }} onContextCreate={onContextCreate} msaaSamples={4} /> : null}
    </View>
  );
}
