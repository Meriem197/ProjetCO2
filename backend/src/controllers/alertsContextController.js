/**
 * alertsContextController — mini série temporelle autour d’une alerte
 * GET /alerts/:id/context
 */
const alertsContextService = require('../services/alertsContextService');
const { successResponse } = require('../utils/apiResponse');

async function getContext(req, res, next) {
  try {
    const beforeMinutes = req.query.beforeMinutes ?? 15;
    const afterMinutes = req.query.afterMinutes ?? 15;
    const payload = await alertsContextService.getAlertContextSeries({
      alertId: Number(req.params.id),
      user: req.user,
      beforeMinutes,
      afterMinutes
    });
    return res.json(successResponse(payload));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getContext
};

