/**
 * Global storage context — manages active IStorageProvider instance.
 */

import { IStorageProvider } from './storageProvider';

let currentProvider: IStorageProvider | null = null;

export class StorageContext {
  static setProvider(provider: IStorageProvider): void {
    currentProvider = provider;
  }

  static getProvider(): IStorageProvider {
    if (!currentProvider) {
      throw new Error('StorageProvider not initialized. Call StorageContext.setProvider() first.');
    }
    return currentProvider;
  }

  static hasProvider(): boolean {
    return currentProvider !== null;
  }

  static clearProvider(): void {
    currentProvider = null;
  }
}
