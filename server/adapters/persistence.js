import {readStore, writeStore} from '../store.js';

/**
 * Option A adapter boundary.
 *
 * Current implementation: local JSON file persistence for locations/actions/observations.
 * Future swap-in: DynamoDB table adapter with the same method signatures.
 */
export function createPersistenceAdapter(fileResolver) {
  return {
    read: () => readStore(fileResolver()),
    write: (data) => writeStore(fileResolver(), data)
  };
}
