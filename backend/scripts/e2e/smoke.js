#!/usr/bin/env node
require('dotenv').config();

const mqtt = require('mqtt');
const mysql = require('mysql2/promise');

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:4000';
const MQTT_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_TOPIC = process.env.E2E_MQTT_TOPIC || 'sensors/co2';
const SENSOR_ID = process.env.E2E_SENSOR_ID || 'SENSOR-TN-TUN-01';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`health status ${res.status}`);
  const json = await res.json();
  console.log('[E2E] health OK', json?.data?.status || json?.status);
}

async function publishMqttMessage() {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined
    });

    client.on('connect', () => {
      const payload = JSON.stringify({
        sensorId: SENSOR_ID,
        co2: 912.4,
        temp: 24.2,
        hum: 45.6,
        timestamp: new Date().toISOString()
      });
      client.publish(MQTT_TOPIC, payload, { qos: 1 }, (err) => {
        client.end(true);
        if (err) reject(err);
        else resolve();
      });
    });

    client.on('error', (err) => {
      client.end(true);
      reject(err);
    });
  });
}

async function verifyMysqlInsert() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'co2_industrial_db'
  });

  try {
    const [rows] = await conn.execute(
      `
      SELECT id, sensor_uid, co2_ppm, received_at
      FROM sensor_readings
      WHERE sensor_uid = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [SENSOR_ID]
    );
    if (!rows.length) throw new Error('Aucune ligne MySQL sensor_readings trouvée');
    console.log('[E2E] MySQL insert OK', rows[0]);
  } finally {
    await conn.end();
  }
}

async function loginAndFetchHistory() {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    console.warn('[E2E] skip API auth/history: E2E_USER_EMAIL/E2E_USER_PASSWORD non définis');
    return;
  }

  const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!loginRes.ok) throw new Error(`login status ${loginRes.status}`);
  const loginJson = await loginRes.json();
  const token = loginJson?.data?.token;
  if (!token) throw new Error('Token absent après login');

  const historyRes = await fetch(
    `${API_BASE}/api/v1/co2/history?sensorId=${encodeURIComponent(SENSOR_ID)}&start=-24h`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!historyRes.ok) throw new Error(`history status ${historyRes.status}`);
  const historyJson = await historyRes.json();
  const points = historyJson?.data || [];
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('Historique API vide');
  }
  console.log('[E2E] API history OK', { count: points.length });
}

async function main() {
  console.log('[E2E] Start smoke test');
  await checkHealth();
  await publishMqttMessage();
  console.log('[E2E] MQTT publish OK');
  await sleep(2500);
  await verifyMysqlInsert();
  await loginAndFetchHistory();
  console.log('[E2E] SUCCESS end-to-end');
}

main().catch((err) => {
  console.error('[E2E] FAILED:', err.message);
  process.exit(1);
});
