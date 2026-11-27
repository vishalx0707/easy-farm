import { useEffect, useId, useState } from "react";
import "../leaf-loader.css";

const SESSION_KEY = "easyfarm:opening-sequence-played";
let playedInMemory = false;

/**
 * Exact EasyFarm leaf silhouette matching `.brand > span` in src/app.css:
 * 23:14 aspect ratio (115x70 inside 140x100), border-radius: 95% 0 95% 0, rotated -12deg.
 */
const LEAF_PATH =
  "M 12.5 85 L 12.5 81.5 A 109.25 66.5 0 0 1 121.75 15 L 127.5 15 L 127.5 18.5 A 109.25 66.5 0 0 1 18.25 85 Z";

/**
 * Diagonal midrib vein matching `.brand > span:after` inside the leaf silhouette.
 */
const VEIN_PATH = "M 16.5 82.2 Q 68 53.5 119 19.8";
const VEIN_HIGHLIGHT_PATH = "M 17.5 81.2 Q 68 52.3 118 19.3";

function hasPlayedOpening(): boolean {
  if (playedInMemory) return true;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markOpeningPlayed(): void {
  playedInMemory = true;
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* Ignore storage errors in restricted contexts; module flag prevents SPA replays. */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface LeafLoaderProps {
  label?: string;
  overlay?: boolean;
}

interface OliveGlassLeafProps {
  variant: "loader" | "opening";
}

function OliveGlassLeaf({ variant }: OliveGlassLeafProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `ef-leaf-clip-${uid}`;
  const bodyGradId = `ef-leaf-body-${uid}`;
  const upperGlassId = `ef-leaf-upper-${uid}`;
  const lowerDepthId = `ef-leaf-lower-${uid}`;
  const rimGradId = `ef-leaf-rim-${uid}`;
  const sheenGradId = `ef-leaf-sheen-${uid}`;

  const isOpening = variant === "opening";

  return (
    <div
      className={
        isOpening
          ? "ef-leaf-loader__stage ef-leaf-loader__stage--opening"
          : "ef-leaf-loader__stage"
      }
      aria-hidden="true"
    >
      <div className="ef-leaf-loader__aura" />
      <svg className="ef-leaf-loader__svg" viewBox="0 0 140 100" fill="none">
        <defs>
          <clipPath id={clipId}>
            <path d={LEAF_PATH} />
          </clipPath>

          {/* Translucent olive-lime glass body */}
          <linearGradient
            id={bodyGradId}
            x1="14"
            y1="14"
            x2="124"
            y2="86"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#d2f37d" stopOpacity="0.92" />
            <stop offset="44%" stopColor="#9ed249" stopOpacity="0.86" />
            <stop offset="78%" stopColor="#5c8533" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#355024" stopOpacity="0.94" />
          </linearGradient>

          {/* Upper lobe frosted refraction highlight */}
          <linearGradient
            id={upperGlassId}
            x1="36"
            y1="14"
            x2="78"
            y2="58"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#f5fbe2" stopOpacity="0.54" />
            <stop offset="55%" stopColor="#dcf39c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#b9e855" stopOpacity="0" />
          </linearGradient>

          {/* Lower lobe deep olive glass shadow */}
          <linearGradient
            id={lowerDepthId}
            x1="64"
            y1="48"
            x2="112"
            y2="88"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#263c1c" stopOpacity="0" />
            <stop offset="100%" stopColor="#1b2d14" stopOpacity="0.46" />
          </linearGradient>

          {/* Specular glass edge bevel */}
          <linearGradient
            id={rimGradId}
            x1="12"
            y1="14"
            x2="128"
            y2="86"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#f8fdea" stopOpacity="0.78" />
            <stop offset="48%" stopColor="#c9ee72" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#65883c" stopOpacity="0.35" />
          </linearGradient>

          {/* Moving glass caustic band */}
          <linearGradient id={sheenGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#f5fce4" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#d9f48c" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform="rotate(-12 70 50)">
          {/* Base olive glass fill */}
          <path d={LEAF_PATH} fill={`url(#${bodyGradId})`} />

          {/* Internal glass bevels and animated caustic clipped to exact leaf */}
          <g clipPath={`url(#${clipId})`}>
            <path
              d="M 10 14 L 128 14 L 128 20 L 16 86 L 10 86 Z"
              fill={`url(#${upperGlassId})`}
            />
            <path
              d="M 16 86 L 128 20 L 128 88 L 16 88 Z"
              fill={`url(#${lowerDepthId})`}
            />

            <g transform="rotate(24 70 50)">
              {isOpening ? (
                <rect
                  className="ef-leaf-loader__opening-sheen"
                  x="0"
                  y="-20"
                  width="48"
                  height="150"
                  fill={`url(#${sheenGradId})`}
                />
              ) : (
                <rect
                  className="ef-leaf-loader__glass-sheen"
                  x="44"
                  y="-20"
                  width="36"
                  height="150"
                  fill={`url(#${sheenGradId})`}
                />
              )}
            </g>
          </g>

          {/* Signature EasyFarm diagonal midrib vein */}
          <path
            className="ef-leaf-loader__vein-highlight"
            pathLength={isOpening ? 1 : undefined}
            d={VEIN_HIGHLIGHT_PATH}
            stroke="#eef8d0"
            strokeOpacity="0.46"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            className="ef-leaf-loader__vein"
            pathLength={isOpening ? 1 : undefined}
            d={VEIN_PATH}
            stroke="#506d2f"
            strokeOpacity="0.92"
            strokeWidth="2.1"
            strokeLinecap="round"
          />

          {/* Outer glass specular rim */}
          <path
            d={LEAF_PATH}
            stroke={`url(#${rimGradId})`}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Compact accessible olive glass leaf loading status.
 * Renders centered inline by default or as a fixed forest glass overlay when `overlay` is true.
 */
export function LeafLoader({ label, overlay = false }: LeafLoaderProps) {
  const trimmedLabel = label?.trim();

  return (
    <div
      className={
        overlay ? "ef-leaf-loader ef-leaf-loader--overlay" : "ef-leaf-loader"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={trimmedLabel ? undefined : "Loading"}
    >
      <OliveGlassLeaf variant="loader" />
      {trimmedLabel ? <span className="sr-only">{trimmedLabel}</span> : null}
    </div>
  );
}

/**
 * Session-scoped startup opening sequence (~480ms normal, ~120ms reduced motion)
 * with fixed forest glass overlay and CSS blur exit. Never blocks app boot or pointer events.
 */
export function OpeningSequence() {
  const [phase, setPhase] = useState<"hold" | "exit" | "done">(() =>
    hasPlayedOpening() ? "done" : "hold",
  );

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (phase === "hold") {
      const markTimer = window.setTimeout(
        markOpeningPlayed,
        reduced ? 20 : 80,
      );
      const holdTimer = window.setTimeout(
        () => {
          markOpeningPlayed();
          setPhase("exit");
        },
        reduced ? 40 : 260,
      );
      return () => {
        window.clearTimeout(markTimer);
        window.clearTimeout(holdTimer);
      };
    }

    if (phase === "exit") {
      const doneTimer = window.setTimeout(
        () => setPhase("done"),
        reduced ? 90 : 230,
      );
      return () => window.clearTimeout(doneTimer);
    }
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={
        phase === "exit"
          ? "ef-opening-overlay ef-opening-overlay--exiting"
          : "ef-opening-overlay"
      }
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (phase === "exit" && event.target === event.currentTarget) {
          setPhase("done");
        }
      }}
    >
      <div className="ef-opening-stage">
        <OliveGlassLeaf variant="opening" />
      </div>
    </div>
  );
}
