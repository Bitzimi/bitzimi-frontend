import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

if (!s.includes("animationElapsedMs")) {
  s = s.replace(
    'const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);',
    'const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);\n  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);\n  const [animationDurationMs, setAnimationDurationMs] = useState(8000);'
  );
}

s = s.replace(
  '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />',
  '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} animationElapsedMs={animationElapsedMs} animationDurationMs={animationDurationMs} />'
);
s = s.replace(
  '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={false} />',
  '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={false} animationElapsedMs={animationDurationMs} animationDurationMs={animationDurationMs} />'
);

fs.writeFileSync(path, s);
console.log("Applied authoritative Coin Flip animation state wiring.");
