import { createServer } from "node:http";
import { build } from "esbuild";

export async function wishlistBrowserServer() {
  const output = await build({
    stdin: { contents: `
      import React, { useEffect, useRef } from 'react';
      import { createRoot } from 'react-dom/client';
      import { useWishlistData } from './src/components/use-wishlist-data';
      function Harness() {
        const state = useWishlistData('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
        const renders = useRef(0); renders.current++;
        useEffect(() => { window.wishlist = state; });
        return <><output>{JSON.stringify({ items: state.items.map(i => i.name), loading: state.loading, error: state.error, renders: renders.current })}</output>
          <button onClick={() => state.refresh()}>Refresh</button>
          <button onClick={() => state.saveItem({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Fixture', photos: [] }).then(() => { document.querySelector('[data-saved]').textContent = 'saved'; })}>Save fixture</button>
          <span data-saved></span>
          <button onClick={() => state.deleteItem(state.items[0])}>Delete fixture</button></>;
      }
      createRoot(document.getElementById('root')).render(<Harness/>);
    `, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "esm",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "test-auth-client", setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: "test-auth-client", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const createClient = () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } });" }));
    } }],
  });
  const server = createServer((request, response) => {
    if (request.url === "/app.js") { response.setHeader("Content-Type", "text/javascript"); response.end(output.outputFiles[0].contents); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><div id="root"></div><script type="module" src="/app.js"></script>'); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server failed.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}
