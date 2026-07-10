import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from "./firebase-config.js";

const StorageFallback = {
    getFallbackTests() {
        return safeJsonParse(safeLocalStorageGet("bilimal_fallback_tests", "{}"), {});
    },
    saveFallbackTest(testId, testData) {
        const tests = this.getFallbackTests();
        tests[testId] = { ...testData, updatedAt: Date.now(), localOnly: true };
        return safeLocalStorageSet("bilimal_fallback_tests", tests);
    },
    deleteFallbackTest(testId) {
        const tests = this.getFallbackTests();
        if (tests[testId]) { delete tests[testId]; return safeLocalStorageSet("bilimal_fallback_tests", tests); }
        return false;
    },
    getFallbackResults() {
        return safeJsonParse(safeLocalStorageGet("bilimal_fallback_results", "{}"), {});
    },
    saveFallbackResult(testId, studentId, resultData) {
        const results = this.getFallbackResults();
        if (!results[testId]) results[testId] = {};
        results[testId][studentId] = { ...resultData, localOnly: true };
        return safeLocalStorageSet("bilimal_fallback_results", results);
    }
};
window.StorageFallback = StorageFallback;
export { StorageFallback };
