"use client";
import type {WishlistItem} from "@/lib/wishlist/types";
import {formatWishPrice} from "@/lib/format-price";
import {Button} from "./ui/button";
import "./wheel-wish-selector.css";

export function WheelWishSelector({items,selected,onChange,disabled,action="spin"}:{
  items:WishlistItem[];selected:Set<string> | null;onChange:(selected:Set<string>)=>void;disabled:boolean;action?:"spin" | "pick";
}) {
  const selectedCount=items.filter(item=>selected === null || selected.has(item.id)).length;
  return <details className="wheel-selection">
    <summary><span>Choose wishes</span><span className="wheel-selection-count">{selectedCount} / {items.length}</span></summary>
    <fieldset disabled={disabled}>
      <legend className="sr-only">Wishes included in this {action}</legend>
      <p>Select the wishes you would consider getting.</p>
      <div className="wheel-selection-actions">
        <Button size="small" variant="secondary" disabled={disabled || selectedCount===items.length} onClick={()=>onChange(new Set(items.map(item=>item.id)))}>Select all</Button>
        <Button size="small" variant="secondary" disabled={disabled || selectedCount===0} onClick={()=>onChange(new Set())}>Clear</Button>
      </div>
      <div className="wheel-selection-list">{items.map(item=><label key={item.id} className="wheel-selection-row">
        <input type="checkbox" checked={selected === null || selected.has(item.id)} onChange={event=>{const next=new Set(selected ?? items.map(item=>item.id));if(event.target.checked)next.add(item.id);else next.delete(item.id);onChange(next);}} />
        <span>{item.name}</span>
        {typeof item.price === "number" && <small>{formatWishPrice(item.price,item.currency)}</small>}
      </label>)}</div>
    </fieldset>
    <p className="wheel-selection-status" role="status">{selectedCount ? `${selectedCount} wishes in this ${action}` : `Select at least one wish to ${action}.`}</p>
  </details>;
}
