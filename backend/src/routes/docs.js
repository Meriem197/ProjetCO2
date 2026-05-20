/**
 * =============================================================================
 * docs.js — EXPOSITION DE LA SPECIFICATION OPENAPI (CONTRAT API)
 * =============================================================================
 * Permet a un outil externe (Swagger UI, Postman, client genere) d'importer openapi.json
 * sans avoir besoin du code source. La route /docs renvoie un texte d'aide minimal.
 * =============================================================================
 */

const express = require('express');
const { openApiSpec } = require('../docs/openapi');

const router = express.Router();

// Spec OpenAPI 3.x au format JSON (machine-readable).
router.get('/openapi.json', (req, res) => {
  return res.json(openApiSpec);
});

// Aide humaine : URL a copier-coller dans Swagger Editor ou Postman "Import from URL".
router.get('/docs', (req, res) => {
  return res.type('text/plain').send(
    `API documentation available as OpenAPI JSON:
GET /openapi.json

Recommended tools:
- Swagger Editor: https://editor.swagger.io
- Postman import: use the /openapi.json URL
`
  );
});

module.exports = router;
