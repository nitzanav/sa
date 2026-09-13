---
name: code-review
description: Review or write code against this repo's standards for naming, config, layering and minimalism. Use when reviewing a diff or PR, or before proposing code changes.
disable-model-invocation: true
---

# Code Review

Rules, each with the smallest possible counter-example.

## Naming

Names state what the thing is or acts on; no vague verbs, no abbreviations.

```js
fetchText(); writeJson(); recordRetry(); // don't
request();   writeJsonFile(); logger.log(); // do
```

Parameters and loop variables carry the same weight as function names.

```js
(fn, key, produce, i)                                  // don't
(functionToRetry, operationName, functionToCache, attempt) // do
```

Make a helper generic when nothing forces it to be specific.

```js
csvSymbols(file); // don't
readCsv(file);    // do
```

## Config

All values come from `config/default.json`; no defaults inline.

```js
const ttl = cacheConfig.ttl ?? 86400000; // don't
const { ttl } = { ...config.cache, ...cacheConfig }; // do
```

Store each value in the unit and format the code uses, so code never converts it.

```js
"ttl": 86400, ... ttl * 1000 // don't
"ttl": 86400000, ... ttl     // do
```

Group keys under the owner that gives them context.

```json
"limit": 3                              // don't
"analyst_recommendations": { "limit": 3 } // do
```

Prefer convention over configuration: the caller passes only what it decides, the low-level function reads config to decide how to act.

```js
fileCache(request, { fileName, enabled: true, ttl: 86400000 }); // don't
fileCache(request, { fileName }); // do
```

## Structure

Validate a config in the layer that owns it, never in callers.

```js
if (!cache.fileName) throw ...; return fileCache(...); // don't (caller)
export function fileCache(fn, cacheConfig) { if (enabled && !fileName) throw ...; } // do
```

Optional inputs stay optional; log a blank value instead of throwing.

```js
if (!operationName) throw new Error(...);        // don't
logger.log({ message: "retry", operationName }); // do
```

Cross-cutting helpers are decorators returning a function, composed in named steps.

```js
return fileCache(() => backoffRetry(() => request(url), r), c); // don't
const requestWithRetry = backoffRetry(request, retryConfig);    // do
const requestWithRetryAndCache = fileCache(requestWithRetry, cacheConfig);
return requestWithRetryAndCache(httpConfig);
```

Group related inputs into one options object.

```js
httpRequestScrape(url, retryConfig, cacheConfig);        // don't
httpRequestScrape(httpConfig, retryConfig, cacheConfig); // do
```

Name a calculation before testing it; no arithmetic inside `if`.

```js
if (Date.now() - mtimeMs < ttl) ...            // don't
const expiry = mtimeMs + ttl; if (Date.now() < expiry) ... // do
```

One generic logger, never a function per event.

```js
recordRetry(operationName, attempt, wait, error);                    // don't
logger.log({ message: "retry", operationName, attempt, wait, error }); // do
```

## Minimalism

No comments and no logs; self-explanatory names instead.

Exceptions propagate to the caller; never log and rethrow.

Apply YAGNI and DRY: short functions, maximum reuse, no speculative options.

Every module has a Jest test file beside it; real runs are covered by an e2e test in `test/e2e/` that compares against a recorded baseline.
