/* globals __dirname, Ajv:true, getJSON:true, path:true, Promise, module, require */
/* exported textbrowserTests */
var JsonRefs, Ajv, getJSON, __dirname, path; // eslint-disable-line no-var

(function () {
/* eslint-disable indent */
'use strict';

let appBase = '../';

if (typeof exports !== 'undefined') {
    Ajv = require('ajv');
    JsonRefs = require('json-refs');
    getJSON = require('simple-get-json');
    path = require('path');
} else {
    path = {
        join: (...args) => args.join('')
    };
    appBase = location.protocol + '//' + location.host + '/';
    __dirname = ''; // eslint-disable-line no-global-assign
}

const schemaBase = appBase + 'general-schemas/';
const localesBase = appBase + 'locales/';
const appdataBase = appBase + 'appdata/';

/**
* @param {object} schema Schema object
* @param {any} data Data object
* @param {string} testName Name of the current test
* @returns {boolean} Whether validation succeeded
*/
function validate (testName, schema, data, extraSchemas = []) {
    const ajv = new Ajv({extendRefs: 'fail'});
    let valid;
    try {
        extraSchemas.forEach(([key, val]) => {
            ajv.addSchema(val, key);
        });
        valid = ajv.validate(schema, data);
    } catch (e) {
        console.log('(' + testName + ') ' + e); // eslint-disable-line no-console
    } finally {
        if (!valid) { console.log(JSON.stringify(ajv.errors, null, 2)); } // eslint-disable-line no-console
    }
    return valid;
}

const textbrowserTests = {
    'locales tests': function (test) {
        test.expect(4); // eslint-disable-line no-magic-numbers
        Promise.all(
            [
                'locale.jsonschema',
                'en-US.json',
                'ar.json',
                'fa.json',
                'ru.json'
            ].map((file, i) => getJSON(
                path.join(__dirname, i ? localesBase : schemaBase, file)
            ))
        ).then(function ([schema, ...locales]) {
            locales.forEach(function (locale) {
                const valid = validate('locales tests', schema, locale);
                test.strictEqual(valid, true);
            });
            test.done();
        });
    },
    'languages.json test': function (test) {
        test.expect(1); // eslint-disable-line no-magic-numbers
        Promise.all([
            JsonRefs.resolveRefsAt(path.join(__dirname, appdataBase, 'languages.json')),
            getJSON(path.join(__dirname, schemaBase, 'languages.jsonschema')),
            getJSON(path.join(__dirname, schemaBase, 'locale.jsonschema'))
        ]).then(function ([{resolved: data}, schema, extraSchema]) {
            const valid = validate('languages.json test', schema, data, [['locale.jsonschema', extraSchema]]);
            test.strictEqual(valid, true);
            test.done();
        });
    }
};

if (typeof exports !== 'undefined') {
    module.exports = textbrowserTests;
} else {
    window.textbrowserTests = textbrowserTests;
}
/* eslint-enable indent */
}());
