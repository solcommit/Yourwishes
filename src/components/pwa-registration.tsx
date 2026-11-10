"use client";
import {useEffect} from "react";
export function PwaRegistration(){
  useEffect(()=>{
    if(process.env.NODE_ENV!=="production"||!window.isSecureContext||!("serviceWorker" in navigator))return;
    const register=()=>{void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{console.warn("Yourwishes offline fallback could not register. Online use is still available.");});};
    if(document.readyState==="complete")register();else window.addEventListener("load",register,{once:true});
    return()=>window.removeEventListener("load",register);
  },[]);
  return null;
}
