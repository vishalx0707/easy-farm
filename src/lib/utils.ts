import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const time = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
export const photo = (category = "") =>
  ({
    Peppers: "/hero-footage/fresh-produce/poster-5479114.jpg",
    "Root vegetables": "/hero-footage/fresh-produce/poster-10787015.jpg",
    Tomatoes: "/assets/tomatoes-still-life.webp",
    "Leafy greens": "/assets/posters/08-couple-harvesting-4k.jpg",
  })[category] || "/assets/posters/04-vegetable-basket-harvest-4k.jpg";
export const categories = [
  "Peppers",
  "Root vegetables",
  "Tomatoes",
  "Leafy greens",
  "Other",
];
export const steps = [
  "Accepted",
  "Packed",
  "Ready for pickup",
  "Picked up",
  "Delivered",
];
