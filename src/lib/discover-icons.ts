export type DiscoverMode="wheel"|"instant"|"budget"|"versus"|"shortlist"|"occasions"|"shared";
export const DISCOVER_ICONS:Record<DiscoverMode,{src:string|null}>={
 wheel:{src:"/discover-icons/spin-wheel.webp"},instant:{src:"/discover-icons/instant-pick.webp"},
 budget:{src:null},versus:{src:null},shortlist:{src:null},occasions:{src:null},shared:{src:null},
};
export const DISCOVER_METHODS=[
 {id:"wheel",label:"Spin the Wheel",icon:"wheel"},
 {id:"instant",label:"Instant Pick",icon:"instant"},
 {id:"budget",label:"Within budget",icon:"budget"},
 {id:"versus",label:"This or That",icon:"versus"},
 {id:"shortlist",label:"Surprise shortlist",icon:"shortlist"},
 {id:"occasions",label:"Special days",icon:"occasions"},
 {id:"shared",label:"Our wishlist",icon:"shared"},
] as const;
