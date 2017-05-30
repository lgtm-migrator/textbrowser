/* globals TextBrowser, Templates, IMF, formSerialize */

(() => {
TextBrowser.prototype.workDisplay = function workDisplay ({
    lang, preferredLocale, localeFromLangData, fallbackLanguages, getMetaProp, $p,
    localeFromFileData
}, l) {
    const that = this;
    const langs = this.langData.languages;

    const fallbackDirection = this.getDirectionForLanguageCode(fallbackLanguages[0]);

    const prefI18n = localStorage.getItem(this.namespace + '-localizeParamNames');
    const localizeParamNames = $p.localizeParamNames = $p.has('i18n', true)
        ? $p.get('i18n', true) === '1'
        : prefI18n === 'true' || (
            prefI18n !== 'false' && this.localizeParamNames
        );

    const prefFormatting = localStorage.getItem(this.namespace + '-hideFormattingSection');
    const hideFormattingSection = $p.has('formatting', true)
        ? $p.get('formatting', true) === '0'
        : prefFormatting === 'true' || (
            prefFormatting !== 'false' && this.hideFormattingSection
        );

    function _displayWork (l, schemaObj, metadataObj) {
        const il = localizeParamNames
            ? key => l(['params', key])
            : key => key;
        const iil = localizeParamNames
            ? key => l(['params', 'indexed', key])
            : key => key;

        const imfLang = IMF({
            locales: lang.map(localeFromLangData),
            fallbackLocales: fallbackLanguages.map(localeFromLangData)
        }); // eslint-disable-line new-cap
        const imfl = imfLang.getFormatter();

        // Returns option element with localized option text (as Jamilih), with
        //   optional fallback direction
        const le = (key, el, attToLocalize, atts, children) => {
            atts[attToLocalize] = l({
                key: key,
                fallback: ({message}) => {
                    atts.dir = fallbackDirection;
                    return message;
                }
            });
            return [el, atts, children];
        };

        // Returns plain text node or element (as Jamilih) with fallback direction
        const ld = (key, values, formats) =>
            l({
                key,
                values,
                formats,
                fallback: ({message}) =>
                    Templates.workDisplay.bdo({fallbackDirection, message})
            });

        // Todo: remember this locales choice by cookie?
        const getPreferredLanguages = (lngs) => {
            const langArr = [];
            lngs.forEach((lng) => {
                // Todo: Check for multiple separate hyphenated
                //   groupings (for each supplied language)
                const higherLocale = lng.replace(/-.*$/, '');
                if (higherLocale === lng) {
                    langArr.push(lng);
                } else {
                    langArr.push(lng, higherLocale);
                }
            });
            return langArr;
        };

        function fieldMatchesLocale (field) {
            const metaFieldInfo = metadataObj && metadataObj.fields &&
                metadataObj.fields[field];
            let metaLang;
            if (metaFieldInfo) {
                metaLang = metadataObj.fields[field].lang;
            }
            const localeStrings = metadataObj &&
                metadataObj['localization-strings'];

            // If this is a localized field (e.g., enum), we don't want
            //  to avoid as may be translated (should check though)
            const hasFieldValue = localeStrings &&
                Object.keys(localeStrings).some(lng => {
                    const fv = localeStrings[lng] &&
                        localeStrings[lng].fieldvalue;
                    return fv && fv[field];
                });

            // Todo: Add to this optionally with one-off tag input box
            // Todo: Switch to fallbackLanguages so can default to
            //    navigator.languages?
            const langCodes = localStorage.getItem(that.namespace + '-langCodes');
            const preferredLanguages = getPreferredLanguages(
                (langCodes && JSON.parse(langCodes)) || [preferredLocale]
            );
            return hasFieldValue ||
                (metaLang && preferredLanguages.includes(metaLang)) ||
                schemaItems.some(item =>
                    item.title === field && item.type !== 'string'
                );
        }

        const schemaItems = schemaObj.items.items;
        const content = [];

        function serializeParamsAsURL ({form, random, checkboxes}, type) {
            const paramsCopy = new URLSearchParams($p.params);
            const formParamsHash = formSerialize(form, {hash: true});

            Object.keys(formParamsHash).forEach((key) => {
                paramsCopy.set(key, formParamsHash[key]);
            });

            // Follow the same style (and order) for checkboxes
            paramsCopy.delete(il('rand'));
            paramsCopy.set(il('rand'), random.checked ? l('yes') : l('no'));

            // We want checkboxes to typically show by default, so we cannot use the
            //    standard serialization
            checkboxes.forEach((checkbox) => {
                // Let's ensure the checked items are all together (at the end)
                paramsCopy.delete(checkbox.name);
                paramsCopy.set(checkbox.name, checkbox.checked ? l('yes') : l('no'));
            });

            switch (type) {
            case 'saveSettings': {
                // In case it was added previously on
                //    this page, let's remove it.
                paramsCopy.delete(il('random'));
                break;
            }
            case 'result': {
                // In case it was added previously on this page,
                //    let's put random again toward the end.
                paramsCopy.delete(il('random'));
                paramsCopy.set(il('random'), l('yes'));
                paramsCopy.set(il('result'), l('yes'));
                break;
            }
            }
            return window.location.href.replace(/#.*$/, '') + '#' + paramsCopy.toString();
        }
        function getFieldAliasOrName (field) {
            const fieldObj = metadataObj.fields && metadataObj.fields[field];
            let fieldName;
            let fieldAlias;
            if (fieldObj) {
                fieldAlias = fieldObj.alias;
            }
            if (fieldAlias) {
                if (typeof fieldAlias === 'string') {
                    fieldName = fieldAlias;
                } else {
                    fieldAlias = fieldAlias.localeKey;
                    fieldName = getMetaProp(metadataObj, fieldAlias.split('/'));
                }
            } else { // No alias
                fieldName = fieldObj.name;
                if (typeof fieldName === 'object') {
                    fieldName = fieldName.localeKey;
                    fieldName = getMetaProp(metadataObj, fieldName.split('/'));
                }
            }
            return fieldName;
        }

        metadataObj.table.browse_fields.forEach((browseFieldObject, i) => {
            if (typeof browseFieldObject === 'string') {
                browseFieldObject = {set: [browseFieldObject]};
            }

            const fieldSets = browseFieldObject.set;
            // Todo: Deal with ['td', [['h3', [ld(browseFieldObject.name)]]]] as kind of fieldset

            const browseFields = fieldSets.map((browseField, j) => {
                const fieldSchema = schemaItems.find((item) =>
                    item.title === browseField
                );

                const ret = {
                    browseFieldName: getFieldAliasOrName(browseField)
                };

                let fvAliases = metadataObj.fields && metadataObj.fields[browseField] &&
                    metadataObj.fields[browseField]['fieldvalue-aliases'];
                if (fvAliases) {
                    if (fvAliases.localeKey) {
                        fvAliases = getMetaProp(metadataObj, fvAliases.localeKey.split('/'), true);
                    }
                    ret.aliases = [];
                    // Todo: We could use `prefer_alias` but algorithm below may cover needed cases
                    if (fieldSchema.enum && fieldSchema.enum.length) {
                        fieldSchema.enum.forEach((enm) => {
                            ret.aliases.push(
                                getMetaProp(metadataObj, ['fieldvalue', browseField, enm], true)
                            );
                            if (enm in fvAliases &&
                                // Todo: We could allow numbers here too, but crowds pull-down
                                typeof fvAliases[enm] === 'string') {
                                ret.aliases.push(...fvAliases[enm]);
                            }
                        });
                    } else {
                        // Todo: We might iterate over all values (in case some not included in fv map)
                        // Todo: Check `fieldSchema` for integer or string type
                        Object.entries(fvAliases).forEach(([key, aliases]) => {
                            // We'll preserve the numbers since probably more useful if stored
                            //   with data (as opposed to enums)
                            if (!Array.isArray(aliases)) {
                                aliases = Object.values(aliases);
                            }
                            // We'll assume the longest version is best for auto-complete
                            ret.aliases.push(
                                ...(
                                    aliases.filter((v) =>
                                        aliases.every((x) =>
                                            x === v || !(x.toLowerCase().startsWith(v.toLowerCase()))
                                        )
                                    ).map((v) => v + ' (' + key + ')')
                                )
                            );
                        });
                    }
                    // ret.aliases.sort();
                }

                return ret;
            });

            Templates.workDisplay.addBrowseFields({browseFields, ld, i, iil, $p, content});
        });

        Templates.workDisplay.addRandomFormFields({
            il, l, ld, le, $p, serializeParamsAsURL, content
        });

        const fields = schemaItems.map((schemaItem) => schemaItem.title);

        // const arabicContent = ['test1', 'test2']; // Todo: Fetch dynamically
        const heading = getMetaProp(metadataObj, 'heading');
        Templates.workDisplay.main({
            /* eslint-disable object-property-newline */
            l, namespace: that.namespace, heading,
            imfl, fallbackDirection,
            langs, fields, localizeParamNames,
            serializeParamsAsURL, hideFormattingSection, $p,
            getMetaProp, metadataObj, il, le, ld, iil,
            getPreferredLanguages, fieldMatchesLocale,
            getFieldAliasOrName, preferredLocale, schemaItems, content
            /* eslint-enable object-property-newline */
        });
    }

    this.getWorkData({lang, localeFromFileData, fallbackLanguages, $p}).then((
        [fileData, lf, schemaObj, metadataObj, pluginKeys, pluginObjects]
    ) => {
        // console.log('pluginKeys', pluginKeys);
        // console.log('pluginObjects', pluginObjects);
        if (pluginObjects) {
            // console.log('aaap', pluginObjects[0].insertField());
            /*
            "plugins": {
                "synopsis": "plugins/synopsis.js"
            },
            */
        }
        document.title = lf({
            key: 'browserfile-workdisplay',
            values: {
                work: fileData
                    ? getMetaProp(metadataObj, 'alias')
                    : ''
            },
            fallback: true
        });
        _displayWork(l, schemaObj, metadataObj);
    }).catch((err) => {
        alert(err);
    });
};
})();
