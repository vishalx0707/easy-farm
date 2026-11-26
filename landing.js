const film = document.querySelector("#film");
function autoplay() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData) return;
  film.src = matchMedia("(max-width: 760px)").matches
    ? film.dataset.src
    : "assets/hero/easyfarm-film-desktop.mp4";
  film.play().catch(() => {});
}
window.addEventListener("load", () => {
  if ("requestIdleCallback" in window) requestIdleCallback(autoplay, { timeout: 600 });
  else setTimeout(autoplay, 250);
}, { once: true });

const stagePane = document.querySelector("#stage-pane");
const stageButtons = [...document.querySelectorAll("[data-stage]")];
const roleButtons = [...document.querySelectorAll("[data-view]")];
const next = document.querySelector("#trade-next");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const lot = { crop: "Red bell peppers", farm: "Meadow Lane Farm", grower: "Maya Rao", quantity: 240, offer: 37, pickup: "Friday · 8–10 am", id: "EF-024" };
const prices = { 7: [34, 35, 34, 37, 36, 38, 36], 30: [31, 34, 32, 36, 35, 34, 37, 36, 38, 36] };
const state = { stage: 0, role: "buyer", period: 7, deal: 0, delivery: 0 };
const labels = {
  buyer: ["Discover the farm", "View the crop lot", "Compare the price", "Agree to terms", "Track delivery"],
  grower: ["Show your farm", "List your harvest", "Compare offers", "Accept the offer", "Track delivery"]
};
const phases = [
  { name: "Accepted", time: "Thursday · 3:15 pm", title: "Terms confirmed", copy: "The grower accepted 240 kg at ₹37/kg. Both sides can see the agreed Friday pickup window." },
  { name: "Packed", time: "Friday · 7:40 am", title: "Ready for pickup", copy: "The crop was packed against this order. Its batch QR links back to Meadow Lane Farm and the handling record." },
  { name: "Delivered", time: "Friday · 10:20 am", title: "Received by the buyer", copy: "Delivery is recorded alongside the agreed terms and batch history." }
];

const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

function profile() {
  return `<div class="profile-stage">
    <figure class="profile-photo"><img src="assets/posters/03-tomato-harvest-4k.jpg" alt="Grower working inside a greenhouse" decoding="async"><figcaption>Illustrative profile · stock footage still</figcaption></figure>
    <div class="profile-copy"><p class="record-label">Grower profile</p><h3>${lot.grower}</h3><p class="farm-name">${lot.farm}</p>
      <p>${state.role === "buyer" ? "Get to know the farm before making an offer. See what’s in season and check availability with the grower." : "Introduce your farm in your own words and give buyers a clear view of what you grow."}</p>
      <div class="profile-detail"><span>Growing method</span><strong>Greenhouse</strong><span>Available crop</span><strong>${lot.crop}</strong></div>
    </div>
  </div>`;
}

function listing() {
  return `<div class="listing-stage">
    <div class="listing-copy"><p class="record-label">Crop listing</p><h3>${lot.crop}</h3><p class="farm-name">${lot.farm}</p>
      <dl class="record-fields">${row("Available", lot.quantity + " kg")}${row("Pickup", lot.pickup)}${row("Growing method", "Greenhouse")}</dl>
    </div>
    <figure class="listing-photo"><img src="hero-footage/fresh-produce/poster-5479114.jpg" alt="Red bell peppers growing in a greenhouse" decoding="async"></figure>
  </div>`;
}

function market() {
  const points = prices[state.period];
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const y = value => 156 - (value - 30) * 14;
  const d = points.map((value, i) => `${i ? "L" : "M"}${49 + i * 504 / (points.length - 1)} ${y(value)}`).join(" ");
  return `<div class="market-stage">
    <div class="chart-head"><div><p class="record-label">Sample market reference · ₹/kg</p><h3>Read the offer in context.</h3></div>
    <div class="periods" aria-label="Price history period"><button type="button" data-period="7" aria-pressed="${state.period === 7}">7 days</button><button type="button" data-period="30" aria-pressed="${state.period === 30}">30 days</button></div></div>
    <div class="chart-layout"><div><svg viewBox="0 0 572 192" role="img" aria-label="${state.period}-day sample range ₹${lo}–${hi} per kilogram. Offer ₹${lot.offer} per kilogram.">
      <path class="plot-guides" d="M49 16H553 M49 58H553 M49 100H553 M49 142H553"/>
      <g class="plot-labels"><text x="10" y="20">40</text><text x="10" y="62">37</text><text x="10" y="104">34</text><text x="10" y="146">31</text><text x="49" y="184">${state.period} days earlier</text><text x="553" y="184" text-anchor="end">Latest sample</text></g>
      <path class="plot-area" d="${d} L553 156 L49 156 Z"/>
      <path class="plot-offer" d="M49 ${y(lot.offer)}H553"/>
      <path class="plot-line" pathLength="1" d="${d}"/>
    </svg><div class="plot-key"><span>Market reference</span><span>Buyer offer</span></div></div>
    <div class="price-readout"><p>Buyer offer</p><strong>₹${lot.offer}<small> / kg</small></strong><p>Sample range</p><b>₹${lo}–${hi} / kg</b></div></div>
  </div>`;
}

