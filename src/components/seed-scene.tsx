import {
  Suspense,
  useEffect,
  useState,
  useRef,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Group, Shape, QuadraticBezierCurve3, Vector3 } from "three";
const leaf = new Shape();
leaf.moveTo(-1, -0.6);
leaf.bezierCurveTo(-1, 0.8, 0.5, 1, 1, 0.6);
leaf.bezierCurveTo(1, -0.8, -0.5, -1, -1, -0.6);
const vein = new QuadraticBezierCurve3(
  new Vector3(-0.85, -0.5, 0.2),
  new Vector3(0, 0.06, 0.21),
  new Vector3(0.85, 0.52, 0.2),
);
function Leaves() {
  const group = useRef<Group>(null);
  useFrame(({ pointer }, delta) => {
    if (group.current) {
      group.current.rotation.y +=
        (pointer.x * 0.25 - group.current.rotation.y) * Math.min(delta * 2, 1);
      group.current.rotation.x +=
        (pointer.y * 0.15 - group.current.rotation.x) * Math.min(delta * 2, 1);
    }
  });
  return (
    <group ref={group}>
      <Float speed={1} rotationIntensity={0.1} floatIntensity={0.2}>
        <mesh rotation={[0.1, -0.1, -0.12]} scale={1.1}>
          <extrudeGeometry
            args={[
              leaf,
              {
                depth: 0.12,
                bevelEnabled: true,
                bevelThickness: 0.07,
                bevelSize: 0.07,
                bevelSegments: 3,
                steps: 1,
                curveSegments: 32,
              },
            ]}
          />
          <meshPhysicalMaterial
            color="#8ab552"
            roughness={0.32}
            metalness={0.12}
            clearcoat={1}
          />
        </mesh>
        <mesh scale={1.1} rotation={[0.1, -0.1, -0.12]}>
          <tubeGeometry args={[vein, 40, 0.009, 6, false]} />
          <meshBasicMaterial color="#405e2d" />
        </mesh>
      </Float>
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function SeedScene() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setEnabled(
        !!gl &&
          !matchMedia("(prefers-reduced-motion:reduce), (max-width:760px)")
            .matches,
      );
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* The branded panel remains usable without WebGL. */
    }
  }, []);
  return enabled ? (
    <div className="seed-scene" aria-hidden="true">
      <SceneBoundary>
        <Suspense fallback={null}>
          <Canvas
            dpr={[1, 1.4]}
            camera={{ position: [0, 0, 6], fov: 40 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          >
            <ambientLight intensity={1.6} />
            <directionalLight position={[2, 4, 5]} intensity={3} />
            <Leaves />
          </Canvas>
        </Suspense>
      </SceneBoundary>
    </div>
  ) : null;
}
