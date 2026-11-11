import "./circle-loader.css";

export function CircleLoader({ label = "Loading wishes…" }: { label?: string }) {
  return <div className="circle-loader" role="status"><span aria-hidden="true" className="circle-loader-ring" /><span className="sr-only">{label}</span></div>;
}
