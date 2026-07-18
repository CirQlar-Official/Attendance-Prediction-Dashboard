// ─── Random Forest Regressor (Pure TypeScript) ──────────────────────────────

import { RANDOM_FOREST_CONFIG, CONFIDENCE_THRESHOLDS } from '../../config';

export interface TreeNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export type Forest = TreeNode[];

// ── Helpers ──────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function mse(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

/** Mulberry32 seeded PRNG for reproducibility */
function makePrng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffledIndices(n: number, rng: () => number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function bootstrapIndices(n: number, rng: () => number): number[] {
  return Array.from({ length: n }, () => Math.floor(rng() * n));
}

// ── Tree building ─────────────────────────────────────────────────────────────

function bestSplit(
  X: number[][],
  y: number[],
  featureSubset: number[]
): { fi: number; thresh: number; gain: number } | null {
  const n = y.length;
  const parentMse = mse(y);
  let bestFi = -1;
  let bestThresh = 0;
  let bestGain = 0;

  for (const fi of featureSubset) {
    // collect unique sorted values for this feature
    const vals = [...new Set(X.map(x => x[fi]))].sort((a, b) => a - b);

    for (let k = 0; k < vals.length - 1; k++) {
      const thresh = (vals[k] + vals[k + 1]) / 2;
      const leftY: number[] = [];
      const rightY: number[] = [];
      for (let i = 0; i < n; i++) {
        (X[i][fi] <= thresh ? leftY : rightY).push(y[i]);
      }
      if (leftY.length === 0 || rightY.length === 0) continue;
      const gain =
        parentMse -
        (leftY.length / n) * mse(leftY) -
        (rightY.length / n) * mse(rightY);
      if (gain > bestGain) {
        bestGain = gain;
        bestFi = fi;
        bestThresh = thresh;
      }
    }
  }

  if (bestFi === -1) return null;
  return { fi: bestFi, thresh: bestThresh, gain: bestGain };
}

function buildTree(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  minLeaf: number,
  nFeatures: number,
  rng: () => number
): TreeNode {
  const leafVal = mean(y);

  if (depth >= maxDepth || y.length <= minLeaf) {
    return { isLeaf: true, value: leafVal };
  }

  const fSubset = shuffledIndices(X[0].length, rng).slice(0, nFeatures);
  const split = bestSplit(X, y, fSubset);

  if (!split || split.gain <= 0) {
    return { isLeaf: true, value: leafVal };
  }

  const { fi, thresh } = split;
  const lIdx: number[] = [];
  const rIdx: number[] = [];
  for (let i = 0; i < y.length; i++) {
    (X[i][fi] <= thresh ? lIdx : rIdx).push(i);
  }

  if (lIdx.length === 0 || rIdx.length === 0) {
    return { isLeaf: true, value: leafVal };
  }

  return {
    isLeaf: false,
    featureIndex: fi,
    threshold: thresh,
    left: buildTree(
      lIdx.map(i => X[i]),
      lIdx.map(i => y[i]),
      depth + 1,
      maxDepth,
      minLeaf,
      nFeatures,
      rng
    ),
    right: buildTree(
      rIdx.map(i => X[i]),
      rIdx.map(i => y[i]),
      depth + 1,
      maxDepth,
      minLeaf,
      nFeatures,
      rng
    ),
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.isLeaf) return node.value!;
  return x[node.featureIndex!] <= node.threshold!
    ? predictTree(node.left!, x)
    : predictTree(node.right!, x);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RFResult {
  prediction: number;
  std: number;
  treePredictions: number[];
  confidence: 'high' | 'medium' | 'low';
}

export function trainRandomForest(
  X: number[][],
  y: number[],
  nTrees: number = RANDOM_FOREST_CONFIG.trees,
  maxDepth: number = RANDOM_FOREST_CONFIG.maxDepth,
  minLeaf: number = RANDOM_FOREST_CONFIG.minLeafSize,
  seed: number = RANDOM_FOREST_CONFIG.seed
): Forest {
  if (X.length === 0) return [];

  const rng = makePrng(seed);
  const nFeatures = Math.max(2, Math.round(Math.sqrt(X[0].length)));
  const forest: Forest = [];

  for (let t = 0; t < nTrees; t++) {
    const idx = bootstrapIndices(X.length, rng);
    const bX = idx.map(i => X[i]);
    const bY = idx.map(i => y[i]);
    forest.push(buildTree(bX, bY, 0, maxDepth, minLeaf, nFeatures, rng));
  }

  return forest;
}

export function predictForest(forest: Forest, x: number[]): RFResult {
  const treePredictions = forest.map(t => predictTree(t, x));
  const pred = mean(treePredictions);
  const variance =
    treePredictions.reduce((s, p) => s + (p - pred) ** 2, 0) /
    treePredictions.length;
  const std = Math.sqrt(variance);

  let confidence: 'high' | 'medium' | 'low';
  if (std < CONFIDENCE_THRESHOLDS.high) confidence = 'high';
  else if (std < CONFIDENCE_THRESHOLDS.medium) confidence = 'medium';
  else confidence = 'low';

  return {
    prediction: Math.round(pred),
    std: Math.round(std * 10) / 10,
    treePredictions,
    confidence,
  };
}

/**
 * Approximate feature importances by counting split usage weighted by
 * number of samples at each node (mean decrease impurity proxy).
 */
export function featureImportances(
  forest: Forest,
  nFeatures: number,
  featureNames: string[]
): { name: string; importance: number }[] {
  const counts = new Array(nFeatures).fill(0);

  function traverse(node: TreeNode, depth: number) {
    if (node.isLeaf) return;
    // weight splits at shallower depth more heavily
    counts[node.featureIndex!] += 1 / (depth + 1);
    traverse(node.left!, depth + 1);
    traverse(node.right!, depth + 1);
  }

  for (const tree of forest) traverse(tree, 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return featureNames.map((name, i) => ({
    name,
    importance: Math.round((counts[i] / total) * 1000) / 10,
  }));
}
