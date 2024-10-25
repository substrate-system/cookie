import { test } from '@bicycle-codes/tapzero'
import {
    createCookie,
    createSession,
    verifySessionString,
    setCookie,
    parseCookie,
    parseSession
} from '../src/index.js'

const SECRET_KEY = '/pQCobVcOc+ru0WVTx24+MlCL7fIAPcPTsgGqXvV8M0='

let session:string
test('create a session', async t => {
    session = createSession({ hello: 'world' }, SECRET_KEY)
    t.equal(typeof session, 'string', 'should return a new session string')
})

test('verify the session string', t => {
    const ok = verifySessionString(session, SECRET_KEY)
    t.ok(ok, 'should verify a valid token')
})

test('verify an invalid session', t => {
    const badToken = 'abc' + session
    const ok = verifySessionString(badToken, SECRET_KEY)
    t.ok(!ok, 'should not verify an invalid token')
})

let cookie
test('create a cookie', t => {
    cookie = createCookie({ hello: 'world' }, SECRET_KEY)
    console.log('**cookie**', cookie)
    t.equal(typeof cookie, 'string', 'should return a string')
    t.ok(cookie.includes('session='), 'should include the default session name')
})

let headers:Headers
test('Create some headers', t => {
    headers = setCookie(cookie)
    t.ok(headers instanceof Headers, 'should return a new Headers object')

    const headers2 = new Headers()
    const headers3 = setCookie(cookie, headers2)
    t.equal(headers2, headers3, 'should patch a given Headers instance')
})

test('Cookie in the headers', t => {
    const cookies = headers.getSetCookie()
    t.equal(typeof cookies[0], 'string', 'cookie should be serialized')
    const cookieFromHeaders = cookies[0]
    t.equal(cookieFromHeaders, cookie, 'should put the string in the headers')
})

let parsed:Record<string, string|boolean>
test('parse a cookie', t => {
    parsed = parseCookie('session=vTAHUs4nBS65UPy4AdnIMVdh-5MeyJoZWxsbyI6IndvcmxkIn0; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax')
    t.deepEqual(parsed, {
        session: 'vTAHUs4nBS65UPy4AdnIMVdh-5MeyJoZWxsbyI6IndvcmxkIn0',
        'Max-Age': '604800',
        Path: '/',
        HttpOnly: true,
        Secure: true,
        SameSite: 'Lax'
    }, 'should parse the cookie string')

    t.ok(verifySessionString(parsed.session as string, SECRET_KEY),
        'should verify the session token')
})

test('parse the session string', t => {
    t.ok(verifySessionString(parsed.session as string, SECRET_KEY),
        'should be a valid session')
    const session = parseSession(parsed.session as string)
    t.deepEqual(session, {
        hello: 'world'
    }, 'should parse to the same data we passed in')
})
