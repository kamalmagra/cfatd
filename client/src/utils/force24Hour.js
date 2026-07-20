// Forces all frontend Date/Intl time rendering to use 24-hour format.
// Imported once from main.jsx.
const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
const originalToLocaleString = Date.prototype.toLocaleString;
const OriginalDateTimeFormat = Intl.DateTimeFormat;

const forceOptions = (options = {}) => ({
  ...options,
  hour12: false,
});

Date.prototype.toLocaleTimeString = function (locales = "en-GB", options = {}) {
  return originalToLocaleTimeString.call(this, locales || "en-GB", forceOptions(options));
};

Date.prototype.toLocaleString = function (locales = "en-GB", options = {}) {
  return originalToLocaleString.call(this, locales || "en-GB", forceOptions(options));
};

Intl.DateTimeFormat = function (locales = "en-GB", options = {}) {
  return new OriginalDateTimeFormat(locales || "en-GB", forceOptions(options));
};
Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);