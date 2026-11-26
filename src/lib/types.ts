export type Role = "buyer" | "grower";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role | "pending";
  organization: string;
  location: string;
}
export interface Farm {
  id: string;
  name: string;
  person: string;
  location: string;
  bio: string;
  image: string;
  owned?: boolean;
  sample?: boolean;
}
export interface Lot {
  id: string;
  farm: string;
  crop: string;
  category: string;
  quantity: number;
  price: number;
  grade: string;
  harvest: string;
  pickup: string;
  notes: string;
  quality: string;
  open: boolean;
  sample?: boolean;
}
export interface Message {
  by: Role;
  body: string;
  at: string;
}
export interface Offer {
  id: string;
  buyer: string;
  buyerName: string;
  buyerPerson: string;
  listing: string;
  farm: string;
  crop: string;
  quantity: number;
  price: number;
  pickup: string;
  status: string;
  by: Role;
  messages: Message[];
  created: string;
}
export interface Order {
  id: string;
  buyer?: string;
  buyerName?: string;
  buyerPerson?: string;
  listing: string;
  offer?: string;
  farm: string;
  crop: string;
  quantity: number;
  price: number;
  total: number;
  pickup: string;
  grade: string;
  harvest: string;
  quality: string;
  status: string;
  payment: string;
  timeline: { event: string; at: string }[];
}
export interface State {
  user?: User;
  farms: Farm[];
  listings: Lot[];
  offers: Offer[];
  orders: Order[];
  history: { order: string; event: string; at: string; details: unknown }[];
}
export type Action = Record<string, unknown> & { action: string };
