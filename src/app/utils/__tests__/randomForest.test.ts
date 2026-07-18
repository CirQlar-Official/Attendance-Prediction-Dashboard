import { describe, it, expect } from 'vitest';
import { trainRandomForest, predictForest, featureImportances } from '../randomForest';

// Simple deterministic dataset: attendance rises with a single feature.
function makeDataset(n: number) {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    X.push([i, i % 4, 0]);
    y.push(100 + i * 2);
  }
  return { X, y };
}

describe('trainRandomForest / predictForest determinism', () => {
  it('produces identical predictions across repeated training runs with the same seed', () => {
    const { X, y } = makeDataset(30);

    const forestA = trainRandomForest(X, y);
    const forestB = trainRandomForest(X, y);

    const resultA = predictForest(forestA, [30, 2, 0]);
    const resultB = predictForest(forestB, [30, 2, 0]);

    expect(resultA.prediction).toBe(resultB.prediction);
    expect(resultA.std).toBe(resultB.std);
    expect(resultA.treePredictions).toEqual(resultB.treePredictions);
  });

  it('produces different forests for different seeds', () => {
    const { X, y } = makeDataset(30);

    const forestA = trainRandomForest(X, y, 80, 7, 2, 1);
    const forestB = trainRandomForest(X, y, 80, 7, 2, 2);

    const resultA = predictForest(forestA, [30, 2, 0]);
    const resultB = predictForest(forestB, [30, 2, 0]);

    // Not a strict guarantee for any dataset, but true for this one -
    // guards against someone hard-coding the seed away entirely.
    expect(forestA).not.toEqual(forestB);
    void resultA;
    void resultB;
  });

  it('returns an empty forest for empty input', () => {
    const forest = trainRandomForest([], []);
    expect(forest).toEqual([]);
  });

  it('predicts a reasonable value within the training target range', () => {
    const { X, y } = makeDataset(50);
    const forest = trainRandomForest(X, y);
    const result = predictForest(forest, [25, 1, 0]);

    expect(result.prediction).toBeGreaterThanOrEqual(Math.min(...y) - 5);
    expect(result.prediction).toBeLessThanOrEqual(Math.max(...y) + 5);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });
});

describe('featureImportances', () => {
  it('returns one entry per feature name with a percentage-style importance', () => {
    const { X, y } = makeDataset(30);
    const forest = trainRandomForest(X, y);
    const names = ['A', 'B', 'C'];
    const importances = featureImportances(forest, names.length, names);

    expect(importances).toHaveLength(3);
    importances.forEach(imp => {
      expect(names).toContain(imp.name);
      expect(imp.importance).toBeGreaterThanOrEqual(0);
    });
  });

  it('returns zero importance for every feature on an empty forest', () => {
    const names = ['A', 'B'];
    const importances = featureImportances([], names.length, names);
    importances.forEach(imp => expect(imp.importance).toBe(0));
  });
});
