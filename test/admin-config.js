const assert = require("assert");
const config = require("../admin/jsonConfig.json");
const adapter = require("../io-package.json");

assert.strictEqual(adapter.common.adminUI.config, "json");
assert.strictEqual(config.type, "panel");
assert.strictEqual(config.i18n, true);

const fields = Object.entries(config.items).filter(([key]) => !key.startsWith("_"));
assert.deepStrictEqual(fields.map(([key]) => key).sort(), Object.keys(adapter.native).sort());

for (const [key, field] of fields) {
    const expectedType = key === "password" ? "password" : typeof adapter.native[key] === "number" ? "number" : "text";
    assert.strictEqual(field.type, expectedType, key);
    for (const language of ["de", "en"]) {
        const translations = require(`../admin/i18n/${language}/translations.json`);
        assert.ok(translations[field.label], `${language}: ${key}`);
    }
}
