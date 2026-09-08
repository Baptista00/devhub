'use strict';

// Development-only checks: node tests/pwa.test.js. No server or dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const scope = 'https://example.test/devhub/';
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let passed = 0;
let failed = 0;

function projectFile(relative) {
    const pathname = decodeURIComponent(relative.split(/[?#]/)[0]);
    const resolved = path.resolve(root, pathname === './' ? 'index.html' : pathname);
    assert.ok(resolved.startsWith(root + path.sep), 'Asset must stay inside the project: ' + relative);
    assert.ok(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), 'Missing asset: ' + relative);
    return resolved;
}

function attribute(tag, name) {
    const match = tag.match(new RegExp('\\s' + name + '\\s*=\\s*(["\\\'])(.*?)\\1', 'i'));
    return match ? match[2] : null;
}

function htmlAssets() {
    return (html.match(/<(?:script|link|img|source)\b[^>]*>/gi) || []).map(function (tag) {
        return attribute(tag, /^<link\b/i.test(tag) ? 'href' : 'src');
    }).filter(Boolean);
}

function assertLocal(reference) {
    assert.ok(!/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(reference), 'Expected a relative local asset: ' + reference);
}

function environment() {
    const listeners = {};
    const stores = new Map();
    const deleted = [];
    const networkRequests = [];
    const status = { offline: false, failInstall: false, claimed: 0 };

    function keyFor(request) {
        return new URL(typeof request === 'string' ? request : request.url, scope).href;
    }

    function cacheFor(name) {
        if (!stores.has(name)) { stores.set(name, new Map()); }
        const entries = stores.get(name);
        return {
            async addAll(files) {
                // Cache.addAll is atomic: a failed response rejects the install batch.
                const responses = files.map(function (file) {
                    if (status.failInstall && file === 'js/app.js') { throw new Error('App shell unavailable'); }
                    return [keyFor(file), { source: 'cache', body: fs.readFileSync(projectFile(file)), url: keyFor(file) }];
                });
                responses.forEach(function (entry) { entries.set(entry[0], entry[1]); });
            },
            async match(request) { return entries.get(keyFor(request)); }
        };
    }

    const context = {
        Promise: Promise,
        self: {
            registration: { scope: scope },
            clients: { claim: async function () { status.claimed += 1; } },
            addEventListener: function (event, listener) { listeners[event] = listener; }
        },
        caches: {
            open: async function (name) { return cacheFor(name); },
            keys: async function () { return Array.from(stores.keys()); },
            delete: async function (name) { deleted.push(name); return stores.delete(name); }
        },
        fetch: async function (request) {
            networkRequests.push(request.url);
            if (status.offline) { throw new Error('Network unavailable'); }
            return { source: 'network', url: request.url, body: Buffer.from('network response') };
        }
    };
    vm.createContext(context);
    vm.runInContext(workerSource, context, { filename: 'service-worker.js' });

    async function lifecycle(name) {
        let promise;
        assert.equal(typeof listeners[name], 'function', 'Missing service worker event: ' + name);
        listeners[name]({ waitUntil: function (value) { promise = value; } });
        assert.ok(promise && typeof promise.then === 'function', name + ' must keep its async work alive');
        await promise;
    }

    function request(relative, options) {
        let response;
        const data = Object.assign({ url: new URL(relative, scope).href, method: 'GET', mode: 'cors' }, options || {});
        listeners.fetch({ request: data, respondWith: function (value) { response = value; } });
        return response;
    }

    return { context, stores, deleted, networkRequests, status, lifecycle, request };
}

async function test(name, run) {
    try {
        await run();
        passed += 1;
        console.log('PASS ' + name);
    } catch (error) {
        failed += 1;
        console.error('FAIL ' + name + '\n' + error.stack);
    }
}

async function main() {
    await test('every precache entry exists locally, stays in project scope and appears once', function () {
        const files = Array.from(environment().context.FILES);
        assert.ok(files.includes('./') && files.includes('index.html'));
        assert.equal(new Set(files).size, files.length);
        files.forEach(function (file) { assertLocal(file); projectFile(file); });
    });

    await test('HTML scripts, styles, icons and manifest resolve and are available offline', function () {
        const cached = new Set(Array.from(environment().context.FILES));
        const assets = htmlAssets();
        assert.ok(assets.length > 10, 'Expected the real application asset references');
        assets.forEach(function (asset) {
            assertLocal(asset);
            projectFile(asset);
            assert.ok(cached.has(asset), 'HTML asset absent from precache: ' + asset);
        });
        fs.readdirSync(path.join(root, 'css')).filter(function (file) { return /\.css$/.test(file); }).forEach(function (file) {
            const css = fs.readFileSync(path.join(root, 'css', file), 'utf8');
            const urls = css.match(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi) || [];
            urls.forEach(function (value) {
                const reference = value.replace(/^url\(\s*|\s*\)$/gi, '').replace(/^['"]|['"]$/g, '');
                if (/^data:/i.test(reference) || reference[0] === '#') { return; }
                assertLocal(reference);
                const relative = path.posix.normalize('css/' + reference);
                projectFile(relative);
                assert.ok(cached.has(relative), 'CSS asset absent from precache: ' + relative);
            });
            assert.ok(!/@import\b/i.test(css), 'CSS must not load undeclared stylesheet dependencies: ' + file);
        });
    });

    await test('HTML IDs are unique and static labels and ARIA references have targets', function () {
        const tags = html.match(/<[a-z][^>]*>/gi) || [];
        const ids = tags.map(function (tag) { return attribute(tag, 'id'); }).filter(Boolean);
        assert.ok(ids.length > 20);
        assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML id');
        const known = new Set(ids);
        tags.forEach(function (tag) {
            ['for', 'aria-labelledby', 'aria-describedby'].forEach(function (name) {
                const value = attribute(tag, name);
                if (!value) { return; }
                value.split(/\s+/).forEach(function (target) {
                    assert.ok(known.has(target), 'Missing ' + name + ' target: ' + target);
                });
            });
        });
    });

    await test('manifest metadata is valid and PNG icons have genuine signatures and advertised dimensions', function () {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
        ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color'].forEach(function (key) {
            assert.equal(typeof manifest[key], 'string');
            assert.ok(manifest[key].trim(), 'Manifest field cannot be empty: ' + key);
        });
        assert.equal(manifest.name, 'Lucas Dev Hub');
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.lang, 'pt-BR');
        assertLocal(manifest.start_url);
        assert.ok(new URL(manifest.start_url, scope).href.startsWith(new URL(manifest.scope, scope).href));
        projectFile(manifest.start_url);
        assert.ok(manifest.icons.length >= 2);
        const iconSizes = [];
        function png(file, width, height) {
            const bytes = fs.readFileSync(projectFile(file));
            assert.ok(bytes.length > 24);
            assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
            assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
            assert.equal(bytes.readUInt32BE(16), width, file + ' width');
            assert.equal(bytes.readUInt32BE(20), height, file + ' height');
        }
        manifest.icons.forEach(function (icon) {
            assertLocal(icon.src);
            assert.equal(icon.type, 'image/png');
            const size = /^(\d+)x(\d+)$/.exec(icon.sizes);
            assert.ok(size, 'Icon sizes must advertise concrete dimensions');
            png(icon.src, Number(size[1]), Number(size[2]));
            iconSizes.push(icon.sizes);
        });
        assert.ok(iconSizes.includes('192x192') && iconSizes.includes('512x512'));
        const appleTag = (html.match(/<link\b[^>]*>/gi) || []).find(function (tag) { return attribute(tag, 'rel') === 'apple-touch-icon'; });
        assert.ok(appleTag, 'An Apple home screen icon must be declared');
        png(attribute(appleTag, 'href'), 180, 180);
    });

    await test('install caches the complete app shell and keeps the release waiting normally', async function () {
        const env = environment();
        await env.lifecycle('install');
        const entries = env.stores.get(env.context.CACHE);
        assert.equal(entries.size, env.context.FILES.length);
        env.context.FILES.forEach(function (file) { assert.ok(entries.has(new URL(file, scope).href)); });
        assert.equal(env.status.claimed, 0);
        assert.equal(env.networkRequests.length, 0);
    });

    await test('a missing essential resource rejects installation without a partial shell', async function () {
        const env = environment();
        env.status.failInstall = true;
        await assert.rejects(env.lifecycle('install'), /App shell unavailable/);
        assert.equal(env.stores.get(env.context.CACHE).size, 0);
        assert.equal(env.status.claimed, 0);
    });

    await test('activate deletes only old caches for this application deployment', async function () {
        const env = environment();
        const obsolete = env.context.CACHE_PREFIX + 'v0.9.0';
        const otherDeployment = 'lucas-dev-hub-' + encodeURIComponent('https://example.test/another-hub/') + '-v0.9.0';
        [env.context.CACHE, obsolete, otherDeployment, 'unrelated-application-v1'].forEach(function (key) { env.stores.set(key, new Map()); });
        await env.lifecycle('activate');
        assert.deepEqual(env.deleted, [obsolete]);
        assert.ok(env.stores.has(env.context.CACHE));
        assert.ok(env.stores.has(otherDeployment));
        assert.ok(env.stores.has('unrelated-application-v1'));
        assert.equal(env.status.claimed, 1);
    });

    await test('offline navigation including query strings serves the cached application shell', async function () {
        const env = environment();
        await env.lifecycle('install');
        env.status.offline = true;
        for (const route of ['./', 'index.html?pwa=1', 'focus']) {
            const response = await env.request(route, { mode: 'navigate' });
            assert.equal(response.source, 'cache');
            assert.equal(response.body.toString('utf8'), html);
        }
        assert.equal(env.networkRequests.length, 0);
    });

    await test('offline precached scripts, styles, icons and manifest resolve without a network call', async function () {
        const env = environment();
        await env.lifecycle('install');
        env.status.offline = true;
        for (const file of env.context.FILES) {
            const response = await env.request(file);
            assert.equal(response.source, 'cache', file);
            assert.deepEqual(response.body, fs.readFileSync(projectFile(file)), file);
        }
        assert.equal(env.networkRequests.length, 0);
    });

    await test('online cache misses pass to the network without changing the release cache', async function () {
        const env = environment();
        await env.lifecycle('install');
        const before = env.stores.get(env.context.CACHE).size;
        const response = await env.request('not-preloaded.json');
        assert.equal(response.source, 'network');
        assert.deepEqual(env.networkRequests, [scope + 'not-preloaded.json']);
        assert.equal(env.stores.get(env.context.CACHE).size, before);
    });

    await test('offline requests for uncached resources fail instead of returning unrelated HTML', async function () {
        const env = environment();
        await env.lifecycle('install');
        env.status.offline = true;
        await assert.rejects(env.request('not-preloaded.json'), /Network unavailable/);
    });

    await test('other origins, sibling directories and non-GET requests are never intercepted', function () {
        const env = environment();
        ['https://external.test/devhub/', '/other-app/', '/devhub-other/index.html', '/index.html'].forEach(function (url) {
            assert.equal(env.request(url, { mode: 'navigate' }), undefined, url);
        });
        assert.equal(env.request('index.html', { method: 'POST' }), undefined);
        assert.equal(env.request('index.html', { method: 'PUT' }), undefined);
        assert.equal(env.request('index.html', { method: 'HEAD' }), undefined);
        assert.equal(env.stores.size, 0);
        assert.equal(env.networkRequests.length, 0);
    });

    console.log('\n' + passed + ' PWA and asset checks passed (VM; browser/device verification is separate).');
    if (failed) {
        console.error(failed + ' PWA and asset checks failed.');
        process.exitCode = 1;
    }
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
