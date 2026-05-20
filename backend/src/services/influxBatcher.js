/**
 * =============================================================================
 * services/influxBatcher.js — BATCH WRITER POUR INFLUXDB
 * =============================================================================
 * PERFORMANCE FIX 4.1: Batch multiple MQTT messages before writing to InfluxDB
 * Réduit le nombre de requêtes DB de N/s à N/(50*5s)
 * =============================================================================
 */

const logger = require('../monitoring/logger');
const { Point } = require('@influxdata/influxdb-client');

class InfluxDBBatcher {
  constructor(writeApi, options = {}) {
    this.writeApi = writeApi;  // Pass the writeApi directly from influxService
    this.queue = [];
    this.timer = null;
    
    // Configuration
    this.batchSize = options.batchSize || 50;        // Points par batch
    this.flushInterval = options.flushInterval || 5000;  // Max 5 secondes
    this.maxRetries = options.maxRetries || 3;
    this.deadLetterQueue = [];
    
    logger.info(`[InfluxBatcher] Initialized: batchSize=${this.batchSize}, interval=${this.flushInterval}ms`);
  }

  /**
   * Ajouter un point à la queue
   * @param {Object} point - Point object {measurement, tags, fields, timestamp}
   */
  async addPoint(point) {
    if (!point) return;

    this.queue.push(point);
    
    // Si queue est pleine, flush immédiatement
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      // Sinon, schedule flush dans flushInterval ms
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Ajouter plusieurs points à la fois
   * @param {Array} points - Array de points
   */
  async addPoints(points) {
    if (!Array.isArray(points)) return;
    
    for (const point of points) {
      await this.addPoint(point);
    }
  }

  /**
   * Flush la queue: écrire tous les points en une seule requête
   */
  async flush() {
    if (this.queue.length === 0) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }

    // Prendre les points de la queue
    const pointObjs = this.queue.splice(0);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      // Convertir les points objects en Point instances pour InfluxDB
      const influxPoints = pointObjs.map(p => {
        const point = new Point(p.measurement);
        Object.entries(p.tags || {}).forEach(([key, value]) => {
          point.tag(key, String(value));
        });
        Object.entries(p.fields || {}).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) point.floatField(key, numericValue);
        });
        if (p.timestamp) point.timestamp(p.timestamp);
        return point;
      });

      // Écrire tous les points en une seule requête
      influxPoints.forEach(p => this.writeApi.writePoint(p));
      await this.writeApi.flush();
      
      logger.info(`[InfluxBatcher] Flushed ${pointObjs.length} points to InfluxDB`);
      
      // Si cette batch a du dead letter, retry
      if (this.deadLetterQueue.length > 0) {
        await this.retryDeadLetters();
      }
    } catch (err) {
      logger.error(`[InfluxBatcher] Write failed: ${err.message}`);
      
      // Ajouter à dead letter queue pour retry ultérieur
      for (const point of pointObjs) {
        this.deadLetterQueue.push({
          point,
          error: err.message,
          timestamp: Date.now(),
          retries: 0
        });
      }
      
      logger.warn(`[InfluxBatcher] Moved ${pointObjs.length} points to DLQ. DLQ size: ${this.deadLetterQueue.length}`);
    }
  }

  /**
   * Retry points en dead letter queue
   */
  async retryDeadLetters() {
    if (this.deadLetterQueue.length === 0) return;

    const dlqPoints = this.deadLetterQueue.splice(0, 50);  // Retry 50 à la fois
    const pointObjsToRetry = dlqPoints.map(x => x.point);

    try {
      // Reconvertir en Point instances
      const influxPoints = pointObjsToRetry.map(p => {
        const point = new Point(p.measurement);
        Object.entries(p.tags || {}).forEach(([key, value]) => {
          point.tag(key, String(value));
        });
        Object.entries(p.fields || {}).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) point.floatField(key, numericValue);
        });
        if (p.timestamp) point.timestamp(p.timestamp);
        return point;
      });

      influxPoints.forEach(p => this.writeApi.writePoint(p));
      await this.writeApi.flush();
      logger.info(`[InfluxBatcher] Retried ${pointObjsToRetry.length} DLQ points - success`);
    } catch (err) {
      logger.error(`[InfluxBatcher] DLQ retry failed: ${err.message}`);
      
      // Re-queue avec retry counter
      for (const dlqItem of dlqPoints) {
        if (dlqItem.retries < this.maxRetries) {
          dlqItem.retries++;
          this.deadLetterQueue.push(dlqItem);
        } else {
          logger.error(`[InfluxBatcher] Discarding point after ${this.maxRetries} retries: ${dlqItem.error}`);
        }
      }
    }
  }

  /**
   * Force flush (pour graceful shutdown)
   */
  async forceFlush() {
    logger.info('[InfluxBatcher] Force flush - writing remaining points');
    await this.flush();
    
    // Retry tout ce qui est en DLQ
    while (this.deadLetterQueue.length > 0) {
      await this.retryDeadLetters();
      // Attendre un peu avant de retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Obtenir stats
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      dlqSize: this.deadLetterQueue.length,
      dlqSummary: this.deadLetterQueue.reduce((acc, item) => {
        acc[item.error] = (acc[item.error] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = InfluxDBBatcher;
