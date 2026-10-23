export type WishCurrency = "USD" | "MNT";

export type WishlistItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: WishCurrency;
  url: string;
  priority: "Low" | "Medium" | "High";
  mediaName: string;
  image: string;
  images?: string[];
  mediaNames?: string[];
  owner: "you" | "partner";
  sample: boolean;
};

export const INITIAL_ITEMS: WishlistItem[] = [
  {
    id: "sample-1",
    name: "Everyday ceramic mug",
    description: "A considered shape for slow mornings.",
    price: 38,
    currency: "USD",
    url: "",
    priority: "Medium",
    mediaName: "",
    image: "",
    owner: "you",
    sample: true,
  },
  {
    id: "sample-2",
    name: "Linen-bound notebook",
    description: "For notes worth keeping.",
    price: 24,
    currency: "USD",
    url: "",
    priority: "Low",
    mediaName: "",
    image: "",
    owner: "you",
    sample: true,
  },
  {
    id: "sample-3",
    name: "Compact film camera",
    description: "A small reason to take the long way home.",
    price: 119,
    currency: "USD",
    url: "",
    priority: "High",
    mediaName: "",
    image: "",
    owner: "you",
    sample: true,
  },
  {
    id: "sample-4",
    name: "A quiet weekend away",
    description: "Somewhere close, with no plans.",
    price: 180,
    currency: "USD",
    url: "",
    priority: "Medium",
    mediaName: "",
    image: "",
    owner: "partner",
    sample: true,
  },
  {
    id: "sample-5",
    name: "Hardcover photo book",
    description: "A place for favorite moments.",
    price: 52,
    currency: "USD",
    url: "",
    priority: "Low",
    mediaName: "",
    image: "",
    owner: "partner",
    sample: true,
  },
];
