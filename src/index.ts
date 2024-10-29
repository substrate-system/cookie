import { webcrypto } from '@bicycle-codes/one-webcrypto'
import stringify from 'json-canon'
import { fromString, toString } from 'uint8arrays'
import {
    type CookieEnv,
    getCookieOptions,
    timeSafeCompare as compare,
    serializeCookie
} from './util.js'
export { serializeCookie }

/**
 * Name to be used for the session cookie if none provided.
 */
export const SESSION_COOKIE_NAME_DEFAULT = 'session'

/**
 * Length of the signature digest, in characters.
 * Used to separate signature from data in the raw session cookie.
 */
const SIGNATURE_DIGEST_LENGTH = 43

/**
 * Patch the given headers instance, removing the cookie.
 *
 * @param {Headers} headers The headers to patch
 * @param {string} [name] Optional name of the cookie. Default is `session`.
 * @returns {void}
 */
export function rmCookie (headers:Headers, name?:string):void {
    const key = name || SESSION_COOKIE_NAME_DEFAULT
    const cookie = headers.getSetCookie()[0]
    const del = `${key}=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    if (cookie) {
        headers.set('Set-Cookie', del)
    }
}

/**
 * Parse the given cookie string into an object of key - values.
 *
 * @param {string} cookie The cookie string
 * @param {(s:string)=>string} [_decode] Optional decode function
 * @returns {Record<string, string>}
 */
export function parseCookie (
    cookie:string,
    _decode?:(s:string)=>string
):(Record<string, string|boolean> & { session:string }) {
    const dec = _decode || decode
    const parsed = cookie.split(';').map(str => {
        const split = str.trim().split('=')
        return split
    }).reduce<Record<string, string> & { session:string }>((acc, val) => {
        acc[val[0]] = tryDecode(val[1], dec) ?? true
        return acc
    }, { session: '' })

    return parsed
}

/**
 * Try decoding a string using a decoding function. Doesn't throw; returns
 * the input on error.
 *
 * @param {string} str
 * @param {function} decode
 * @returns {string}
 * @private
 */
function tryDecode (str:string, decode:(s:string)=>string):string {
    try {
        return decode(str)
    } catch (_err) {
        return str
    }
}

/**
 * Patch or create a Headers object.
 */
export function setCookie (
    cookie:string,
    _headers?:Headers,
):Headers {
    const headers = _headers || new Headers()
    headers.set('Set-Cookie', cookie)

    return headers
}

/**
 * Create a cookie and return it as a string.
 *
 * @param sessionData Data to encode with the cookie
 * @param secretKey The secret key
 * @param name The name for the cookie; defaults to `session`
 * @returns {string} The cookie as string
 */
export async function createCookie (
    sessionData:Record<string, string>,
    secretKey:string,
    name?:string,
    env?:CookieEnv,
):Promise<string> {
    const session = await createSession(sessionData, secretKey)
    const newCookie = serializeCookie(
        name || SESSION_COOKIE_NAME_DEFAULT,
        session,
        getCookieOptions(env)
    )

    return newCookie
}

/**
 * Create a new session token.
 *
 * @param newSessionData Any object of data to include in this session token.
 * @param {string} [secretKey] Optional secret key to use. Will get it from
 * environment variables if it is not passed in.
 * @returns {string} Signature + JSON session data encoded as base64
 */
export async function createSession (
    newSessionData:Record<string, string>,
    secretKey:string
):Promise<string> {
    const key = secretKey
    const sessionAsJSON:string = stringify(newSessionData)

    const arrFromString = fromString(sessionAsJSON, 'utf-8')
    const base64Json = toString(arrFromString, 'base64')
    const sig = await sign(sessionAsJSON, key)
    // sig + base64SessionValue
    const session = sig + base64Json

    return session
}

/**
 * Given an encoded signature + data string, return if the signature is
 * valid for the data.
 * @param {string} session The encoded session cookie
 * @returns {boolean}
 */
export async function verifySessionString (
    session:string,
    key:string
):Promise<boolean> {
    const signature = session.substring(
        0,
        SIGNATURE_DIGEST_LENGTH
    )

    try {
        let data:string = session.substring(SIGNATURE_DIGEST_LENGTH)
        const arr = fromString(data, 'base64')
        data = toString(arr, 'utf-8')

        return await verify(key, data, signature)
    } catch (_err) {
        return false
    }
}

/**
 * Compare a given signature to a new signature created with the given data.
 *
 * @param {string} key The key
 * @param {Buffer|string} data The data to sign
 * @param {string} signature The signature to check
 * @returns {boolean} True or false, if the signature is valid or not
 */
async function verify (
    key:string,
    data:Uint8Array|string,
    signature:string
):Promise<boolean> {
    return await compare(signature, await sign(
        typeof data === 'string' ? fromString(data) : data,
        key
    ))
}

/**
 * Sign the given data and return the signature as a string.
 *
 * @returns {string}
 */
export async function sign (data:string|Uint8Array, key:string, opts?:Partial<{
    algorithm:'sha-256'|'sha-512';
}>):Promise<string> {
    const algorithm = opts?.algorithm || 'sha-256'

    // this gets called with `sessionDataAsJSON` for data param,
    // so if string, it is not base64 encoded

    const signingKey = await webcrypto.subtle.importKey(
        'raw',
        fromString(key, 'base64'),
        { name: 'HMAC', hash: algorithm },
        false,
        ['sign', 'verify']
    )

    const sig = await webcrypto.subtle.sign(
        'HMAC',
        signingKey,
        typeof data === 'string' ? fromString(data) : data
    )
    const sigString = toString(new Uint8Array(sig), 'base64')

    const str = sigString.replace(/\/|\+|=/g, (x) => {
        return ({ '/': '_', '+': '-', '=': '' })[x] as string
    })

    return str
}

/**
 * This depends on the signature being a specific length.
 *
 * The cookie is serialized like `signature + base64(JSON.stringify(data))`
 */
export function parseSession<T=Record<string, string|boolean>> (
    encodedSession:string
):T {
    const data:string = encodedSession.substring(SIGNATURE_DIGEST_LENGTH)
    const asBuf = fromString(data, 'base64')
    const asString = toString(asBuf, 'utf-8')
    // const buf = Buffer.from(data, 'base64')
    // const str = buf.toString('utf-8')
    return JSON.parse(asString)
    // return JSON.parse(str)
}

/**
 * URL-decode string value. Optimized to skip native call when no %.
 *
 * @param {string} str
 * @returns {string}
 */
function decode (str:string):string {
    return str.indexOf('%') !== -1 ?
        decodeURIComponent(str) :
        str
}
