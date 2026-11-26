import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
gsap.registerPlugin(useGSAP);
export function Animate({
  children,
  identity,
}: {
  children: ReactNode;
  identity: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        gsap.fromTo(
          ref.current,
          { opacity: 0, y: 9 },
          {
            opacity: 1,
            y: 0,
            duration: 0.32,
            ease: "power2.out",
            clearProps: "transform",
          },
        );
    },
    { scope: ref, dependencies: [identity], revertOnUpdate: true },
  );
  return (
    <div ref={ref} className="view-enter">
      {children}
    </div>
  );
}
export function useSmoothWorkspace(
  ref: React.RefObject<HTMLDivElement | null>,
  content: React.RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  useEffect(() => {
    if (
      !ready ||
      !ref.current ||
      !content.current ||
      !matchMedia("(pointer:fine)").matches ||
      matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return;
    const lenis = new Lenis({
      wrapper: ref.current,
      content: content.current,
      autoRaf: true,
      duration: 0.75,
      smoothWheel: true,
      prevent: (node) =>
        !!node.closest('[data-lenis-prevent],input,textarea,[role="dialog"]'),
    });
    return () => lenis.destroy();
  }, [ref, content, ready]);
}
