export const apiLayers = [
  'config',
  'controllers',
  'services',
  'repositories',
  'models',
  'middleware',
  'validators',
  'routes',
  'integrations',
] as const;

export type ApiLayer = (typeof apiLayers)[number];

export interface ServiceBoundary {
  readonly layer: ApiLayer;
  readonly owns: string;
  readonly mustNotDependOn: readonly ApiLayer[];
}

export const serviceBoundaries: readonly ServiceBoundary[] = [
  {
    layer: 'controllers',
    owns: 'HTTP request and response adaptation',
    mustNotDependOn: ['models'],
  },
  {
    layer: 'services',
    owns: 'Business use cases and authorization-sensitive workflow decisions',
    mustNotDependOn: ['routes'],
  },
  {
    layer: 'repositories',
    owns: 'Persistence access and query construction',
    mustNotDependOn: ['controllers', 'routes'],
  },
  {
    layer: 'middleware',
    owns: 'Cross-cutting HTTP concerns such as auth, validation, security, and audit context',
    mustNotDependOn: ['models'],
  },
] as const;
