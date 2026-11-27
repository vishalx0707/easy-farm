// Crop names identify the produce. A category must never stand in for a crop photo.
const missing = {
  src: "/assets/produce-photo-placeholder.svg",
  credit: "Photo not supplied",
};
const crops = [
  {
    name: /\b(potato(?:es|s)?|aloo|aaloo)\b/i,
    src: "/assets/potatoes-still-life.webp",
    generated: true,
  },
  {
    name: /\b(tomato(?:es|s)?|tamatar)\b/i,
    src: "/assets/tomatoes-still-life.webp",
    generated: true,
  },
  {
    name: /\b(carrots?|gajar)\b/i,
    src: "/hero-footage/fresh-produce/poster-10787015.jpg",
    generated: false,
  },
  {
    name: /\b(bell peppers?|red peppers?|red capsicum)\b/i,
    src: "/hero-footage/fresh-produce/poster-5479114.jpg",
    generated: false,
  },
  {
    name: /\b(onions?|pyaz|pyaaz)\b/i,
    src: "/assets/produce/onion.webp",
    generated: true,
  },
  {
    name: /\b(brinjals?|eggplants?|aubergines?|baingan)\b/i,
    src: "/assets/produce/brinjal.webp",
    generated: true,
  },
  {
    name: /\b(okra|bhindi|lady\s*fingers?)\b/i,
    src: "/assets/produce/okra.webp",
    generated: true,
  },
  {
    name: /\b(chill?i(?:es|s)?|chill?y)\b/i,
    src: "/assets/produce/chilli.webp",
    generated: true,
  },
  {
    name: /\b(cabbages?|patta\s+gobhi)\b/i,
    src: "/assets/produce/cabbage.webp",
    generated: true,
  },
  {
    name: /\b(cauliflowers?|phool\s+gobhi)\b/i,
    src: "/assets/produce/cauliflower.webp",
    generated: true,
  },
  {
    name: /\b(cucumbers?|kheera)\b/i,
    src: "/assets/produce/cucumber.webp",
    generated: true,
  },
  {
    name: /\b(spinach|palak)\b/i,
    src: "/assets/produce/spinach.webp",
    generated: true,
  },
];
export function cropImage(crop = "") {
  const name = crop
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (/\b(sweet|spring|seedlings?|seeds?|mixed|assorted)\b/.test(name))
    return missing;
  const matches = crops.filter((c) => c.name.test(name));
  if (matches.length !== 1) return missing;
  const match = matches[0];
  if (/\bleaves\b/.test(name) && match !== crops[11]) return missing;
  if (match === crops[3] && /\b(green|yellow|orange|chill?i)\b/.test(name))
    return missing;
  if (match === crops[7] && /\b(red|dried?|yellow)\b/.test(name))
    return missing;
  if (match === crops[4] && /\b(white|yellow)\b/.test(name)) return missing;
  if (match === crops[8] && /\b(red|purple|chinese)\b/.test(name))
    return missing;
  return {
    src: match.src,
    credit: match.generated
      ? "Generated representative image"
      : "Representative produce image",
  };
}