function offer() {
  return `<div class="offer-stage">
    <div class="thread"><div class="thread-head"><span class="initial" aria-hidden="true">MR</span><div><strong>${lot.grower}</strong><small>${lot.farm}</small></div></div>
      <div class="thread-messages"><p><small>Buyer</small>Could you supply ${lot.quantity} kg at ₹${lot.offer}/kg?</p><p><small>${lot.grower.split(" ")[0]}</small>Yes. The full lot can be ready ${lot.pickup.toLowerCase().replace(" · ", ", ")}.</p>
      ${state.deal ? "<p><small>Buyer</small>That pickup window works. Please hold the full lot.</p>" : ""}</div>
    </div>
    <div class="offer-terms"><p class="record-label">${state.deal === 2 ? "Order accepted" : state.deal === 1 ? "Pickup confirmed" : "Offer received"}</p><h3>${lot.crop}</h3>
      <dl class="record-fields">${row("Quantity", lot.quantity + " kg")}${row("Offer", "₹" + lot.offer + " / kg")}${row("Pickup", lot.pickup)}</dl></div>
  </div>`;
}

function delivery() {
  const { time, title, copy } = phases[state.delivery];
  return `<div class="delivery-stage"><div class="delivery-record"><p class="record-label">Order ${lot.id} · Sample batch record</p><h3>${title}</h3>
    <ol class="delivery-steps">${phases.map((phase, index) => `<li><button type="button" data-delivery="${index}" aria-pressed="${state.delivery === index}"><span aria-hidden="true"></span>${phase.name}</button></li>`).join("")}</ol>
    <p class="record-time">${time}</p><p>${copy}</p><p class="batch-note">The batch QR links to origin and handling. Transaction history is recorded so later changes are detectable.</p></div>
    <figure class="delivery-photo"><img src="assets/posters/05-warehouse-qr-scanning-4k.jpg" alt="Warehouse worker checking stock" decoding="async"></figure>
  </div>`;
}

const views = [profile, listing, market, offer, delivery];

function render(animate = false) {
  const stage = state.stage;
  const isAccepted = state.deal === 2;
  stagePane.innerHTML = views[stage]();
  stagePane.dataset.stage = stage;
  stageButtons.forEach((button, index) => {
    const label = labels[state.role][index];
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.dataset.short = ["Farm", "Crop", "Price", "Offer", "Delivery"][index];
    if (index === stage) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  roleButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === state.role)));
  document.querySelector("#lot-state").textContent = stage === 4
    ? phases[state.delivery].name + " · " + lot.id + (isAccepted ? "" : " preview")
    : isAccepted ? "Accepted · " + lot.id : "Available · " + lot.quantity + " kg";
  document.querySelector("#journey-context").textContent = [
    "Farm profile and current availability", "Pickup details travel with the listing",
    "Illustrative prices for this crop", "Agreed terms stay with the order",
    "Shared with the buyer and grower"
  ][stage];
  const action = stage === 3 ? ["Confirm pickup", "Accept sample offer", "Track this order"][state.deal]
    : stage === 4 ? "Back to crop listing" : labels[state.role][stage + 1];
  next.firstChild.textContent = action + " ";
  if (animate && !motion.matches && stagePane.animate) {
    stagePane.getAnimations().forEach(animation => animation.cancel());
    stagePane.animate([{ opacity: .62, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 240, easing: "ease-out" });
    stagePane.querySelector(".plot-line")?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 570, easing: "ease-out" });
  }
}

const storyTrack = document.querySelector("#story-track");
const sticky = matchMedia("(min-width: 761px) and (min-height: 690px) and (prefers-reduced-motion: no-preference)");
const stickyTop = 20;

function scrollToStage(index) {
  if (!sticky.matches) {
    storyTrack.scrollIntoView({ block: "start" });
    return;
  }
  const travel = storyTrack.offsetHeight - storyTrack.firstElementChild.offsetHeight;
  const start = scrollY + storyTrack.getBoundingClientRect().top - stickyTop;
  window.scrollTo({ top: start + index * travel / 4 + (index === 0 ? 1 : 0), behavior: "instant" });
}

function setStage(index, move = false) {
  if (index !== state.stage) {
    state.stage = index;
    render(true);
  }
  if (move) scrollToStage(index);
}

let scrollFrame = 0;
function readScroll() {
  scrollFrame = 0;
  if (!sticky.matches) return;
  const travelled = stickyTop - storyTrack.getBoundingClientRect().top;
  if (travelled < 0) return;
  const travel = storyTrack.offsetHeight - storyTrack.firstElementChild.offsetHeight;
  setStage(Math.min(4, Math.round(travelled * 4 / travel)));
}
window.addEventListener("scroll", () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(readScroll);
}, { passive: true });

stageButtons.forEach((button, index) => button.addEventListener("click", () => setStage(index, sticky.matches)));
roleButtons.forEach(button => button.addEventListener("click", () => {
  if (button.dataset.view === state.role) return;
  state.role = button.dataset.view;
  render(true);
}));
next.addEventListener("click", () => {
  if (state.stage === 3 && state.deal < 2) {
    state.deal += 1;
    render(true);
  } else setStage(state.stage === 4 ? 1 : state.stage + 1, sticky.matches);
});
stagePane.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const { period, delivery: milestone } = button.dataset;
  if (period === undefined && milestone === undefined) return;
  if (period !== undefined) state.period = Number(period);
  else state.delivery = Number(milestone);
  render(true);
  const selector = period !== undefined ? `[data-period="${period}"]` : `[data-delivery="${milestone}"]`;
  stagePane.querySelector(selector).focus({ preventScroll: true });
});
document.querySelectorAll("[data-role], [data-route]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    const [role, index] = (link.dataset.route || link.dataset.role + ":0").split(":");
    state.role = role;
    state.stage = Number(index);
    render(true);
    scrollToStage(state.stage);
  });
});
document.querySelector('a[href="#trace"]').addEventListener("click", event => {
  event.preventDefault();
  setStage(4, true);
});
render();
