const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'backendPFE API',
    version: '2.0.0',
    description:
      'Industrial IoT SaaS API (multi-tenant): JWT auth, RBAC, sites, sensors, alerts, CO2 analytics.'
  },
  servers: [
    {
      url: 'http://localhost:4000/api/v1',
      description: 'Local'
    }
  ],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'CO2' },
    { name: 'Analytics' },
    { name: 'Alerts' },
    { name: 'Sites' },
    { name: 'Sensors' }
  ],
  paths: {
    '/status': {
      get: {
        tags: ['System'],
        summary: 'API status',
        responses: { 200: { description: 'OK' } }
      }
    },
    '/co2/history': {
      get: {
        tags: ['CO2'],
        summary: 'Sensor CO2 history from InfluxDB',
        parameters: [
          { name: 'sensorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'start', in: 'query', schema: { type: 'string', default: '-24h' } }
        ],
        responses: { 200: { description: 'OK' }, 400: { description: 'Invalid params' } }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register user and bootstrap first company membership (ADMIN)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                  companyName: { type: 'string' },
                  tenantKey: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'token + user + memberships' }, 409: { description: 'Conflict' } }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive tenant-scoped JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  companyId: { type: 'integer', description: 'Optional active tenant selection' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'token + memberships' }, 401: { description: 'Unauthorized' } }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current authenticated user (from JWT)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } }
      }
    },
    '/co2/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'CO2 aggregated stats over a time range',
        parameters: [
          { name: 'sensorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'start', in: 'query', schema: { type: 'string', default: '-24h' } }
        ],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/co2/classify': {
      get: {
        tags: ['Analytics'],
        summary: 'Classify CO2 quality by value or last sensor point',
        parameters: [
          { name: 'value', in: 'query', schema: { type: 'number' } },
          { name: 'sensorId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/co2/predict': {
      get: {
        tags: ['Analytics'],
        summary: 'Linear prediction prototype',
        parameters: [
          { name: 'sensorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'horizonMinutes', in: 'query', schema: { type: 'integer', default: 30 } }
        ],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/alerts': {
      get: {
        tags: ['Alerts'],
        summary: 'List alerts for active company',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } },
          { name: 'sensorId', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } }
      }
    },
    '/alerts/{id}': {
      patch: {
        tags: ['Alerts'],
        summary: 'Update alert status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'OK' } }
      }
    },
    '/sites': {
      get: {
        tags: ['Sites'],
        summary: 'List sites for active company',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] } }
        ],
        responses: { 200: { description: 'OK' } }
      },
      post: {
        tags: ['Sites'],
        summary: 'Create site in active company',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  siteCode: { type: 'string' },
                  countryCode: { type: 'string' },
                  city: { type: 'string' },
                  addressLine1: { type: 'string' },
                  addressLine2: { type: 'string' },
                  postalCode: { type: 'string' },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Created' } }
      }
    },
    '/sites/{id}': {
      get: {
        tags: ['Sites'],
        summary: 'Get site details (including hierarchy)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } }
      },
      put: {
        tags: ['Sites'],
        summary: 'Update site',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } }
      },
      delete: {
        tags: ['Sites'],
        summary: 'Delete site',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/sensors': {
      get: {
        tags: ['Sensors'],
        summary: 'List sensors for active company',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'siteId', in: 'query', schema: { type: 'integer' } },
          { name: 'sensorUid', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'FAULTY', 'MAINTENANCE'] } }
        ],
        responses: { 200: { description: 'OK' } }
      },
      post: {
        tags: ['Sensors'],
        summary: 'Create sensor (requires edgeDeviceId or siteId)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sensorUid'],
                properties: {
                  sensorUid: { type: 'string' },
                  edgeDeviceId: { type: 'integer' },
                  siteId: { type: 'integer' },
                  name: { type: 'string' },
                  sensorType: { type: 'string', enum: ['CO2', 'TEMPERATURE', 'HUMIDITY', 'MULTI'] },
                  unitDefault: { type: 'string' },
                  samplingIntervalMs: { type: 'integer' },
                  calibrationOffset: { type: 'number' },
                  calibrationScale: { type: 'number' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'FAULTY', 'MAINTENANCE'] }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Created' } }
      }
    },
    '/sensors/link': {
      post: {
        tags: ['Sensors'],
        summary: 'Link MQTT sensor UID to a site (auto line/device provisioning)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mqttSensorId', 'siteId'],
                properties: {
                  mqttSensorId: { type: 'string' },
                  siteId: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Linked' } }
      }
    },
    '/sensors/{id}': {
      get: {
        tags: ['Sensors'],
        summary: 'Get sensor details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } }
      },
      put: {
        tags: ['Sensors'],
        summary: 'Update sensor',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } }
      },
      delete: {
        tags: ['Sensors'],
        summary: 'Delete sensor',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Authorization: Bearer <token>; optional tenant override header: X-Company-Id'
      }
    }
  }
};

module.exports = {
  openApiSpec
};
