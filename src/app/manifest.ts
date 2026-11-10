import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest {
  return {
    id:"/",name:"Yourwishes",short_name:"Yourwishes",description:"A private wishlist for two.",
    start_url:"/",scope:"/",display:"standalone",background_color:"#0b0b11",theme_color:"#0b0b11",
    icons:[
      {src:"/app-icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/app-icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
      {src:"/app-icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
    ],
  };
}
