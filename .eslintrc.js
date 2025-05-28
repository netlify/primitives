'use strict'

module.exports = {
  rules: {
    'max-statements': 'off',
  },
  overrides: [
    {
      files: 'test/**/*.+(t|j)s',
      rules: {
        'no-magic-numbers': 'off',
        'no-undef': 'off',
        'promise/prefer-await-to-callbacks': 'off',
        'unicorn/filename-case': 'off',
        'unicorn/consistent-function-scoping': 'off',
      },
    },
  ],
}
