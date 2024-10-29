# session cookie
![tests](https://github.com/nichoth/session-cookie/actions/workflows/nodejs.yml/badge.svg)
[![types](https://img.shields.io/npm/types/@nichoth/session-cookie?style=flat-square)](README.md)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![install size](https://flat.badgen.net/packagephobia/install/@nichoth/session-cookie)](https://packagephobia.com/result?p=@nichoth/session-cookie)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)

Sign session data with a secret key.

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
  * [Environment](#environment)

<!-- tocstop -->

</details>

## install

```sh
npm i -S @nichoth/session-cookie
```

## Example
These functions should all be run in a server.

### Create a cookie
Create a string suitable for use as a cookie. Sign the given data with a secret key, and stringify the signature + JSON data as a `base64` string.

>
> [!NOTE]  
> This will add default values for additional cookie attributes -- `Max-Age=604800` (1 week), `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`.
>

These environment variables can be used to set the cookie attributes:

```
SESSION_COOKIE_HTTPONLY
SESSION_COOKIE_SECURE
SESSION_COOKIE_SAMESITE
SESSION_COOKIE_MAX_AGE_SPAN
SESSION_COOKIE_DOMAIN
SESSION_COOKIE_PATH
```

```js
import { createCookie } from '@nichoth/session-cookie'

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
import { setCookie } from '@nichoth/session-cookie'

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
import { parseCookie } from '@nichoth/session-cookie'

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

### Parse a session token
Parse a session token. This will return whatever data was used to create the token.

```js
import { parseSession } from '@nichoth/session-cookie'

const session = parseSession(parsed.session as string)
// => { hello: 'world' }
```

### Verify a session token
Verify the given session token. This checks that an embedded signature is correct for the associated data.

```js
import {
    verifySessionString,
    parseCookie
} from '@nichoth/session-cookie'

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

This exposes ESM and common JS via [package.json `exports` field](https://nodejs.org/api/packages.html#exports).

### ESM
```js
import '@nichoth/session-cookie'
```

### Common JS
```js
require('@nichoth/session-cookie')
```

## Generate a secret key
Session cookies are signed using [HMAC SHA256](https://en.wikipedia.org/wiki/HMAC), which requires using a secret key of at least 32 bytes of length.

This package conveniently includes a command line tool to generate keys, exposed as `cookiekey`. After installing this as a dependency, use it like this:

```sh
$ npx cookiekey
BGSzELbpBuESqmKyhtw/9zD7sHIy2hf/kSK0y0U0L60=
```

### Environment
Save the secret key as part of your server environment. This depends on always using the same secret key.
