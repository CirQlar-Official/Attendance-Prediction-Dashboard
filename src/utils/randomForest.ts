/**
 * Random Forest Regressor Implementation
 * Trains and predicts attendance based on historical data
 * Automatically improves as new entries are added
 */

export interface RFResult {
  prediction: number;
  std: number;
  treePredictions: number[];
  confidence: 'high' | 'medium' | 'low';
}

export type Forest = DecisionTree[];

interface DecisionTree {
  nodeId: string;
  feature?: number;
  threshold?: number;
  left?: DecisionTree;
  right?: DecisionTree;
  value?: number; // leaf node prediction
}

interface Sample {
  features: number[];
  target: number;
}

const NUM_TREES = 50;
const MAX_DEPTH = 15;
const MIN_SAMPLES_LEAF = 2;
const SAMPLE_RATIO = 0.8;

/**
 * Bootstrap sampling: randomly sample from data with replacement
 */
function bootstrap(
  X: number[][],
  y: number[],
  ratio: number = SAMPLE_RATIO
): Sample[] {
  const n = Math.floor(X.length * ratio);
  const samples: Sample[] = [];

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * X.length);
    samples.push({
      features: X[idx],
      target: y[idx],
    });
  }

  return samples;
}

/**
 * Calculate mean squared error for a split
 */
function calculateMSE(targets: number[]): number {
  if (targets.length === 0) return 0;
  const mean = targets.reduce((a, b) => a + b, 0) / targets.length;
  const variance = targets.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / targets.length;
  return variance;
}

/**
 * Find the best split for a feature
 */
function findBestSplit(
  samples: Sample[],
  feature: number,
  _maxDepth: number,
  _currentDepth: number
): { threshold: number; gain: number } | null {
  const values = samples.map(s => s.features[feature]).sort((a, b) => a - b);
  const uniqueValues = [...new Set(values)];

  if (uniqueValues.length < 2) return null;

  let bestThreshold = 0;
  let bestGain = 0;

  const parentMSE = calculateMSE(samples.map(s => s.target));

  // Test potential split points
  for (let i = 0; i < uniqueValues.length - 1; i++) {
    const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

    const left = samples.filter(s => s.features[feature] <= threshold);
    const right = samples.filter(s => s.features[feature] > threshold);

    if (left.length === 0 || right.length === 0) continue;

    const leftMSE = calculateMSE(left.map(s => s.target));
    const rightMSE = calculateMSE(right.map(s => s.target));

    const gain =
      parentMSE -
      (left.length / samples.length) * leftMSE -
      (right.length / samples.length) * rightMSE;

    if (gain > bestGain) {
      bestGain = gain;
      bestThreshold = threshold;
    }
  }

  return bestGain > 0 ? { threshold: bestThreshold, gain: bestGain } : null;
}

/**
 * Recursively build a decision tree
 */
function buildTree(
  samples: Sample[],
  numFeatures: number,
  maxDepth: number,
  currentDepth: number = 0
): DecisionTree {
  const nodeId = Math.random().toString(36).substr(2, 9);

  // Stopping criteria
  if (
    samples.length < MIN_SAMPLES_LEAF ||
    currentDepth >= maxDepth ||
    samples.length === 0
  ) {
    const mean = samples.length > 0 ? samples.reduce((s, e) => s + e.target, 0) / samples.length : 0;
    return {
      nodeId,
      value: mean,
    };
  }

  // Check if all targets are the same (no split needed)
  const allSame = samples.every(s => s.target === samples[0].target);
  if (allSame) {
    return {
      nodeId,
      value: samples[0].target,
    };
  }

  // Find best feature and threshold to split on
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestGain = 0;

  for (let feature = 0; feature < numFeatures; feature++) {
    const split = findBestSplit(samples, feature, maxDepth, currentDepth);
    if (split && split.gain > bestGain) {
      bestGain = split.gain;
      bestThreshold = split.threshold;
      bestFeature = feature;
    }
  }

  // If no good split found, return leaf
  if (bestFeature === -1) {
    const mean = samples.reduce((s, e) => s + e.target, 0) / samples.length;
    return {
      nodeId,
      value: mean,
    };
  }

  // Recursively build left and right subtrees
  const left = samples.filter(s => s.features[bestFeature] <= bestThreshold);
  const right = samples.filter(s => s.features[bestFeature] > bestThreshold);

  return {
    nodeId,
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildTree(left, numFeatures, maxDepth, currentDepth + 1),
    right: buildTree(right, numFeatures, maxDepth, currentDepth + 1),
  };
}

