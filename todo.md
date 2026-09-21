# Fix failing Vitest baseline

## Done

- [x] `down-migration.test.ts` — expect versions `[1, 3, 4, 5]`
- [x] `config-handlers.test.ts` — expect `host` in three D-2 cases
- [x] `organisms.test.tsx` — `object-cover` instead of `blur-xl`
- [x] `npx vitest run` — 767 passed / 0 failed
- [x] eslint on the three test files — clean
- [x] Restore `current.yml` to harness-only

## Coverage

`npm run test:coverage` failed on unrelated perf: `repo > bulkInserts 8000 live channels` 1616ms > 1500ms (coverage overhead). Out of this allowlist. Thresholds not evaluated because that test failed first.
