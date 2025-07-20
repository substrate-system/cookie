import { test } from '@substrate-system/tapzero'
import {
    createCookie,
    createSession,
    verifySessionString,
    setCookie,
    rmCookie,
    parseCookie,
    parseSession
} from '../src/index.js'

const SECRET_KEY = '/pQCobVcOc+ru0WVTx24+MlCL7fIAPcPTsgGqXvV8M0='

let session:string
test('create a session', async t => {
    session = await createSession({ hello: 'world' }, SECRET_KEY)
    t.equal(typeof session, 'string', 'should return a new session string')
})

test('verify the session string', async t => {
    const ok = await verifySessionString(session, SECRET_KEY)
    t.ok(ok, 'should verify a valid token')
})

test('verify an invalid session', async t => {
    const badToken = 'abc' + session
    const ok = await verifySessionString(badToken, SECRET_KEY)
    t.ok(!ok, 'should not verify an invalid token')
})

let cookie
test('create a cookie', async t => {
    cookie = await createCookie({ hello: 'world' }, SECRET_KEY)
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
    t.ok(parseCookie(headers2.getSetCookie()[0])!.session,
        'should patch the headers we passsed in')
})

test('Cookie in the headers', t => {
    const cookies = headers.getSetCookie()
    t.equal(typeof cookies[0], 'string', 'cookie should be serialized')
    const cookieFromHeaders = cookies[0]
    t.equal(cookieFromHeaders, cookie, 'should put the string in the headers')
})

let parsed:ReturnType<typeof parseCookie>
test('parse a cookie', async t => {
    t.plan(2)
    parsed = parseCookie('session=N6bimY9qCPv7HdQ8NX1w6gUpuCU4tNawWwY0EvL3smAeyJoZWxsbyI6IndvcmxkIn0; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax')

    t.deepEqual(parsed, {
        session: 'N6bimY9qCPv7HdQ8NX1w6gUpuCU4tNawWwY0EvL3smAeyJoZWxsbyI6IndvcmxkIn0',
        'Max-Age': '604800',
        Path: '/',
        HttpOnly: true,
        Secure: true,
        SameSite: 'Lax'
    }, 'should parse the cookie string')

    t.ok(await verifySessionString(parsed!.session, SECRET_KEY),
        'should verify the session token')
})

test('parse the session string', async t => {
    t.ok(await verifySessionString(parsed!.session, SECRET_KEY),
        'should be a valid session')
    const session = parseSession(parsed!.session)
    t.deepEqual(session, {
        hello: 'world'
    }, 'should parse to the same data we passed in')
})

test('remove a cookie', async t => {
    const newHeaders = rmCookie(headers)
    t.ok(newHeaders.getSetCookie()[0].includes('01 Jan 1970 00:00:00'),
        'Cookie should include 1970 date')
    t.ok(headers.getSetCookie()[0].includes('Jan 1970'),
        'should patch the headers instance')
})
