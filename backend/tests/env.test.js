const { validateEnv } = require('../src/config/env');

describe('validateEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('signale JWT secret par defaut en dev (warning)', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'change-me-in-production-use-long-random-string';

    const report = validateEnv();
    expect(report.errors).toHaveLength(0);
    expect(report.warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
  });

  test('bloque JWT secret faible en production (error)', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me';

    const report = validateEnv();
    expect(report.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  test('valide booleens MYSQL_ENABLED/MYSQL_REQUIRED', () => {
    process.env.MYSQL_ENABLED = 'yes';
    process.env.MYSQL_REQUIRED = 'no';

    const report = validateEnv();
    expect(report.errors.some((e) => e.includes('MYSQL_ENABLED'))).toBe(true);
    expect(report.errors.some((e) => e.includes('MYSQL_REQUIRED'))).toBe(true);
  });
});