/**
 * Make a prediction using a single decision tree
 */
function predictTree(tree: DecisionTree, features: number[]): number {
  if (tree.value !== undefined) {
    return tree.value;
  }

  if (tree.feature === undefined || tree.threshold === undefined) {
    return tree.value ?? 0;
  }

  if (features[tree.feature] <= tree.threshold) {
    return tree.left ? predictTree(tree.left, features) : tree.value ?? 0;
  } else {
    return tree.right ? predictTree(tree.right, features) : tree.value ?? 0;
  }
}

/**
 * Calculate feature importance based on tree decisions
 */
function calculateFeatureImportance(
  tree: DecisionTree,
  importance: number[],
  weight: number = 1.0
): void {
  if (tree.feature === undefined || tree.value !== undefined) {
    return;
  }

  importance[tree.feature] += weight;

  if (tree.left) {
    calculateFeatureImportance(tree.left, importance, weight * 0.5);
  }
  if (tree.right) {
    calculateFeatureImportance(tree.right, importance, weight * 0.5);
  }
}

/**
 * Train a Random Forest model
 */
export function trainRandomForest(X: number[][], y: number[]): Forest {
  if (X.length === 0 || X[0].length === 0) return [];

  const numFeatures = X[0].length;
  const forest: DecisionTree[] = [];

  for (let t = 0; t < NUM_TREES; t++) {
    const bootstrapSamples = bootstrap(X, y, SAMPLE_RATIO);
    const tree = buildTree(bootstrapSamples, numFeatures, MAX_DEPTH);
    forest.push(tree);
  }

  return forest;
}

/**
 * Make predictions using the trained forest
 */
export function predictForest(forest: Forest, features: number[]): RFResult {
  if (forest.length === 0) {
    return {
      prediction: 0,
      std: 0,
      treePredictions: [],
      confidence: 'low',
    };
  }

  const treePredictions = forest.map(tree => predictTree(tree, features));
  const prediction =
    treePredictions.reduce((a, b) => a + b, 0) / treePredictions.length;

  // Calculate standard deviation for confidence
  const variance =
    treePredictions.reduce((sum, pred) => sum + Math.pow(pred - prediction, 2), 0) /
    treePredictions.length;
  const std = Math.sqrt(variance);

  // Determine confidence based on agreement between trees
  const disagreement = std / (prediction || 1);
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (disagreement < 0.05) {
    confidence = 'high';
  } else if (disagreement < 0.15) {
    confidence = 'medium';
  }

  return {
    prediction: Math.max(0, Math.round(prediction * 100) / 100),
    std: Math.round(std * 100) / 100,
    treePredictions,
    confidence,
  };
}

/**
 * Calculate feature importances across all trees
 */
export function featureImportances(
  forest: Forest,
  numFeatures: number,
  featureNames: string[]
): { name: string; importance: number }[] {
  const importance = new Array(numFeatures).fill(0);

  forest.forEach(tree => {
    calculateFeatureImportance(tree, importance);
  });

  // Normalize to sum to 1
  const total = importance.reduce((a, b) => a + b, 0);
  const normalized = importance.map(imp => (total > 0 ? imp / total : 0));

  return featureNames.map((name, idx) => ({
    name,
    importance: Math.round(normalized[idx] * 10000) / 100,
  }));
}
