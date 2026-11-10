import { priorityLabel } from "@/lib/wish-copy";

export const PRIORITY_OPTIONS = [
  { value: "Common", label: priorityLabel.Common, description: "1 · Заавал авах шаардлагагүй", tone: "common" },
  { value: "Uncommon", label: priorityLabel.Uncommon, description: "2 · Боломж гарвал авна", tone: "uncommon" },
  { value: "Rare", label: priorityLabel.Rare, description: "3 · Авах бодит хэрэгцээтэй", tone: "rare" },
  { value: "Epic", label: priorityLabel.Epic, description: "4 · Ойрын хугацаанд авах хэрэгтэй", tone: "epic" },
  { value: "Legendary", label: priorityLabel.Legendary, description: "5 · Хамгийн түрүүнд авах шаардлагатай", tone: "legendary" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD · $", description: "Ам.доллар" },
  { value: "MNT", label: "MNT · ₮", description: "Төгрөг" },
  { value: "CNY", label: "CNY · ¥", description: "Хятад юань" },
] as const;
