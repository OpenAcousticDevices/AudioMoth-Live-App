/****************************************************************************
 * .eslintrc.js
 * openacousticdevices.info
 * June 2021
 *****************************************************************************/

module.exports = {
    "extends": "standard",
    "parserOptions": {
        "ecmaVersion": "latest"
    },
    "rules": {
        "semi": [2, "always"],
        "indent": ["error", 4],
        "padded-blocks": ["error", "always"],
        "no-useless-escape": 0,
        "object-curly-spacing": ["error", "never"],
        "no-extend-native": ["error", { "exceptions": ["Array"] }],
        "standard/no-callback-literal": 0
    }
};