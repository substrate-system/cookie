'use strict'
import crypto from 'node:crypto'

/**
 * Default for the "Max-Age" attribute of the session cookie.
 */
const SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT = (60 * 60 * 24 * 7)  // 1 week

// Implements Brad Hill's Double HMAC pattern from
// https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2011/february/double-hmac-verification/.
// The approach is similar to the node's native implementation of timing safe buffer comparison that will be available on v6+.
// https://github.com/nodejs/node/issues/3043
// https://github.com/nodejs/node/pull/3073

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/

function bufferEqual (a, b) {
    if (a.length !== b.length) {
        return false
    }

    // `crypto.timingSafeEqual` was introduced in Node v6.6.0
    // <https://github.com/jshttp/basic-auth/issues/39>
    if (crypto.timingSafeEqual) {
        return crypto.timingSafeEqual(a, b)
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}

export function timeSafeCompare (a, b) {
    const sa = String(a)
    const sb = String(b)
    const key = crypto.randomBytes(32)
    const ah = crypto.createHmac('sha256', key).update(sa).digest()
    const bh = crypto.createHmac('sha256', key).update(sb).digest()

    return bufferEqual(ah, bh) && a === b
}

export default timeSafeCompare

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [opts]
 * @return {string}
 */
export function serializeCookie (name:string, val:string, opts?:Partial<{
    encode:(string)=>string;
    maxAge;
    domain;
    path;
    expires;
    httpOnly:boolean;
    secure;
    partitioned;
    priority;
    sameSite;
}>):string {
    const enc = opts?.encode || encode

    if (typeof enc !== 'function') {
        throw new TypeError('option encode is invalid')
    }

    if (!fieldContentRegExp.test(name)) {
        throw new TypeError('argument name is invalid')
    }

    const value = enc(val)

    if (value && !fieldContentRegExp.test(value)) {
        throw new TypeError('argument val is invalid')
    }

    let cookie = name + '=' + value

    if (opts?.maxAge != null) {
        const maxAge = opts?.maxAge - 0

        if (isNaN(maxAge) || !isFinite(maxAge)) {
            throw new TypeError('option maxAge is invalid')
        }

        cookie += '; Max-Age=' + Math.floor(maxAge)
    }

    if (opts?.domain) {
        if (!fieldContentRegExp.test(opts?.domain)) {
            throw new TypeError('option domain is invalid')
        }

        cookie += '; Domain=' + opts?.domain
    }

    if (opts?.path) {
        if (!fieldContentRegExp.test(opts?.path)) {
            throw new TypeError('option path is invalid')
        }

        cookie += '; Path=' + opts?.path
    }

    if (opts?.expires) {
        const expires = opts?.expires

        if (!isDate(expires) || isNaN(expires.valueOf())) {
            throw new TypeError('option expires is invalid')
        }

        cookie += '; Expires=' + expires.toUTCString()
    }

    if (opts?.httpOnly) {
        cookie += '; HttpOnly'
    }

    if (opts?.secure) {
        cookie += '; Secure'
    }

    if (opts?.partitioned) {
        cookie += '; Partitioned'
    }

    if (opts?.priority) {
        const priority = typeof opts?.priority === 'string'
            ? opts?.priority.toLowerCase()
            : opts?.priority

        switch (priority) {
            case 'low':
                cookie += '; Priority=Low'
                break
            case 'medium':
                cookie += '; Priority=Medium'
                break
            case 'high':
                cookie += '; Priority=High'
                break
            default:
                throw new TypeError('option priority is invalid')
        }
    }

    if (opts?.sameSite) {
        const sameSite = typeof opts?.sameSite === 'string' ?
            opts?.sameSite.toLowerCase() :
            opts?.sameSite

        switch (sameSite) {
            case true:
                cookie += '; SameSite=Strict'
                break
            case 'lax':
                cookie += '; SameSite=Lax'
                break
            case 'strict':
                cookie += '; SameSite=Strict'
                break
            case 'none':
                cookie += '; SameSite=None'
                break
            default:
                throw new TypeError('option sameSite is invalid')
        }
    }

    return cookie
}

/**
 * URL-encode value.
 *
 * @param {string} val
 * @returns {string}
 */

function encode (val:string):string {
    return encodeURIComponent(val)
}

const __toString = Object.prototype.toString

/**
 * Determine if value is a Date.
 *
 * @param {*} val
 */
function isDate (val:any):boolean {
    return __toString.call(val) === '[object Date]' ||
      val instanceof Date
}

export type CookieEnv = Partial<{
    SESSION_COOKIE_HTTPONLY:string;
    SESSION_COOKIE_SECURE:string;
    SESSION_COOKIE_SAMESITE:string;
    SESSION_COOKIE_MAX_AGE_SPAN:string;
    SESSION_COOKIE_DOMAIN:string;
    SESSION_COOKIE_PATH:string;
}>

/**
 * Builds an option object to be used by the cookie serializer.
 * All options have defaults which can be edited using environment variables.
 *
 * Environment variables available:
 * - `env.SESSION_COOKIE_HTTPONLY`:
 *   Specifies if the cookie should have the `HttpOnly` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SECURE`:
 *   Specifies if the cookie should have the `Secure` attribute.
 *   Set to "0" to remove this attribute from the cookie definition.
 * - `env.SESSION_COOKIE_SAMESITE`:
 *   Will specify the value for the `SameSite` attribute for the cookie.
 *   Can be "Strict", "None" or "Lax" (default).
 * - `env.SESSION_COOKIE_MAX_AGE_SPAN`:
 *   Specifies, in second, how long the cookie should be valid for.
 *   Defaults to 7 days.
 * - `env.SESSION_COOKIE_DOMAIN`:
 *   If set, will specify a value for the `Domain` attribute for the cookie.
 * - `env.SESSION_COOKIE_PATH`:
 *   If set, will specify a value for the `Path` attribute for the cookie.
 *   Defaults to `/`.
 *
 * @returns {object} - Options object for `cookie.serialize`
 * @private
 */
export function getCookieOptions (env:CookieEnv = {}) {
    // Defaults (options detail: https://github.com/jshttp/cookie#options-1)
    const options:Partial<{
        httpOnly,
        secure,
        sameSite,
        maxAge,
        path,
        domain
    }> = {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE_SPAN_DEFAULT,
        path: '/'
    }

    //
    // Use environment variables to edit defaults.
    //
    const {
        SESSION_COOKIE_HTTPONLY,
        SESSION_COOKIE_SECURE,
        SESSION_COOKIE_SAMESITE,
        SESSION_COOKIE_MAX_AGE_SPAN,
        SESSION_COOKIE_DOMAIN,
        SESSION_COOKIE_PATH
    } = env

    // HttpOnly
    if (SESSION_COOKIE_HTTPONLY === '0') {
        delete options.httpOnly
    }

    // Secure
    if (SESSION_COOKIE_SECURE === '0') {
        delete options.secure
    }

    // SameSite
    if (['Strict', 'Lax', 'None'].includes(SESSION_COOKIE_SAMESITE!)) {
        options.sameSite = SESSION_COOKIE_SAMESITE!.toLowerCase()
    }

    // Max-Age
    if (!isNaN(parseInt(SESSION_COOKIE_MAX_AGE_SPAN!))) {
        options.maxAge = parseInt(SESSION_COOKIE_MAX_AGE_SPAN!)
    }

    // Domain
    if (SESSION_COOKIE_DOMAIN) {
        options.domain = SESSION_COOKIE_DOMAIN
    }

    // Path
    if (SESSION_COOKIE_PATH) {
        options.path = SESSION_COOKIE_PATH
    }

    return options
}
