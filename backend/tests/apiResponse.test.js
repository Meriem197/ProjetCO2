/**
 * =============================================================================
 * tests/apiResponse.test.js — TESTS UNITAIRES (JEST) SUR LE FORMAT DES REPONSES
 * =============================================================================
 * Verifie que successResponse et errorResponse produisent exactement la forme attendue
 * par le frontend (cles success, data, meta, error.code, etc.).
 * Lancer : npm test
 * =============================================================================
 */

const { successResponse, errorResponse } = require('../src/utils/apiResponse');

describe('apiResponse', () => {
  test('successResponse inclut data et meta optionnelle', () => {
    expect(successResponse({ a: 1 })).toEqual({
      success: true,
      data: { a: 1 }
    });
    expect(successResponse({ a: 1 }, { page: 1 })).toEqual({
      success: true,
      data: { a: 1 },
      meta: { page: 1 }
    });
  });

  test('errorResponse normalise code et message', () => {
    expect(errorResponse('msg', 'CODE')).toEqual({
      success: false,
      error: { code: 'CODE', message: 'msg' }
    });
  });
});
