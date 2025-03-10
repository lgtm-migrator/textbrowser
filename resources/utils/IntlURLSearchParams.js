/**
 *
 * @param {string} param
 * @param {boolean} skip
 * @this {IntlURLSearchParams}
 * @returns {string}
 */
function _prepareParam (param, skip) {
  if (skip || !this.localizeParamNames) { // (lang)
    return param;
  }

  // start, end, toggle
  const endNums = /\d+(-\d+)?$/; // eslint-disable-line unicorn/no-unsafe-regex
  const indexed = param.match(endNums);
  if (indexed) {
    // Todo: We could i18nize numbers as well
    return this.l10n(['params', 'indexed', param.replace(endNums, '')]) + indexed[0];
  }
  return this.l10n(['params', param]);
}

class IntlURLSearchParams {
  constructor ({l10n, params} = {}) {
    this.l10n = l10n;
    if (!params) {
      params = location.hash.slice(1);
    }
    if (typeof params === 'string') {
      params = new URLSearchParams(params);
    }
    this.params = params;
  }
  get (param, skip) {
    return this.params.get(_prepareParam.call(this, param, skip));
  }
  getAll (param, skip) {
    return this.params.getAll(_prepareParam.call(this, param, skip));
  }
  has (param, skip) {
    return this.params.has(_prepareParam.call(this, param, skip));
  }
  delete (param, skip) {
    return this.params.delete(_prepareParam.call(this, param, skip));
  }
  set (param, value, skip) {
    return this.params.set(_prepareParam.call(this, param, skip), value);
  }
  append (param, value, skip) {
    return this.params.append(_prepareParam.call(this, param, skip), value);
  }
  toString () {
    return this.params.toString();
  }
}
export default IntlURLSearchParams;
