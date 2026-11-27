import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./auth-reel.css";

const clips = ["/assets/auth/harvest.mp4", "/assets/auth/handoff.mp4"];
export function AuthReel() {
  const [desktop, setDesktop] = useState(false);
  const [motion, setMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const layers = useRef<(HTMLVideoElement | null)[]>([]);
  const control = useRef<(pause: boolean) => void>(() => {});
  useEffect(() => {
    const size = matchMedia("(min-width:761px)");
    const reduced = matchMedia("(prefers-reduced-motion:reduce)");
    const update = () => {
      setDesktop(size.matches);
      setMotion(
        !reduced.matches &&
          !(navigator as Navigator & { connection?: { saveData?: boolean } })
            .connection?.saveData,
      );
    };
    update();
    size.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      size.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    if (!desktop || !motion) return;
    const videos = layers.current.filter((v): v is HTMLVideoElement => !!v);
    if (videos.length !== 2) return;
    let active = 0,
      held = false,
      switching = false,
      disposed = false,
      preloadedSecond = false;
    let fade: Animation | null = null;
    const failed = new Set<number>();
    const running = () => !held && !document.hidden;
    const ensureSecondLoaded = () => {
      if (preloadedSecond || failed.has(1)) return;
      preloadedSecond = true;
      if (videos[1].preload === "none") {
        videos[1].preload = "auto";
        videos[1].load();
      }
    };
    const cancelFade = () => {
      const activeFade = fade;
      fade = null;
      activeFade?.cancel();
    };
    const play = async (video: HTMLVideoElement) => {
      try {
        await video.play();
        if (!disposed) setBlocked(false);
        if (video === videos[0]) ensureSecondLoaded();
      } catch {
        if (!disposed && running()) setBlocked(true);
      }
    };
    const sync = () => {
      if (!running()) {
        videos.forEach((v) => v.pause());
        fade?.pause();
        return;
      }
      videos.forEach((v, i) => {
        if (!failed.has(i) && (i === active || fade)) void play(v);
      });
      fade?.play();
    };
    control.current = (pause) => {
      held = pause;
      sync();
    };
    const change = async () => {
      const from = active,
        next = 1 - from;
      if (
        fade ||
        switching ||
        !running() ||
        failed.has(next) ||
        videos[next].readyState < 2
      )
        return;
      switching = true;
      // Keep the outgoing frame opaque underneath the incoming layer to avoid a dark dip.
      videos[next].currentTime = 0;
      try {
        await videos[next].play();
      } catch {
        switching = false;
        return;
      }
      if (disposed || !running()) {
        videos[next].pause();
        switching = false;
        return;
      }
      videos[from].style.zIndex = "1";
      videos[next].style.zIndex = "2";
      videos[next].style.opacity = "1";
      if (typeof videos[next].animate === "function") {
        const anim = videos[next].animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 1200,
          easing: "ease-in-out",
        });
        fade = anim;
        anim.onfinish = () => {
          if (fade !== anim) return;
          videos[from].pause();
          videos[from].style.opacity = "0";
          active = next;
          fade = null;
          switching = false;
        };
        anim.oncancel = () => {
          if (fade === anim) {
            fade = null;
            switching = false;
          }
        };
      } else {
        videos[from].pause();
        videos[from].style.opacity = "0";
        active = next;
        switching = false;
      }
    };
    const tick = () => {
      const current = videos[active];
      if (current.duration && current.currentTime >= current.duration - 1.5)
        void change();
    };
    const ready = () => {
      if (running() && videos[active].paused && !fade)
        void play(videos[active]);
    };
    const ended = () => {
      if (!fade) {
        videos[active].currentTime = 0;
        if (running()) void play(videos[active]);
      }
    };
    const errors = videos.map((_, i) => () => {
      failed.add(i);
      cancelFade();
      const next = 1 - i;
      if (!failed.has(next)) {
        if (next === 1) ensureSecondLoaded();
        active = next;
        videos[next].loop = true;
        videos[next].style.opacity = "1";
        videos[i].style.opacity = "0";
        if (running()) void play(videos[next]);
      }
    });
    videos.forEach((v, i) => {
      v.muted = true;
      v.addEventListener("timeupdate", tick);
      v.addEventListener("canplay", ready);
      v.addEventListener("ended", ended);
      v.addEventListener("error", errors[i]);
    });
    document.addEventListener("visibilitychange", sync);
    ready();
    return () => {
      disposed = true;
      cancelFade();
      control.current = () => {};
      document.removeEventListener("visibilitychange", sync);
      videos.forEach((v, i) => {
        v.pause();
        v.removeEventListener("timeupdate", tick);
        v.removeEventListener("canplay", ready);
        v.removeEventListener("ended", ended);
        v.removeEventListener("error", errors[i]);
      });
    };
  }, [desktop, motion]);
  if (!desktop) return null;
  return (
    <>
      <div className="auth-reel" aria-hidden="true">
        <img src="/assets/auth/harvest-poster.webp" alt="" decoding="async" />
        {motion &&
          clips.map((src, i) => (
            <video
              key={src}
              ref={(v) => {
                layers.current[i] = v;
              }}
              src={src}
              muted
              playsInline
              preload={i === 0 ? "metadata" : "none"}
              poster="/assets/auth/harvest-poster.webp"
              style={{ opacity: i === 0 ? 1 : 0 }}
            />
          ))}
        <div className="auth-reel-shade" />
      </div>
      {motion && (
        <button
          className="auth-reel-toggle"
          aria-label={
            paused || blocked
              ? "Play background videos"
              : "Pause background videos"
          }
          onClick={() => {
            const next = blocked ? false : !paused;
            setPaused(next);
            setBlocked(false);
            control.current(next);
          }}
        >
          {paused || blocked ? <Play size={16} /> : <Pause size={16} />}
        </button>
      )}
    </>
  );
}
