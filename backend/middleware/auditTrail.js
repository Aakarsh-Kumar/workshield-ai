const { sanitizeForAudit, writeAuditLog } = require('../services/auditLogService');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizePath = (req) => `${req.baseUrl || ''}${req.route?.path || req.path || ''}`;

const getResourceType = (path) => {
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'api' && segments[1]) return segments[1];
  return segments[0] || 'unknown';
};

const buildAction = (method, path) => {
  const normalized = path.replace(/[:/{}-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${method}_${normalized}`.toUpperCase();
};

const auditMutationRequests = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const startedAt = Date.now();
  const path = normalizePath(req);

  res.on('finish', () => {
    const actorUserId = req.user?.id || req.user?._id || null;

    writeAuditLog({
      actorUserId,
      actorRole: req.user?.role || 'anonymous',
      action: buildAction(req.method, path),
      resourceType: getResourceType(path),
      resourceId: req.params?.id || req.body?.policyId || req.body?.claimId || null,
      method: req.method,
      path,
      statusCode: res.statusCode,
      success: res.statusCode < 400,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.get('x-request-id') || undefined,
      latencyMs: Date.now() - startedAt,
      metadata: {
        query: sanitizeForAudit(req.query || {}),
        params: sanitizeForAudit(req.params || {}),
        body: sanitizeForAudit(req.body || {}),
      },
    });
  });

  return next();
};

module.exports = {
  auditMutationRequests,
};
