function isTruthy(value) {
  return String(value).toLowerCase() === 'true';
}

function validateEnv() {
  const errors = [];
  const warnings = [];

  if (!process.env.INFLUX_URL) warnings.push('INFLUX_URL absent (defaut http://localhost:8086)');
  if (!process.env.INFLUX_TOKEN) warnings.push('INFLUX_TOKEN absent');
  if (!process.env.INFLUX_ORG) warnings.push('INFLUX_ORG absent');
  if (!process.env.INFLUX_BUCKET) warnings.push('INFLUX_BUCKET absent (defaut iot_co2)');

  if (process.env.MYSQL_ENABLED !== undefined && !['true', 'false'].includes(String(process.env.MYSQL_ENABLED).toLowerCase())) {
    errors.push('MYSQL_ENABLED doit etre true ou false');
  }
  if (process.env.MYSQL_REQUIRED !== undefined && !['true', 'false'].includes(String(process.env.MYSQL_REQUIRED).toLowerCase())) {
    errors.push('MYSQL_REQUIRED doit etre true ou false');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-me')) {
    const msg = 'JWT_SECRET faible/non personalise';
    if (process.env.NODE_ENV === 'production') errors.push(msg);
    else warnings.push(msg);
  }

  if (process.env.RATE_LIMIT_MAX !== undefined && !Number.isFinite(Number(process.env.RATE_LIMIT_MAX))) {
    errors.push('RATE_LIMIT_MAX doit etre numerique');
  }
  if (process.env.AUTH_RATE_LIMIT_MAX !== undefined && !Number.isFinite(Number(process.env.AUTH_RATE_LIMIT_MAX))) {
    errors.push('AUTH_RATE_LIMIT_MAX doit etre numerique');
  }

  if (process.env.NODE_ENV === 'production' && !isTruthy(process.env.MYSQL_REQUIRED ?? 'true')) {
    warnings.push('NODE_ENV=production avec MYSQL_REQUIRED=false: metadata SQL potentiellement indisponible');
  }

  return { errors, warnings };
}

module.exports = {
  validateEnv
};
