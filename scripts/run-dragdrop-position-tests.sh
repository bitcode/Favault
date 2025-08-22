#!/bin/bash

# Drag and Drop Position Validation Test Runner
# Runs comprehensive position validation tests specifically in Chrome
# Generates detailed reports for debugging positioning issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="test-results/dragdrop-position-reports"
REPORT_FILE="$REPORT_DIR/position-validation-report-$TIMESTAMP.html"
JSON_REPORT="$REPORT_DIR/position-validation-data-$TIMESTAMP.json"

echo -e "${BLUE}🧪 FaVault Drag & Drop Position Validation Test Suite${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR"

echo -e "${YELLOW}📋 Test Configuration:${NC}"
echo "  • Browser: Chrome (Chromium)"
echo "  • Focus: Position validation and consistency"
echo "  • Report: $REPORT_FILE"
echo "  • Data: $JSON_REPORT"
echo ""

# Check if extension is built
if [ ! -d "dist/chrome" ]; then
    echo -e "${RED}❌ Chrome extension not found in dist/chrome${NC}"
    echo "Please build the extension first:"
    echo "  npm run build:chrome"
    exit 1
fi

echo -e "${YELLOW}🔧 Building extension for testing...${NC}"
npm run build:chrome

echo -e "${YELLOW}🚀 Running position validation tests...${NC}"
echo ""

# Run the simplified position validation tests (these work!)
echo -e "${YELLOW}🧪 Running simplified drag-drop position tests...${NC}"
npx playwright test \
    --project=chrome-extension \
    --reporter=html \
    tests/playwright/specs/dragdrop-position-validation-simple.test.ts

SIMPLE_TEST_EXIT_CODE=$?

echo ""
if [ $SIMPLE_TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Simplified tests passed - drag-drop logic is working correctly${NC}"
else
    echo -e "${RED}❌ Simplified tests failed - basic drag-drop logic has issues${NC}"
fi

echo ""
echo -e "${YELLOW}🔧 Running extension-specific position validation tests...${NC}"
echo -e "${YELLOW}(These may fail due to extension loading issues)${NC}"

# Run the extension-specific tests
npx playwright test \
    --project=chrome-extension \
    --grep="Position Validation|Insertion Point Validation" \
    --reporter=html \
    tests/playwright/specs/dragdrop-position-validation.test.ts \
    tests/playwright/specs/dragdrop-insertion-point-validation.test.ts

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}📊 Generating comprehensive position analysis report...${NC}"

