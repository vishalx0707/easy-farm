const qs = selector => document.querySelector(selector);
const content = qs("#content");
const editor = qs("#editor");
const params = new URLSearchParams(location.search);
const batch = params.get("batch");
const categories = ["Peppers", "Root vegetables", "Tomatoes", "Leafy greens", "Other"];
const screens = {
  buyer: { overview: "Overview", messages: "Messages", catalogue: "Produce", farmers: "Find growers", market: "Market prices", offers: "Offers", orders: "Orders", deliveries: "Deliveries", history: "Trade history" },
  grower: { overview: "Overview", messages: "Messages", listings: "Crops", farms: "Farm profiles", market: "Market prices", offers: "Offers", orders: "Orders", deliveries: "Deliveries", history: "Trade history" }
};
const actions = {
  farm: "Farm saved.", listing: "Listing saved.", offer: "Offer sent.", counter: "Counteroffer sent.",
  accept: "Order accepted.", decline: "Offer declined.", message: "Message sent.", quality: "Sample quality check recorded.",
  "order-status": "Delivery status updated.", payment: "Sample payment recorded."
};
const state = {
  role: params.get("role") === "grower" ? "grower" : "buyer",
  view: params.get("view"), farm: localStorage.getItem("easyfarm-farm") || "meadow",
  detail: params.get("detail") ? {type: params.get("type"), id: params.get("detail")} : null, filters: { search: "", category: "", max: "", location: "", quality: "" },
  period: "7", marketCrop: "Peppers", offerSort: "recent", edit: null
};
let data;
let busy = false;
const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = value => String(value ?? "").replace(/[&<>"']/g, token => escapes[token]);
const money = value => "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const time = value => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const farmBy = id => data.farms.find(farm => farm.id === id);
const listingBy = id => data.listings.find(listing => listing.id === id);
const offerBy = id => data.offers.find(offer => offer.id === id);
const photo = category => ({
  Peppers: "hero-footage/fresh-produce/poster-5479114.jpg",
  "Root vegetables": "hero-footage/fresh-produce/poster-10787015.jpg",
  Tomatoes: "assets/posters/07-tomato-macro-detail-4k.jpg",
  "Leafy greens": "assets/posters/08-couple-harvesting-4k.jpg"
}[category] || "assets/posters/04-vegetable-basket-harvest-4k.jpg");

function notice(message, error = false) {
  const box = qs("#notice");
  box.hidden = !message;
  box.textContent = message;
  box.classList.toggle("error", error);
}
async function read() {
  const result = await fetch("/api/state");
  if (!result.ok) throw Error("Could not load the marketplace.");
  data = await result.json();
  if (!farmBy(state.farm)) state.farm = data.farms[0]?.id;
}
async function mutate(action, values = {}) {
  if (busy) return;
  busy = true;
  qs("#save-editor").disabled = true;
  try {
    const response = await fetch("/api/action", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: state.role, farm: state.farm, ...values, action })
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    await read();
    if (action === "farm") {
      state.farm = result.id;
      localStorage.setItem("easyfarm-farm", state.farm);
    }
    if (action === "listing") state.detail = {type:"lot",id:result.id};
    if (action === "offer") { state.view = "offers"; state.detail = { type: "offer", id: result.id }; }
    if (action === "accept") { state.view = "orders"; state.detail = { type: "order", id: result.id }; }
    if (editor.open) editor.close();
    notice(actions[action]);
    render();
  } catch (error) {
    if (editor.open) {
      qs("#editor-error").textContent = error.message;
      qs("#editor-error").hidden = false;
    } else notice(error.message, true);
  } finally {
    busy = false;
    qs("#save-editor").disabled = false;
  }
}

const paths={overview:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',catalogue:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',listings:'M12 21V9m0 7C3 16 3 7 3 7c9 0 9 9 9 9Zm0-5s0-9 9-9c0 9-9 9-9 9Z',offers:'M3 3h9l9 9-9 9-9-9Zm5 4h.01',orders:'M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4',messages:'M3 4h18v13H8l-5 4Z',deliveries:'M3 6h11v11H3Zm11 4h4l3 4v3h-7M8 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm12 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z',market:'M3 3v18h18M6 16l5-5 4 2 6-8'};
const icons=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>']));
const navigationOrder=['overview','listings','catalogue','offers','orders','messages','deliveries','market'];
const button = (label, operation, key = "", style = "") =>
  '<button type="button" class="' + style + '" data-action="' + operation + '" data-id="' + e(key) + '">' + e(label) + '</button>';
const badge = label => '<span class="badge">' + e(label) + '</span>';
const empty = copy => '<p class="empty">' + e(copy) + '</p>';
const metric = (label, value) => '<div><dt>' + e(label) + '</dt><dd>' + e(value) + '</dd></div>';
function hero(title, copy, action = "", image = "") {
  const visual = image ? ' style="--feature-image:url(' + e(image) + ')"' : "";
  return '<section class="feature"' + visual + '><div><h2>' + e(title) + '</h2><p>' + e(copy) + '</p>' + action + '</div></section>';
}
function listingCards(listings) {
  return listings.length ? listings.map(lot => '<article class="lot-card"><img src="' + photo(lot.category) + '" alt="" loading="lazy"><div class="lot-copy"><div class="lot-top"><div><h3>' + e(lot.crop) + '</h3><p>' + e(farmBy(lot.farm)?.name) + ' · ' + e(farmBy(lot.farm)?.location) + '</p></div><strong>' + money(lot.price) + '<small> / kg</small></strong></div><div class="lot-bottom"><span>' + e(lot.quantity) + ' kg · Grade ' + e(lot.grade) + '</span>' + button("View lot", "lot", lot.id) + '</div></div></article>').join("") : empty("No produce matches those filters.");
}
function filtered() {
  const { search, category, max, location, quality } = state.filters;
  return data.listings.filter(lot => {
    const farm = farmBy(lot.farm);
    return lot.open && lot.quantity > 0 && (!search || (lot.crop + " " + farm.name).toLowerCase().includes(search.toLowerCase())) &&
      (!category || lot.category === category) && (!max || lot.price <= Number(max)) &&
      (!location || farm.location.toLowerCase().includes(location.toLowerCase())) && (!quality || lot.quality.startsWith("Sample"));
  });
}
function options(items, selected) {
  return items.map(item => '<option' + (item === selected ? ' selected' : '') + '>' + e(item) + '</option>').join("");
}
function overview() {
 const grower=state.role==='grower', farm=farmBy(state.farm);
 const lots=data.listings.filter(l=>l.open&&l.quantity>0&&(!grower||l.farm===state.farm));
 const lot=lots[0];
 const pending=data.offers.filter(o=>o.status==='Pending'&&(!grower||o.farm===state.farm)).length;
 return '<section class="overview-hero"><div class="overview-intro"><h2>'+(grower?'Good morning.':'Fresh from the farm.')+'</h2><p>'+(grower?'Manage your harvest, offers, and orders.':'Find your grower. Agree your terms. Keep trade simple.')+'</p></div><div class="overview-cards"><article class="harvest-spotlight"><img src="'+photo(lot?.category)+'" alt="Representative harvest"><div><p class="eyebrow">'+(grower?'HARVEST READY':'AVAILABLE NOW')+'</p><h3>'+e(lot?.crop||'Your next harvest')+'</h3><p>'+(lot?e(lot.quantity)+' kg · '+money(lot.price)+'/kg':'Publish your first crop lot.')+'</p>'+button(grower?'List harvest':'Browse produce',grower?'edit-lot':'browse','','primary')+'</div></article><article class="lot-record"><div class="lot-record-heading"><h3>Lot record</h3><small>'+e(lot?.id||'New harvest')+'</small></div><dl>'+metric('Crop',lot?.crop||'—')+metric('Grade',lot?.grade||'—')+metric('Harvest',lot?.harvest||'Not supplied')+metric('Available',lot?lot.quantity+' kg':'—')+metric('Asking price',lot?money(lot.price)+'/kg':'—')+'</dl>'+(lot?button('View lot','lot',lot.id):'')+'</article></div><div class="overview-bottom"><div class="grower-caption"><span class="avatar">'+e(farm.person[0])+'</span><div><strong>'+e(farm.person)+'</strong><small>'+e(farm.name)+' · '+e(farm.location)+'</small></div>'+button('Farm profile','farm',farm.id)+'</div><p class="overview-note">'+pending+' open offers · '+lots.length+' available lots</p></div></section>';
}
function deliveries() {
  return orders();
}
function messages(){
 const list=data.offers.filter(o=>state.role!=='grower'||o.farm===state.farm).slice().reverse();
 return '<div class="section-row"><div><h2>Conversations</h2><p class="eyebrow">Messages stay connected to your trade.</p></div></div>'+(list.length?'<div class="record-list trade-records">'+list.map(o=>'<article><div><h3>'+e(o.crop)+'</h3><p>'+e(farmBy(o.farm)?.name)+'</p><p>'+e(o.messages.at(-1)?.body.slice(0,100)||'Start the conversation.')+'</p></div>'+button('Open conversation','offer-detail',o.id)+'</article>').join('')+'</div>':empty('Make or receive an offer to start a direct conversation.'));
}
function tradeHistory() {
  const records = data.history.filter(entry => state.role !== 'grower' || data.orders.find(o=>o.id===entry.order)?.farm === state.farm);
  return '<div class="section-row"><h2>Trade history</h2><span>Saved order activity</span></div><div class="record-list">' + (records.length ? records.slice().reverse().map(entry=>'<article class="history-row"><div><h3>' + e(entry.event) + '</h3><p>' + e(time(entry.at)) + '</p></div><span>' + e(entry.order) + '</span>' + button('View order','order',entry.order) + '</article>').join('') : empty('Your accepted trades and delivery updates will appear here.')) + '</div>';
}
function catalogue() {
  return hero("Produce, direct from farms.", "Check availability and asking prices before you contact a grower.", button('Market prices','market-view'), "assets/posters/03-tomato-harvest-4k.jpg") +
    '<form class="filters" id="filters"><label>Search<input name="search" placeholder="Crop or farm" value="' + e(state.filters.search) + '"></label>' +
    '<label>Crop type<select name="category"><option value="">All crops</option>' + options(categories, state.filters.category) + '</select></label>' +
    '<label>Location<input name="location" placeholder="City or region" value="' + e(state.filters.location) + '"></label>' +
    '<label>Max ₹/kg<input name="max" type="number" min="1" value="' + e(state.filters.max) + '"></label>' +
    '<label>Quality<select name="quality"><option value="">Any status</option><option value="sample"' + (state.filters.quality ? " selected" : "") + '>Sample check passed</option></select></label>' +
    button("Clear", "clear") + '</form><div class="section-row"><h2>Available produce</h2><span id="result-count"></span></div><div class="lot-grid" id="lot-grid"></div>';
}
function fillLots() {
  const lots = filtered();
  qs("#result-count").textContent = lots.length + (lots.length === 1 ? " listing" : " listings");
  qs("#lot-grid").innerHTML = listingCards(lots);
}
function farmers() {
  const editing = state.role === "grower";
  return '<div class="section-row"><h2>' + (editing ? "Your farms" : "Growers you can trade with") + '</h2>' +
    (editing ? button("Create farm profile", "edit-farm", "", "primary") : "") + '</div><div class="farm-grid">' +
    data.farms.map(farm => '<article class="farm-record"><img src="' + e(farm.image) + '" alt="" loading="lazy"><div><p class="eyebrow">' + e(farm.location) + '</p><h3>' + e(farm.name) + '</h3><p>' + e(farm.person) + '</p><div class="actions">' + button("View profile", "farm", farm.id) +
      (editing ? button("Edit farm", "edit-farm", farm.id) : "") + '</div></div></article>').join("") + '</div>';
}
function growerListings() {
  const farm = farmBy(state.farm);
  const lots = data.listings.filter(lot => lot.farm === state.farm);
  return hero(farm?.name || "Your farm", farm ? farm.person + " · " + farm.location : "Create a profile to start listing produce.",
    button(farm ? "List your harvest" : "Create farm profile", farm ? "edit-lot" : "edit-farm", "", "primary"), farm?.image) +
    '<div class="section-row"><h2>Crop listings</h2>' + button('Market prices','market-view') + '</div>' +
    (lots.length ? '<div class="record-list">' + lots.map(lot => '<article><img src="' + photo(lot.category) + '" alt=""><div><h3>' + e(lot.crop) + '</h3><p>' + lot.quantity + ' kg available · ' + money(lot.price) + '/kg</p></div>' + badge(lot.open ? "Available" : "Sold out") + button("View", "lot", lot.id) + button("Edit", "edit-lot", lot.id) + '</article>').join("") + '</div>' : empty("No listings for this farm yet."));
}

function lotDetails(lot) {
  const farm = farmBy(lot.farm);
  const owned = state.role === "grower" && lot.farm === state.farm;
  return '<div class="detail-layout"><img class="detail-photo" src="' + photo(lot.category) + '" alt=""><section class="panel"><p class="eyebrow">Crop lot · ' + e(lot.category) + '</p><h2>' + e(lot.crop) + '</h2><p>' + e(farm?.name) + ' · ' + e(farm?.location) + '</p><dl class="facts">' +
    metric("Asking price", money(lot.price) + " / kg") + metric("Available", lot.quantity + " kg") + metric("Grade (grower declared)", lot.grade) +
    metric("Pickup", lot.pickup) + metric("Harvest", lot.harvest || "Not supplied") + metric("Quality", lot.quality) + '</dl><p>' + e(lot.notes) + '</p><div class="actions">' +
    (state.role === "buyer" && lot.open && lot.quantity ? button("Make an offer", "new-offer", lot.id, "primary") : "") +
    (owned ? button("Edit listing", "edit-lot", lot.id) + (lot.quality.startsWith("Sample") ? "" : button("Run sample quality check", "quality", lot.id)) : "") +
    button("View farm", "farm", lot.farm) + '</div></section></div>';
}
function farmDetails(farm) {
  const lots = data.listings.filter(lot => lot.farm === farm.id && lot.open);
  return hero(farm.name, farm.person + " · " + farm.location, state.role === "grower" ? button("Edit profile", "edit-farm", farm.id, "primary") : "", farm.image) +
    '<p class="farm-bio">' + e(farm.bio || "No farm description yet.") + '</p><div class="section-row"><h2>Available harvest</h2></div><div class="lot-grid">' + listingCards(lots) + '</div>';
}

const series = {
  Peppers: { 7: [34,35,34,37,36,38,36], 30: [31,34,32,36,35,34,37,36,38,36] },
  "Root vegetables": { 7: [25,26,24,24,25,27,26], 30: [22,24,26,25,24,26,24,25,27,26] },
  Tomatoes: { 7: [27,28,28,31,29,30,29], 30: [25,25,28,27,31,29,28,30,31,29] }
};
function market() {
  const values = series[state.marketCrop][state.period];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const y = value => 158 - (value - low) * 123 / (high - low);
  const path = values.map((value, index) => (index ? "L" : "M") + (44 + index * 541 / (values.length - 1)) + " " + y(value)).join(" ");
  const lots = data.listings.filter(lot => lot.open && lot.category === state.marketCrop);
  return '<div class="market-grid"><section class="chart-panel"><div class="chart-top"><div><p class="eyebrow">Illustrative market reference · ₹/kg</p><h2>' + e(state.marketCrop) + '</h2></div><label>Crop<select id="market-crop">' + options(Object.keys(series), state.marketCrop) + '</select></label></div>' +
    '<div class="periods">' + button("7 days", "period", "7", state.period === "7" ? "active" : "") + button("30 days", "period", "30", state.period === "30" ? "active" : "") + '</div>' +
    '<svg viewBox="0 0 620 192" role="img" aria-label="Sample range ' + money(low) + ' to ' + money(high) + ' per kilogram"><path class="chart-grid" d="M44 35H585 M44 96H585 M44 158H585"/><text x="0" y="39">' + high + '</text><text x="0" y="162">' + low + '</text><path class="chart-area" d="' + path + ' L585 158H44Z"/><path pathLength="1" class="chart-line" d="' + path + '"/></svg><p>Example figures. Trade terms can vary by grade, quantity and pickup.</p></section>' +
    '<aside class="panel"><p class="eyebrow">Asking prices</p><h2>Compare available lots</h2><dl class="facts">' + lots.map(lot => metric(lot.crop, money(lot.price) + " / kg")).join("") + '</dl>' + (!lots.length ? empty("No active listings for this crop type.") : "") + '</aside></div>';
}
function offers() {
  const list = data.offers.filter(offer => state.role !== "grower" || offer.farm === state.farm);
  list.reverse();
  if (state.offerSort === "price") list.sort((a,b) => b.price - a.price);
  return '<div class="section-row"><div><h2>' + (state.role === "grower" ? "Incoming offers" : "Your offers") + '</h2><p class="eyebrow">' + list.length + ' records</p></div><label>Compare by<select id="offer-sort"><option value="recent"' + (state.offerSort === "recent" ? " selected" : "") + '>Most recent</option><option value="price"' + (state.offerSort === "price" ? " selected" : "") + '>Highest price per kg</option></select></label></div>' +
    (list.length ? '<div class="record-list trade-records">' + list.map(offer => '<article><div><h3>' + e(offer.crop) + '</h3><p>' + e(farmBy(offer.farm)?.name) + '</p></div><span>' + e(offer.quantity) + ' kg · ' + money(offer.price) + '/kg<small class="trade-pickup">Pickup: ' + e(offer.pickup) + '</small></span>' + badge(offer.status) + button("Open offer", "offer-detail", offer.id) + '</article>').join("") + '</div>' :
    empty("Start a conversation by making an offer on a produce lot. Your terms and messages stay together."));
}
function thread(offer) {
  return '<section class="panel thread"><h2>Direct messages</h2><div class="messages">' +
    (offer.messages.length ? offer.messages.map(message => '<div class="message ' + (message.by === state.role ? "own" : "") + '"><small>' + (message.by === "grower" ? e(farmBy(offer.farm)?.person || "Grower") : "Buyer") + ' · ' + e(time(message.at)) + '</small><p>' + e(message.body) + '</p></div>').join("") : empty("No messages yet.")) +
    '</div><form id="message-form" data-offer="' + e(offer.id) + '"><label>Message<input name="message" required maxlength="500" placeholder="Confirm grade, quantity or pickup"></label><button class="primary">Send</button></form></section>';
}
function offerDetails(offer) {
  const respond = offer.status === "Pending" && offer.by !== state.role;
  const order = data.orders.find(order => order.offer === offer.id);
  return '<div class="market-grid"><section class="panel"><p class="eyebrow">' + e(farmBy(offer.farm)?.name) + '</p><h2>' + e(offer.crop) + '</h2>' + badge(offer.status) + '<dl class="facts">' +
    metric("Lot asking price", money(listingBy(offer.listing)?.price || offer.price) + " / kg") + metric("Current offer", money(offer.price) + " / kg") +
    metric("Quantity", offer.quantity + " kg") + metric("Offer value", money(offer.quantity * offer.price)) + metric("Pickup", offer.pickup) +
    metric("Last proposal", offer.by === "grower" ? "Grower" : "Buyer") + '</dl><div class="actions">' +
    (respond ? button("Accept offer", "accept", offer.id, "primary") + button("Decline", "decline", offer.id) : "") +
    (respond ? button("Counteroffer", "counter", offer.id) : "") +
    (order ? button("View order", "order", order.id, "primary") : "") + '</div></section>' + thread(offer) + '</div>';
}
function orders() {
  const list = data.orders.filter(order => state.role !== "grower" || order.farm === state.farm);
  return '<div class="section-row"><h2>'+(state.view==='deliveries'?'Deliveries':'Orders')+'</h2><span>Agreed terms and delivery status</span></div>' +
    (list.length ? '<div class="record-list trade-records">' + list.slice().reverse().map(order => '<article><div><h3>' + e(order.crop) + '</h3><p>' + e(order.id) + ' · ' + e(farmBy(order.farm)?.name) + '</p></div><span>' + e(order.quantity) + ' kg · ' + money(order.total) + '</span>' + badge(order.status) + button("View order", "order", order.id) + '</article>').join("") + '</div>' :
    empty("Accept an offer to create an order and reserve the stock."));
}
function orderDetails(order, receivedByQr = false) {
  const steps = ["Accepted", "Packed", "Ready for pickup", "Picked up", "Delivered"];
  const status = steps.indexOf(order.status);
  const next = steps[status + 1];
  const farm = farmBy(order.farm);
  const blocks = data.history.filter(entry => entry.order === order.id);
  const batchLink = "/app.html?batch=" + encodeURIComponent(order.id);
  return '<div class="order-layout"><section class="panel"><p class="eyebrow">' + (receivedByQr ? "Scanned batch record" : "Order") + ' · ' + e(order.id) + '</p><h2>' + e(order.crop) + '</h2>' + badge(order.status) +
    '<ol class="timeline">' + steps.map((step, index) => {
      const event = order.timeline.find(event => event.event === step);
      return '<li class="' + (index <= status ? "reached" : "") + '"><button type="button" data-action="milestone" data-id="' + index + '" aria-pressed="' + (index === status) + '">' + step + '</button><small>' + (event ? e(time(event.at)) : "Pending") + '</small></li>';
    }).join("") + '</ol><p id="milestone-note" aria-live="polite">Current status: ' + e(order.status) + '.</p><dl class="facts">' + metric("Grower", farm.name + " · " + farm.person) + metric("Origin", farm.location) +
    metric("Quantity", order.quantity + " kg") + metric("Grade and quality", order.grade + " · " + order.quality) + metric("Pickup", order.pickup) +
    metric("Agreed price", money(order.price) + " / kg") + metric("Total", money(order.total)) + metric("Payment", order.payment) + '</dl><div class="actions">' +
    (!receivedByQr && state.role === "grower" && order.farm === state.farm && next ? button("Mark " + next.toLowerCase(), "status", order.id, "primary") : "") +
    (!receivedByQr && state.role === "buyer" && order.payment === "Unpaid" ? button("Record sample payment", "payment", order.id, "primary") : "") +
    (!receivedByQr ? button("Open messages", "offer-detail", order.offer) : "") + '</div></section>' +
    '<aside class="panel trace-panel"><p class="eyebrow">From farm to handoff</p><h2>Order trace record</h2><img width="156" height="156" src="/api/qr/' + e(order.id) + '" alt="QR code for order ' + e(order.id) + '"><a href="' + batchLink + '">Open trace link</a><p>Scan to open this saved order. Other devices must be able to reach this local server.</p><h3>Transaction history</h3><ol class="event-list">' + blocks.map(entry => '<li><strong>' + e(entry.event) + '</strong><small>' + e(time(entry.at)) + '</small></li>').join('') + '</ol><p>Payment and quality checks are simulations. No money is transferred and no independent inspection is performed.</p></aside></div>';

}

function render() {
  if (!batch) { const url = new URL(location.href); url.search = ''; url.searchParams.set('role', state.role); url.searchParams.set('view', state.view || 'overview'); if(state.detail){url.searchParams.set('type',state.detail.type);url.searchParams.set('detail',state.detail.id);} history.replaceState(null,'',url); }
  document.body.dataset.view = state.detail ? 'detail' : state.view || 'overview';
  const navigation = screens[state.role];
  if (!navigation[state.view]) state.view = Object.keys(navigation)[0];
  qs("#app-nav").innerHTML = Object.entries(navigation).filter(([key])=>!["farms","farmers","history"].includes(key)).sort(([a],[b])=>navigationOrder.indexOf(a)-navigationOrder.indexOf(b)).map(([key, label]) =>
    '<button type="button" data-nav="' + key + '"' + (state.view === key ? ' aria-current="page"' : "") + '>' + '<span class="nav-icon" aria-hidden="true">' + icons[key] + '</span>' + e(label) + '</button>').join("");
  const mobileTabs=[['overview','Home'],[state.role==='grower'?'listings':'catalogue',state.role==='grower'?'Crops':'Produce'],['offers','Offers'],['orders','Orders'],['messages','Messages']];
  qs('#mobile-nav').innerHTML=mobileTabs.map(([key,label])=>'<button type="button" data-nav="'+key+'"'+(state.view===key?' aria-current="page"':'')+'><span aria-hidden="true">'+icons[key]+'</span><span>'+label+'</span></button>').join('');
  document.querySelectorAll("[data-role]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.role === state.role)));
  qs("#workspace-role").textContent = state.role === "grower" ? farmBy(state.farm)?.name : "Business buyer";
  const farmContext = qs("#farm-context");
  farmContext.hidden = state.role !== "grower" || Boolean(batch);
  farmContext.innerHTML = farmContext.hidden ? "" : '<label>Active farm<select id="farm-select">' + data.farms.map(item =>
    '<option value="' + e(item.id) + '"' + (item.id === state.farm ? " selected" : "") + '>' + e(item.name) + '</option>').join("") + '<option value="__manage">Manage farms…</option></select></label>';
  qs("#view-title").textContent = batch ? "Batch record" : state.detail ? "Trade details" : navigation[state.view];
  if (batch) {
    const order = data.orders.find(item => item.id === batch);
    content.innerHTML = order ? orderDetails(order, true) : empty("This batch does not exist on this server.");
  } else if (state.detail) {
    const { type, id } = state.detail;
    const item = type === "lot" ? listingBy(id) : type === "farm" ? farmBy(id) : type === "offer" ? offerBy(id) : data.orders.find(item => item.id === id);
    const details = item ? { lot: lotDetails, farm: farmDetails, offer: offerDetails, order: orderDetails }[type](item) : empty("This record is unavailable.");
    content.innerHTML = '<div class="back">' + button("Back", "back") + '</div>' + details;
  } else {
    content.innerHTML = { overview, messages, catalogue, farmers, listings: growerListings, farms: farmers, market, offers, orders, deliveries, history: tradeHistory }[state.view]();
    if (state.view === "catalogue") fillLots();
  }
  content.setAttribute("aria-busy", "false");
}
function navigate(view) {
  qs('.mobile-menu').setAttribute('aria-expanded','false');
  qs('.sidebar').classList.remove('menu-open');
  if (batch) { location.href = "/app.html?role=" + state.role + "&view=" + view; return; }
  state.view = view;
  state.detail = null;
  notice("");
  render();
  content.scrollTo({ top: 0, behavior: "instant" });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    content.animate?.([{ opacity: .68, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
      { duration: 180, easing: "ease-out" });
  }
}

const input = (label, name, value = "", type = "text", required = true) =>
  '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + e(value) + '"' +
  (required ? " required" : "") + (type === "number" ? ' min="0.01" max="10000000" step="any"' : ' maxlength="500"') + '></label>';
const textarea = (label, name, value = "") =>
  '<label class="field-wide">' + label + '<textarea name="' + name + '" maxlength="500" rows="3">' + e(value) + '</textarea></label>';
function openEditor(kind, key) {
  let fields, title, values = {};
  if (kind === "farm") {
    const farm = farmBy(key) || {};
    title = key ? "Edit farm profile" : "Create farm profile";
    values = { id: key };
    fields = input("Farm name", "name", farm.name) + input("Grower name", "person", farm.person) +
      input("Location", "location", farm.location) + textarea("About this farm", "bio", farm.bio);
  } else if (kind === "listing") {
    if (!state.farm) { openEditor("farm"); return; }
    const lot = listingBy(key) || {};
    title = key ? "Edit crop listing" : "List your harvest";
    values = { id: key };
    fields = input("Crop name", "crop", lot.crop) +
      '<label>Crop type<select name="category">' + options(categories, lot.category) + '</select></label>' +
      input("Available kg", "quantity", lot.quantity, "number") + input("Asking price ₹/kg", "price", lot.price, "number") +
      input("Grade", "grade", lot.grade) + input("Harvest date", "harvest", lot.harvest, "date", false) +
      input("Pickup window", "pickup", lot.pickup) + textarea("Crop and packing notes", "notes", lot.notes);
  } else {
    const record = kind === "offer" ? listingBy(key) : offerBy(key);
    title = kind === "offer" ? "Make an offer" : "Propose new terms";
    values = kind === "offer" ? { listing: key } : { offer: key };
    fields = input("Quantity (kg)", "quantity", record.quantity, "number") + input("Offer ₹/kg", "price", record.price, "number") +
      input("Pickup window", "pickup", record.pickup) + (kind === "offer" ? textarea("Message to the grower", "message") : "");
  }
  state.edit = { kind, values };
  qs("#editor-title").textContent = title;
  qs("#fields").innerHTML = fields;
  qs("#editor-error").hidden = true;
  qs("#save-editor").textContent = kind === "offer" || kind === "counter" ? "Send offer" : "Save";
  editor.showModal();
}

qs("#editor-form").addEventListener("submit", event => {
  event.preventDefault();
  mutate(state.edit.kind, { ...state.edit.values, ...Object.fromEntries(new FormData(event.currentTarget)) });
});
qs("#close-editor").addEventListener("click", () => editor.close());

document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (target?.classList.contains('mobile-menu')) {
    const open = target.getAttribute('aria-expanded') !== 'true';
    target.setAttribute('aria-expanded',String(open));
    qs('.sidebar').classList.toggle('menu-open',open);
    return;
  }
  if (!target || !data || busy) return;
  const { role, nav, action, id } = target.dataset;
  if (role) { state.role = role; navigate(Object.keys(screens[role])[0]); return; }
  if (nav) { navigate(nav); return; }
  if (!action) return;
  if (action === "browse") { navigate(state.role === "grower" ? "listings" : "catalogue"); return; }
  if (action === "market-view") { navigate('market'); return; }
  if (action === "back") { navigate(state.view); return; }
  if (action === "clear") { Object.keys(state.filters).forEach(key => { state.filters[key] = ""; }); render(); return; }
  if (action === "period") { state.period = id; render(); qs('[data-action="period"][data-id="' + id + '"]').focus(); return; }
  if (action === "milestone") {
    const descriptions = ["The offer was accepted and stock was reserved.", "The grower packs this order against its batch record.", "The grower confirms the order is ready for the agreed pickup.", "The order has been collected from the farm.", "The grower records delivery in the order history."];
    content.querySelectorAll('[data-action="milestone"]').forEach(item => item.setAttribute("aria-pressed", String(item === target)));
    qs("#milestone-note").textContent = descriptions[Number(id)];
    qs("#milestone-note").animate?.([{ opacity: .55 }, { opacity: 1 }], matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
    return;
  }
  const types = { lot: "lot", farm: "farm", "offer-detail": "offer", order: "order" };
  if (types[action]) {
    state.detail = { type: types[action], id };
    notice("");
    render();
    scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  const editors = { "edit-farm": "farm", "edit-lot": "listing", "new-offer": "offer", counter: "counter" };
  if (editors[action]) { openEditor(editors[action], id); return; }
  if (action === "accept" || action === "decline") { mutate(action, { offer: id }); return; }
  if (action === "quality") { mutate(action, { listing: id }); return; }
  if (action === "payment") { mutate(action, { order: id }); return; }
  if (action === "status") {
    const status = data.orders.find(order => order.id === id)?.status;
    mutate("order-status", { order: id, status: { Accepted: "Packed", Packed: "Ready for pickup", "Ready for pickup": "Picked up", "Picked up": "Delivered" }[status] });
  }
});
content.addEventListener("input", event => {
  if (event.target.form?.id !== "filters") return;
  state.filters[event.target.name] = event.target.value;
  fillLots();
});
document.addEventListener("change", event => {
  if (event.target.id === "farm-select") {
    if(event.target.value==='__manage'){navigate('farms');return;}
    state.farm = event.target.value;
    state.detail = null;
    localStorage.setItem("easyfarm-farm", state.farm);
    render();
    qs("#farm-select").focus();
  }
  if (event.target.id === "offer-sort") {
    state.offerSort = event.target.value;
    render();
    qs("#offer-sort").focus();
  }
  if (event.target.id === "market-crop") {
    state.marketCrop = event.target.value;
    render();
    qs("#market-crop").focus();
  }
});
content.addEventListener("submit", event => {
  event.preventDefault();
  if (event.target.id === "message-form") mutate("message", { offer: event.target.dataset.offer, ...Object.fromEntries(new FormData(event.target)) });
});
window.addEventListener("focus", async () => {
  if (!data || editor.open || busy || content.contains(document.activeElement)) return;
  try { await read(); render(); } catch { /* Keep the current view if the local server is unavailable. */ }
});
(async () => {
  try {
    await read();
    render();
    if (state.role === "grower" && state.view === "listings" && params.get("new") === "1") openEditor("listing");
  } catch (error) {
    content.setAttribute("aria-busy", "false");
    notice(error.message, true);
  }
})();
