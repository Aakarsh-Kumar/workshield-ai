const { validationResult } = require('express-validator');

const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const normalizedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    return res.status(422).json({
      success: false,
      message: normalizedErrors[0]?.message || 'Validation failed',
      errors: normalizedErrors,
    });
  },
];

module.exports = { validate };
