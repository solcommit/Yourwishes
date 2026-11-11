"use client";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function WishProductActions({ url }: { url: string }) {
  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success("Product link copied"); }
    catch { toast.error("Could not copy link", { description: "Check clipboard permissions and try again." }); }
  }
  return <><a className="app-button app-button-primary" href={url} rel="noopener noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={17} />View product</a><Button variant="secondary" onClick={() => void copy()}><Copy aria-hidden="true" size={17} />Copy link</Button></>;
}
