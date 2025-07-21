# cookie
[![tests](https://img.shields.io/github/actions/workflow/status/substrate-system/cookie/nodejs.yml?style=flat-square)](https://github.com/substrate-system/cookie/actions/workflows/nodejs.yml)
[![types](https://img.shields.io/npm/types/@substrate-system/cookie?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![install size](https://flat.badgen.net/packagephobia/install/@substrate-system/cookie?cache-control=no-cache)](https://packagephobia.com/result?p=@substrate-system/cookie)
[![license](https://img.shields.io/badge/license-Big_Time-blue?style=flat-square)](LICENSE)


Create signed cookies with an [HMAC key](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign#hmac), and verify them.

* [x] works in Cloudflare
* [x] works in Node

This will stringify a JSON object in a
[stable format](https://github.com/ahdinosaur/json-canon),
then use an [HMAC key](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey#hmac_key_generation)
to create a signature. The final cookie value includes a token that is the
signature concatenated with the JSON you passed in, all base64 encoded.

This conveniently [includes a command](#generate-a-secret-key) to
generate keys as well.

[Parsing the cookie](#parse-a-cookie) will return the cookie as a plain object,
plus a token -- the base64 encoded HMAC signature + session data.

[Parsing a session token](#parse-a-session-token) will return the object that
you passed in when creating the token, useful for embedding an ID, or any data
you want to be certain has not been changed.

Verify the signature with [`verifySessionString`](#verify-a-session-token).

<details><summary><h2>Contents</h2></summary>

<!-- toc -->

- [install](#install)
- [Example](#example)
  * [Create a cookie](#create-a-cookie)
  * [Create headers](#create-headers)
  * [Parse a cookie](#parse-a-cookie)
  * [Parse a session token](#parse-a-session-token)
  * [Verify a session token](#verify-a-session-token)
  * [Delete a cookie](#delete-a-cookie)
- [Module Format](#module-format)
  * [ESM](#esm)
  * [Common JS](#common-js)
- [Generate a secret key](#generate-a-secret-key)
- [Environment](#environment)
- [See also](#see-also)

<!-- tocstop -->

</details>

## install

```sh
npm i -S @substrate-system/cookie
```

## Example

These functions should all be run in a server.

### Set the cookie

```ts
import {
  setCookie,
  createCookie,
} from '@substrate-system/cookie'
const { SECRET_KEY } = process.env

const cookie = createCookie({ hello: 'world' }, SECRET_KEY)
// => session=vTAHUs4...; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax

// send our cookie to the client
// create a Headers instance
const headers = setCookie(cookie)

// send the cookie in the response
return new Response('hello', {
  status: 200,
  headers
})
```

### Read the cookie

In the future, the cookie gets sent back in a request.

Assuming request is a [Request object](https://developer.mozilla.org/en-US/docs/Web/API/Request),

```ts
import {
  parseCookie,
  verifySessionString,
  parseSession
} from '@substrate-system/cookie'
const { SECRET_KEY } = process.env

export default async function onRequest (request:Request) {
  const cookies = request.headers.getSetCookie()

  if (!cookies.length) {
    // no cookie, need to login
    return new Response(null, { status: 401 })
  }

  // first parse the cookie, so we can read the session data
  const parsedCookie = parseCookie(cookies[0])

  // now verify the signature
  const isOk = await verifySessionString(parsedCookie.session, SECRET_KEY)

  if (!isOk) {
    // has cookie, signature is not valid
    return new Response(null, { status: 403 })
  }

  // parse the session,
  // get the data that we encoded
  const session = parseSession(parsedCookie.session)
  // => { hello: 'world' }

  // do something with the verified data
}
```

## API

### Create a cookie
Create a string suitable for use as a cookie. Sign the given data with a secret
key, and stringify the signature + JSON data as a `base64` string.

>
> [!NOTE]  
> This will add default values for additional cookie attributes.
> ```
> session=123; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax
> ```
>

These environment variables can be used to set the cookie attributes:

```
COOKIE_HTTPONLY
COOKIE_SECURE
COOKIE_SAMESITE
COOKIE_MAX_AGE_SPAN
COOKIE_DOMAIN
COOKIE_PATH
```

```js
import { createCookie } from '@substrate-system/cookie'

const cookie = createCookie({ hello: 'world' }, SECRET_KEY)
console.log(cookie)
// => session=vTAHUs4nBS65UPy4AdnIMVdh-5MeyJoZWxsbyI6IndvcmxkIn0; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax
```

#### `createCookie (sessionData, secretKey, name?, env?)`

```ts
async function createCookie (
    sessionData:Record<string, string>,
    secretKey:string,
    name?:string,
    env?:CookieEnv,
):Promise<string>
```

### Create headers
Create or patch a `Headers` instance.

```js
import { setCookie } from '@substrate-system/cookie'

const headers = setCookie(cookie)
```

#### `setCookie(cookie, headers?:Headers)`

```ts
function setCookie (
    cookie:string,
    _headers?:Headers,
):Headers
```

### Parse a cookie
Parse a cookie string into a plain object.

```js
import { parseCookie } from '@substrate-system/cookie'

const parsed = parseCookie('session=vTAHUs4nBS65UPy4AdnIMVdh-5MeyJoZWxsbyI6IndvcmxkIn0; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax')

// =>
//   {
//      session: 'vTAHUs4nBS65UPy4AdnIMVdh-5MeyJoZWxsbyI6IndvcmxkIn0',
//      'Max-Age': '604800',
//      Path: '/',
//      HttpOnly: true,
//      Secure: true,
//      SameSite: 'Lax'
//   }
```

#### Cloudflare example
Get the cookie via request headers. An example in Cloudflare:

```js
import {
  parseCookie,
  verifySessionString
} from '@substrate-system/cookie'

export const onRequest:PagesFunction<Env> = async (ctx) => {
  const cookieHeader = ctx.request.headers.get('Cookie')

  // first get the cookie data
  const cookie = parseCookie(cookieHeader)

  // now parse and verify the token
  const { session } = cookie
  const sessionOk = verifySessionString(session, env.COOKIE_SECRET)
  if (!sessionOk) return new Response(null, { status: 403 })

  // get any data encoded in the session string
  const { id } = parseSession(session)
}
```

### Parse a session token
Parsing a cookie returns all the cookie properties as an object, one of
which is `session`. The session is arbitrary data, `base64` encoded and
signed with the secret key. Parsing the session string will return whatever
data was encoded originally.

```ts
import {
  parseSession,
  parseCookie
} from '@substrate-system/cookie'

parsed = parseCookie('session=N6bimY9...; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax')
const session = parseSession(parsed!.session)
// => { hello: 'world' }
```

### Verify a session token
Verify the given session token. This checks that an embedded signature is
correct for the associated data.

```js
import {
    verifySessionString,
    parseCookie
} from '@substrate-system/cookie'

// ... get headers somehow ...

const cookies = headers.getSetCookie()
const cookie = parseCookie(cookies[0])
const isOk = await verifySessionString(cookie.session, SECRET_KEY)
// => true
```

#### `verifySessionString(session, key)`

```ts
async function verifySessionString (
    session:string,
    key:string
):Promise<boolean>
```

### Delete a cookie
Do this serverside. Patch the given headers, removing the cookie.

```ts
function rmCookie (headers:Headers, name?:string):void
```

------------------------------------------------------------------------

## Module Format

This exposes ESM and common JS via
[package.json `exports` field](https://nodejs.org/api/packages.html#exports).

### ESM
```js
import '@substrate-system/cookie'
```

### Common JS
```js
require('@substrate-system/cookie')
```

## Generate a secret key
Session cookies are signed using [HMAC SHA256](https://en.wikipedia.org/wiki/HMAC),
which requires using a secret key of at least 32 bytes of length.

This package conveniently includes a command line tool to generate keys,
exposed as `cookiekey`. After installing this as a dependency, use it like this:

```sh
$ npx cookiekey
BGSzELbpBuESqmKyhtw/9zD7sHIy2hf/kSK0y0U0L60=
```

## Environment
Save the secret key as part of your server environment. This depends on
always using the same secret key.

This works anywhere that supports the
[Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API).
Has been verified to work in Cloudflare and Node.


## See also

* [The docs generated from typescript](https://substrate-system.github.io/cookie/)
* [Secure cookie configuration](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies)
