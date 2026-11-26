const {randomUUID}=require("node:crypto");
const now = () => new Date().toISOString();
const id = prefix => prefix + "-" + randomUUID().slice(0, 8);
const seed = {
  farms: [
    { id: "meadow", name: "Meadow Lane Farm", person: "Maya Rao", location: "Nashik", bio: "We grow peppers and tomatoes in a greenhouse and pack to order.", image: "assets/posters/03-tomato-harvest-4k.jpg" },
    { id: "riverbend", name: "Riverbend Farm", person: "Dev Kumar", location: "Pune", bio: "Field-grown carrots, harvested in small batches.", image: "assets/posters/02-farmer-golden-field-4k.jpg" }
  ],
  listings: [
    { id: "peppers", farm: "meadow", crop: "Red bell peppers", category: "Peppers", quantity: 240, price: 37, grade: "A", harvest: "", pickup: "Friday, 8–10 am", notes: "Greenhouse lot. Packed in reusable crates.", quality: "Grower declared", open: true },
    { id: "carrots", farm: "riverbend", crop: "Field carrots", category: "Root vegetables", quantity: 320, price: 26, grade: "A", harvest: "", pickup: "Monday morning", notes: "Field-grown carrots. Pickup at the farm.", quality: "Grower declared", open: true },
    { id: "tomatoes", farm: "meadow", crop: "Vine tomatoes", category: "Tomatoes", quantity: 180, price: 30, grade: "A", harvest: "", pickup: "Saturday morning", notes: "Vine-ripened greenhouse tomatoes.", quality: "Grower declared", open: true }
  ],
  offers: [], orders: [], history: []
};
function requireThat(test, message) {
  if (!test) throw Object.assign(new Error(message), { client: true });
}
function text(value, label, optional = false) {
  const clean = typeof value === "string" ? value.trim() : "";
  requireThat((optional || clean.length) && clean.length <= 500, "Check " + label + " (maximum 500 characters).");
  return clean;
}
function amount(value, label) {
  const n = Number(value);
  requireThat(Number.isFinite(n) && n > 0 && n <= 10000000, "Enter a valid " + label + ".");
  return n;
}
function find(items, key, label) {
  const item = items.find(entry => entry.id === key);
  requireThat(item, label + " was not found.");
  return item;
}
function record(db, order, event, details) {
  const entry = { order: order.id, event, at: now(), details };
  db.history.push(entry);
  order.timeline.push({ event, at: entry.at });
}
function apply(db, data) {
  const { action, role } = data;
  requireThat(role === "grower" || role === "buyer", "Choose a workspace role.");
  const grower = role === "grower";

  if (action === "farm") {
    requireThat(grower, "Open the grower workspace to edit a farm.");
    const farm = data.id ? find(db.farms, data.id, "Farm") : { id: id("farm"), image: "assets/posters/02-farmer-golden-field-4k.jpg" };
    Object.assign(farm, { name: text(data.name, "farm name"), person: text(data.person, "grower name"), location: text(data.location, "location"), bio: text(data.bio, "farm description", true) });
    if (!data.id) db.farms.push(farm);
    return farm.id;
  }
  if (action === "listing") {
    requireThat(grower, "Open the grower workspace to list produce.");
    const farm = find(db.farms, data.farm, "Farm");
    const listing = data.id ? find(db.listings, data.id, "Listing") : { id: id("lot"), farm: farm.id, quality: "Grower declared", open: true };
    if (data.id) requireThat(listing.farm === data.farm, "Select the farm that owns this listing.");
    requireThat(listing.farm === farm.id, "Select this listing’s farm.");
    Object.assign(listing, { crop: text(data.crop, "crop name"), category: text(data.category, "category"), quantity: amount(data.quantity, "quantity"), price: amount(data.price, "price"), grade: text(data.grade, "grade"), pickup: text(data.pickup, "pickup window"), harvest: text(data.harvest, "harvest date", true), notes: text(data.notes, "notes", true), open: true, quality: "Grower declared" });
    if (!data.id) db.listings.push(listing);
    return listing.id;
  }
  if (action === "quality") {
    const listing = find(db.listings, data.listing, "Listing");
    requireThat(grower && listing.farm === data.farm, "Select the farm for this lot.");
    listing.quality = "Sample check passed (simulated)";
    return listing.id;
  }
  if (action === "order-status" || action === "payment") {
    const order = find(db.orders, data.order, "Order");
    if (action === "payment") {
      requireThat(!grower && order.payment === "Unpaid", "This sample payment is already recorded or unavailable in this view.");
      order.payment = "Paid (simulated)";
      record(db, order, "Sample payment recorded", { total: order.total });
    } else {
      requireThat(grower && order.farm === data.farm, "Select the grower for this order.");
      const next = { Accepted: "Packed", Packed: "Ready for pickup", "Ready for pickup": "Picked up", "Picked up": "Delivered" }[order.status];
      requireThat(next && data.status === next, "Refresh the order before updating it.");
      order.status = next;
      record(db, order, next, {});
    }
    return order.id;
  }
  if (action === "offer") {
    requireThat(!grower, "Use the buyer workspace to create an offer.");
    const listing = find(db.listings, data.listing, "Listing");
    const quantity = amount(data.quantity, "quantity");
    requireThat(listing.open && quantity <= listing.quantity, "That quantity is no longer available.");
    const offer = { id: id("offer"), listing: listing.id, farm: listing.farm, crop: listing.crop, quantity, price: amount(data.price, "price"), pickup: text(data.pickup, "pickup window"), status: "Pending", by: "buyer", messages: [], created: now() };
    const message = text(data.message, "message", true);
    if (message) offer.messages.push({ by: role, body: message, at: now() });
    db.offers.push(offer);
    return offer.id;
  }
  const offer = find(db.offers, data.offer, "Offer");
  requireThat(!grower || data.farm === offer.farm, "Select the farm for this offer.");
  if (action === "message") {
    offer.messages.push({ by: role, body: text(data.message, "message"), at: now() });
    return offer.id;
  }
  requireThat(offer.status === "Pending", "This offer is already closed.");
  if (action === "counter") {
    requireThat(offer.by !== role, "Wait for the other party to respond before changing terms.");
    const listing = find(db.listings, offer.listing, "Listing");
    const quantity = amount(data.quantity, "quantity");
    requireThat(quantity <= listing.quantity, "That quantity is no longer available.");
    Object.assign(offer, { price: amount(data.price, "price"), quantity, pickup: text(data.pickup, "pickup window"), by: role });
    offer.messages.push({ by: role, body: `Counteroffer: ${offer.quantity} kg at ₹${offer.price}/kg. Pickup: ${offer.pickup}.`, at: now() });
    return offer.id;
  }
  requireThat(offer.by !== role, "The other party must respond to this offer.");
  if (action === "decline") {
    offer.status = "Declined";
    return offer.id;
  }
  requireThat(action === "accept", "Unknown action.");
  const listing = find(db.listings, offer.listing, "Listing");
  requireThat(listing.open && offer.quantity <= listing.quantity, "The requested quantity is no longer available.");
  listing.quantity -= offer.quantity;
  if (!listing.quantity) listing.open = false;
  offer.status = "Accepted";
  const order = { id: id("EF"), listing: listing.id, offer: offer.id, farm: offer.farm, crop: offer.crop, quantity: offer.quantity, price: offer.price, total: Math.round(offer.price * offer.quantity * 100) / 100, pickup: offer.pickup, grade: listing.grade, harvest: listing.harvest, quality: listing.quality, status: "Accepted", payment: "Unpaid", timeline: [] };
  db.orders.push(order);
  record(db, order, "Accepted", { crop: order.crop, quantity: order.quantity, price: order.price, pickup: order.pickup });
  return order.id;
}

module.exports={seed,apply};
