import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

export function Animate({
  children,
  identity,
}: {
  children: ReactNode;
  identity: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (
      !el ||
      typeof el.animate !== "function" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const animation = el.animate(
      [
        { opacity: 0, transform: "translateY(8px)", filter: "blur(3px)" },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "none",
      },
    );
    return () => animation.cancel();
  }, [identity]);
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
    ) {
      return;
    }
    let cancelled = false;
    let instance: { destroy: () => void } | null = null;
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled || !ref.current || !content.current) return;
      instance = new Lenis({
        wrapper: ref.current,
        content: content.current,
        autoRaf: true,
        duration: 0.75,
        smoothWheel: true,
        prevent: (node) =>
          !!node.closest('[data-lenis-prevent],input,textarea,[role="dialog"]'),
      });
    });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [ref, content, ready]);
}