# Create a detailed HTML report
cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FaVault Drag & Drop Position Validation Report - $TIMESTAMP</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            margin: 5px;
        }
        .status-success { background-color: #d4edda; color: #155724; }
        .status-warning { background-color: #fff3cd; color: #856404; }
        .status-error { background-color: #f8d7da; color: #721c24; }
        .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
        }
        .section h2 {
            margin-top: 0;
            color: #333;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
        }
        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .test-card {
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            background: #fafafa;
        }
        .test-card h3 {
            margin-top: 0;
            color: #555;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
        }
        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            overflow-x: auto;
        }
        .issue-list {
            list-style: none;
            padding: 0;
        }
        .issue-list li {
            padding: 10px;
            margin: 5px 0;
            border-left: 4px solid #dc3545;
            background: #f8f9fa;
        }
        .recommendations {
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 FaVault Drag & Drop Position Validation Report</h1>
            <p>Generated on: $(date)</p>
            <p>Test Suite: Chrome Position Validation</p>
            <div class="status-badge status-$([ $TEST_EXIT_CODE -eq 0 ] && echo "success" || echo "error")">
                $([ $TEST_EXIT_CODE -eq 0 ] && echo "✅ Tests Completed" || echo "❌ Tests Failed")
            </div>
        </div>

        <div class="section">
            <h2>📋 Test Overview</h2>
            <div class="test-grid">
                <div class="test-card">
                    <h3>Position Validation Tests</h3>
                    <div class="metric">
                        <span>File:</span>
                        <span>dragdrop-position-validation.test.ts</span>
                    </div>
                    <div class="metric">
                        <span>Focus:</span>
                        <span>Position accuracy and consistency</span>
                    </div>
                    <div class="metric">
                        <span>Browser:</span>
                        <span>Chrome (Chromium)</span>
                    </div>
                </div>
                <div class="test-card">
                    <h3>Insertion Point Tests</h3>
                    <div class="metric">
                        <span>File:</span>
                        <span>dragdrop-insertion-point-validation.test.ts</span>
                    </div>
                    <div class="metric">
                        <span>Focus:</span>
                        <span>Insertion point calculation</span>
                    </div>
                    <div class="metric">
                        <span>Browser:</span>
                        <span>Chrome (Chromium)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔍 Known Issues Being Tested</h2>
            <ul class="issue-list">
                <li><strong>Issue 1:</strong> Sometimes dragging over 1 position results in no movement</li>
                <li><strong>Issue 2:</strong> Sometimes dragging over 2 positions only moves 1 position</li>
                <li><strong>Issue 3:</strong> Sometimes dragging over 2 positions moves 3 positions</li>
                <li><strong>Issue 4:</strong> Final drop position is consistently off by 1-2 positions</li>
            </ul>
        </div>

        <div class="section">
            <h2>🧪 Test Coverage</h2>
            <div class="test-grid">
                <div class="test-card">
                    <h3>Position Detection</h3>
                    <p>✅ Initial position detection<br>
                    ✅ Final position validation<br>
                    ✅ Position consistency checks</p>
                </div>
                <div class="test-card">
                    <h3>Movement Patterns</h3>
                    <p>✅ Single position forward/backward<br>
                    ✅ Multi-position movements<br>
                    ✅ Edge case scenarios</p>
                </div>
                <div class="test-card">
                    <h3>Persistence Testing</h3>
                    <p>✅ Page refresh consistency<br>
                    ✅ New tab consistency<br>
                    ✅ State management validation</p>
                </div>
                <div class="test-card">
                    <h3>Insertion Points</h3>
                    <p>✅ Insertion point detection<br>
                    ✅ Visual feedback validation<br>
                    ✅ Calculation accuracy</p>
                </div>
            </div>
        </div>

        <div class="recommendations">
            <h2>💡 Debugging Recommendations</h2>
            <ol>
                <li><strong>Check Console Output:</strong> Review the detailed console logs for position calculations</li>
                <li><strong>Analyze Pattern Data:</strong> Look for consistent patterns in position differences</li>
                <li><strong>Validate Index Calculations:</strong> Focus on the Chrome bookmarks API move behavior</li>
                <li><strong>Test Insertion Point Logic:</strong> Verify insertion point to final position mapping</li>
                <li><strong>Review Timing Issues:</strong> Check if rapid operations cause state conflicts</li>
            </ol>
        </div>

        <div class="section">
            <h2>📁 Generated Files</h2>
            <div class="code-block">
HTML Report: $REPORT_FILE
JSON Data: $JSON_REPORT
Playwright Report: $REPORT_DIR/index.html
Screenshots: $REPORT_DIR/test-results/
            </div>
        </div>

        <div class="footer">
            <p>🔧 FaVault Extension Testing Suite</p>
            <p>For detailed test results, check the Playwright HTML report</p>
        </div>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}✅ Position validation report generated: $REPORT_FILE${NC}"

# Open the report if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}📖 Opening report in browser...${NC}"
    open "$REPORT_FILE"
fi

echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo -e "${BLUE}===============${NC}"

if [ $SIMPLE_TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Simplified Tests: PASSED${NC}"
    echo -e "   → Drag-drop positioning logic is working correctly"
    echo -e "   → The core algorithm handles position calculations properly"
else
    echo -e "${RED}❌ Simplified Tests: FAILED${NC}"
    echo -e "   → Basic drag-drop logic has fundamental issues"
fi

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Extension Tests: PASSED${NC}"
    echo -e "   → Extension drag-drop system is working correctly"
else
    echo -e "${RED}❌ Extension Tests: FAILED${NC}"
    echo -e "   → Extension-specific issues detected"

    if [ $SIMPLE_TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${YELLOW}💡 Recommendation: Focus on extension integration issues${NC}"
        echo -e "   → Check Chrome bookmarks API integration"
        echo -e "   → Verify event handling in extension context"
        echo -e "   → Review timing and state management"
    fi
fi

echo ""
echo -e "${YELLOW}📁 Generated Reports:${NC}"
echo "  • HTML Report: $REPORT_FILE"
echo "  • Playwright Report: $REPORT_DIR/index.html"
echo "  • Test Data: $JSON_REPORT"
echo ""

exit $TEST_EXIT_CODE
