import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes('const [animationElapsedMs, setAnimationElapsedMs]')) {
  s = s.replace(
    'const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);',
    'const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);\n  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);\n  const [animationDurationMs, setAnimationDurationMs] = useState(8000);'
  );
}

// Keep the existing coin component markup/design unchanged. The elapsed/duration
// values remain backend-derived state used by the flow clock and recovery logic.
fs.writeFileSync(path, s);
console.log("Applied authoritative Coin Flip animation state wiring.");
