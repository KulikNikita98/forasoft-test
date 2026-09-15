import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Автоматическая очистка после каждого теста
afterEach(() => {
  cleanup();
});
