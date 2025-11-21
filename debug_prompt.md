# Playwright Test Result Analysis - Default Debugging Prompt

## Context
This prompt defines the standard workflow and parsing strategy for analyzing Playwright test results in the FaVault project. Save this as `debug_prompt.md` for consistent test debugging.

## Test Lifecycle
1. Run Playwright tests against current codebase implementation
2. Generate test result artifacts in:
   - `C:\Users\bitcode\Favault\test-results\junit.xml`
   - `C:\Users\bitcode\Favault\test-results\results.json`
3. Parse and analyze errors from these files
4. Identify logic errors and test failures

## Critical Parsing Instructions

### For `test-results/junit.xml`:

**File Characteristics:**
- Large file (~81MB typical size)
- Contains 72+ tests with detailed failure information
- Top-level summary at line 1: `<testsuites>` element with `tests`, `failures`, `skipped`, `errors` attributes

**Where to Look for Errors:**

1. **Top-level summary (Line 1):**
   - Check `failures` attribute (NOT `errors` attribute)
   - Playwright reports assertion failures as `<failure>`, not `<error>`
   - `errors="0"` is expected even when tests fail

2. **Individual test failures:**
   - Search for `<testcase>` elements containing `<failure>` child elements
   - Each `<failure>` element contains:
     - `message` attribute: Short error description
     - **CDATA body**: Full error details including:
       - Complete stack trace
       - Assertion diffs (Expected vs Received values)
       - Code frame with line numbers
       - File paths and exact error locations
       - Screenshot/video attachment references

3. **Console output (per test):**
   - Located in `<system-out>` CDATA sections within each `<testcase>`
   - Contains:
     - All `[LOG]`, `[ERROR]`, `[WARN]`, `[DEBUG]` messages
     - Browser console monitoring summaries (JSON format)
     - Structured data: `totalConsoleMessages`, `errorCount`, `criticalErrorCount`, `errors[]`
     - Test-specific debug output (bookmarks, drag-drop operations, etc.)

**Parsing Strategy:**
- DO NOT rely solely on `errors` attribute or `<error>` elements
- ALWAYS parse `<failure>` elements and their CDATA bodies
- ALWAYS extract and display `<system-out>` content for failed tests
- Look for patterns like `[ERROR]`, `❌`, `FAILED:` in console output

### For `test-results/results.json`:

**File Characteristics:**
- Structured JSON with hierarchical test results
- Contains same test data as JUnit but in programmatic format
- Easier to parse for specific fields

**Where to Look for Errors:**

1. **Test-level status (per test object):**
   - `ok: false` indicates failure
   - `status` field values: `"passed"`, `"failed"`, `"timedOut"`, `"skipped"`
   - `duration` shows test execution time

2. **Error details (nested in each test):**
   - `error.message`: Headline error (e.g., "Test timeout of 30000ms exceeded")
   - `error.stack`: Basic stack trace
   - **`errors[]` array**: CRITICAL - contains detailed error information:
     - `errors[0]`: Usually the timeout/failure trigger
     - `errors[1+]`: Assertion failures with:
       - `location.file`: Absolute file path
       - `location.line`: Exact line number
       - `location.column`: Column position
       - `message`: Full assertion diff, code frame, and stack trace

3. **Console output (per test):**
   - `stdout[]` array: Each entry has `text` field
   - Concatenate all `stdout[].text` for complete console log
   - Contains same monitoring data as JUnit `<system-out>`
   - Look for JSON blocks with `totalConsoleMessages`, `errorCount`, `errors[]`

4. **Attachments:**
   - `attachments[]` array contains screenshot/video references
   - Each has `name`, `path`, `contentType`

**Parsing Strategy:**
- Check `ok` field first, then `status`
- ALWAYS iterate through entire `errors[]` array, not just `error.message`
- Extract `location` data for precise error positioning
- Concatenate `stdout[]` for full diagnostic context
- Parse structured JSON within stdout text for monitoring summaries

## Common Logic Errors to Detect

Based on FaVault test patterns, look for:

1. **Timing Issues:**
   - "Test timeout of 30000ms exceeded"
   - Indicates async operations not completing
   - Check drag-drop operations, bookmark loading, extension initialization

2. **Assertion Failures:**
   - `expect(received).toBe(expected)` mismatches
   - Example: `Expected: 2, Received: 1` (common in summary.passed checks)
   - Indicates test expectations don't match actual behavior

3. **Extension Context Errors:**
   - "Functions not available after exposure"
   - "Extension ID: undefined"
   - Indicates extension loading or API exposure issues

4. **Browser Console Errors:**
   - Check `criticalErrorCount` in monitoring summaries
   - Look for `errors[]` arrays in console monitoring JSON
   - Cross-reference with test failures

## File Size Handling

Both files are large (80+ MB typical):
- Use targeted searches rather than full file reads
- Search for specific test names or error patterns
- Use line ranges when viewing specific test cases
- Leverage regex search for patterns like `<failure>`, `"ok": false`, `[ERROR]`

## Action Items When Analyzing Results

1. Extract failure count from JUnit line 1 or JSON summary
2. For each failure, extract:
   - Test name and file path
   - Complete error message with assertion diffs
   - Stack trace with line numbers
   - Console output with monitoring data
3. Identify patterns across multiple failures
4. Correlate browser console errors with test failures
5. Prioritize critical errors and timeouts over minor assertion failures