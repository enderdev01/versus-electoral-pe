# 3D flag scene

`src/components/VersusFlag3D.tsx` renders a React Three Fiber `Canvas`. A search of `src/` finds no import of it: no route reaches it, so it cannot be captured or driven today.

Verification is manual: import it in a scratch page, load that page, and look for the flag drawn and animating. Do not add a debug route to the app unasked. If the scene should be covered, propose a route such as `/debug/flag` and a `--wait 2000` screenshot, and let the human decide. A headless capture may come out blank where WebGL is unavailable.
