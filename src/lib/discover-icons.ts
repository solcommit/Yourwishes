export const DISCOVER_ICONS: Record<"wheel" | "instant", {src:string | null}> = {
  wheel:{src:"/discover-icons/spin-wheel.webp"}, instant:{src:"/discover-icons/instant-pick.webp"},
};
export const DISCOVER_METHODS = [
  {id:"wheel",label:"Spin the Wheel",icon:"wheel"},
  {id:"instant",label:"Instant Pick",icon:"instant"},
] as const;
