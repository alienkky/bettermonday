const { validationResult } = require('express-validator');

// Run validation rules and return 422 on failure
const validate = (rules) => async (req, res, next) => {
  for (const rule of rules) await rule.run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(422).json({ error: first.msg, field: first.path });
  }
  next();
};

module.exports = { validate };
