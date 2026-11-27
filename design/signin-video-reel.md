# Sign-in video reel

The desktop sign-in left panel alternates two muted eight-second clips using a 1.2-second GSAP crossfade. The outgoing layer remains fully opaque underneath the incoming layer until the fade completes, avoiding a black dip. The harvest and handoff clips repeat in both directions. Playback pauses when the tab is hidden and has an accessible pause/play button.

Media is reused from the existing local footage: `hero-footage/fresh-produce/pepper-harvest-4k.mp4` and `assets/hero/warehouse-loop.mp4`. Optimized silent H.264 runtime derivatives are versioned in `assets/auth/`, totaling approximately 957 KB, with a 50 KB WebP poster. Existing marketing and HeroLoop footage is unchanged. The panel identifies the footage as illustrative.

Reduced-motion and data-saver users see a still image. At phone sizes the left panel is omitted and neither video is mounted or requested. The Google sign-in layout remains independent of playback. Missing media or rejected autoplay retain the poster fallback.

Verified in a rendered Chrome browser: autoplay advances, both clips appear, intermediate crossfade is visible, the reel returns to the first clip, pause/resume works, reduced motion removes videos, and 390/360 px sign-in has no horizontal overflow.
