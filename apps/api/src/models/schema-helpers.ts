import type { CallbackWithoutResultAndOptionalError, Query, Schema } from 'mongoose';

export const enumValues = <TEnum extends Record<string, string>>(source: TEnum): string[] =>
  Object.values(source);

export const rejectMutationMiddleware = (collectionName: string) =>
  function rejectMutation(
    this: Query<unknown, unknown>,
    next: CallbackWithoutResultAndOptionalError,
  ): void {
    next(new Error(`${collectionName} records are immutable and must be appended, not updated`));
  };

export const applyImmutableQueryGuard = (schema: Schema, collectionName: string): void => {
  const rejectMutation = rejectMutationMiddleware(collectionName);

  schema.pre('updateOne', rejectMutation);
  schema.pre('updateMany', rejectMutation);
  schema.pre('findOneAndUpdate', rejectMutation);
  schema.pre('replaceOne', rejectMutation);
};
