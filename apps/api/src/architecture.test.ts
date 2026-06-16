import { describe, expect, it } from 'vitest';

import { apiLayers, serviceBoundaries } from './architecture';

describe('api architecture boundaries', () => {
  it('declares the expected clean architecture layers', () => {
    expect(apiLayers).toEqual([
      'config',
      'controllers',
      'services',
      'repositories',
      'models',
      'middleware',
      'validators',
      'routes',
      'integrations',
    ]);
  });

  it('prevents controllers from depending directly on mongoose models', () => {
    const controllerBoundary = serviceBoundaries.find(
      (boundary) => boundary.layer === 'controllers',
    );

    expect(controllerBoundary?.mustNotDependOn).toContain('models');
  });
});
