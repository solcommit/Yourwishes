import type { CSSProperties } from "react";
import "./colourful-text.css";

// Deterministic per-character colors and staggered movement, inspired by Aceternity.
export function ColourfulText({ text }: { text: string }) {
  return <span className="colourful-text">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{Array.from(text).map((letter, index) => (
      <span className="colourful-letter" key={index}
        style={{ "--letter-index": index, "--letter-color": `var(--wordmark-${index % 5})` } as CSSProperties}>
        {letter === " " ? "\u00a0" : letter}
      </span>
    ))}</span>
  </span>;
}
