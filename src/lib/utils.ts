import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cropImage } from "./crop-images";
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
export const photo = (crop = "") => cropImage(crop).src;
export const photoCredit = (crop = "") => cropImage(crop).credit;
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
