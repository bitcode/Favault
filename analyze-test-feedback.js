#!/usr/bin/env node

/**
 * Test feedback analyzer for development loop
 * Reads log files and provides actionable development insights
 */

import fs from 'fs';
import path from 'path';
import { TestLogger } from './test-logger.js';

class TestFeedbackAnalyzer {
  constructor() {
    this.logsDir = path.join('./test-results', 'logs');
    this.analysis = {
      timestamp: new Date().toISOString(),
      testSuites: [],
      trends: {},
      recommendations: [],
      criticalIssues: [],
      performance: {},
      summary: {}
    };
  }

  analyzeAllTests() {
    console.log('🔍 Analyzing Test Feedback for Development Loop');
    console.log('===============================================');

    if (!fs.existsSync(this.logsDir)) {
      console.log('❌ No test logs found. Run tests first with: npm run test:logged');
      return null;
    }

    // Analyze each test suite (check for both expected and actual log file names)
    this.analyzeTestSuite('position-accuracy');
    this.analyzeTestSuite('ui-refresh');
    this.analyzeTestSuite('drop-zone');

    // Also check for alternative log file names that might be generated
    this.analyzeTestSuite('extension-working');
    this.analyzeTestSuite('extension-proper');
    this.analyzeTestSuite('simple-extension');

    // Analyze overall trends
    this.analyzeOverallResults();

    // Generate recommendations
    this.generateRecommendations();

    // Save analysis
    this.saveAnalysis();

    return this.analysis;
  }

  analyzeTestSuite(suiteName) {
    const latestFile = path.join(this.logsDir, `${suiteName}-latest.json`);
    
    if (!fs.existsSync(latestFile)) {
      console.log(`⚠️ No logs found for ${suiteName} test suite`);
      return;
    }

    try {
      const results = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
      
      const analysis = {
        name: suiteName,
        status: results.summary.success ? 'PASSED' : 'FAILED',
        summary: results.summary,
        performance: results.performance,
        issues: [],
        insights: [],
        trends: {}
      };

      // Analyze test failures
      if (results.summary.failed > 0) {
        const failedTests = results.tests.filter(t => !t.passed);
        failedTests.forEach(test => {
          analysis.issues.push({
            type: 'test_failure',
            test: test.name,
            error: test.error?.message || 'Unknown error',
            severity: 'high'
          });
        });
      }

      // Analyze performance issues
      if (results.performance.averageTestTime > 5000) {
        analysis.issues.push({
          type: 'performance',
          message: `Slow test execution: ${Math.round(results.performance.averageTestTime)}ms average`,
          severity: 'medium'
        });
      }

      // Analyze console errors
      if (results.debugging.consoleErrors.length > 0) {
        analysis.issues.push({
          type: 'console_errors',
          count: results.debugging.consoleErrors.length,
          errors: results.debugging.consoleErrors.slice(0, 3), // First 3 errors
          severity: 'medium'
        });
      }

      // Generate insights based on test suite type
      this.generateSuiteSpecificInsights(suiteName, results, analysis);

      this.analysis.testSuites.push(analysis);
      
      console.log(`📊 ${suiteName}: ${analysis.status} (${results.summary.passed}/${results.summary.total} tests)`);
      
      if (analysis.issues.length > 0) {
        console.log(`   Issues: ${analysis.issues.length}`);
        analysis.issues.forEach(issue => {
          console.log(`   - ${issue.type}: ${issue.message || issue.error}`);
        });
      }

    } catch (error) {
      console.error(`❌ Error analyzing ${suiteName}:`, error.message);
    }
  }

  generateSuiteSpecificInsights(suiteName, results, analysis) {
    switch (suiteName) {
      case 'position-accuracy':
        // Check for position accuracy issues
        const positionTests = results.tests.filter(t => t.metadata?.accuracy !== undefined);
        if (positionTests.length > 0) {
          const avgAccuracy = positionTests.reduce((sum, t) => sum + (t.metadata.accuracy || 0), 0) / positionTests.length;
          
          if (avgAccuracy < 90) {
            analysis.insights.push({
              type: 'accuracy_issue',
              message: `Position accuracy below 90%: ${avgAccuracy.toFixed(1)}%`,
              recommendation: 'Check index calculation logic in moveFolderToPosition()',
              priority: 'high'
            });
          }
          
          analysis.trends.accuracy = avgAccuracy;
        }
        break;

      case 'ui-refresh':
        // Check for UI refresh timing issues
        const refreshTests = results.tests.filter(t => t.metadata?.refreshTime !== undefined);
        if (refreshTests.length > 0) {
          const avgRefreshTime = refreshTests.reduce((sum, t) => sum + (t.metadata.refreshTime || 0), 0) / refreshTests.length;
          
          if (avgRefreshTime > 3000) {
            analysis.insights.push({
              type: 'slow_refresh',
              message: `UI refresh taking too long: ${avgRefreshTime}ms`,
              recommendation: 'Optimize cache clearing and event handling in refreshUI()',
              priority: 'medium'
            });
          }
          
          analysis.trends.refreshTime = avgRefreshTime;
        }
        break;

      case 'drop-zone':
        // Check for drop zone configuration issues
        const dropTests = results.tests.filter(t => t.name.includes('Insertion Point'));
        if (dropTests.length > 0 && dropTests.some(t => !t.passed)) {
          analysis.insights.push({
            type: 'drop_zone_issue',
            message: 'Insertion point count mismatch detected',
            recommendation: 'Verify insertion point generation logic in FolderInsertionPoint component',
            priority: 'high'
          });
        }
        break;
    }
  }

  analyzeOverallResults() {
    const overallFile = path.join(this.logsDir, 'overall-latest.json');
    
    if (fs.existsSync(overallFile)) {
      try {
        const overall = JSON.parse(fs.readFileSync(overallFile, 'utf8'));
        
        this.analysis.summary = {
          overallSuccess: overall.overallSummary.success,
          totalSuites: overall.overallSummary.totalSuites,
          passedSuites: overall.overallSummary.passedSuites,
          totalTests: overall.overallSummary.totalTests,
          passedTests: overall.overallSummary.passedTests,
          successRate: (overall.overallSummary.passedTests / overall.overallSummary.totalTests) * 100
        };

        console.log(`\n📈 Overall Success Rate: ${this.analysis.summary.successRate.toFixed(1)}%`);
        
      } catch (error) {
        console.error('❌ Error analyzing overall results:', error.message);
      }
    }
  }

  generateRecommendations() {
    const allIssues = this.analysis.testSuites.flatMap(suite => suite.issues);
    const allInsights = this.analysis.testSuites.flatMap(suite => suite.insights);

    // Critical issues that need immediate attention
    const criticalIssues = allIssues.filter(issue => issue.severity === 'high');
    this.analysis.criticalIssues = criticalIssues;

    // Generate development recommendations
    if (criticalIssues.length > 0) {
      this.analysis.recommendations.push({
        priority: 'CRITICAL',
        action: 'Fix failing tests immediately',
        details: criticalIssues.map(issue => `${issue.type}: ${issue.error || issue.message}`),
        files: this.getRelevantFiles(criticalIssues)
      });
    }

    // Performance recommendations
    const performanceIssues = allIssues.filter(issue => issue.type === 'performance');
    if (performanceIssues.length > 0) {
      this.analysis.recommendations.push({
        priority: 'HIGH',
        action: 'Optimize test performance',
        details: performanceIssues.map(issue => issue.message),
        files: ['src/lib/dragdrop-enhanced.ts', 'src/App.svelte']
      });
    }

    // Console error recommendations
    const consoleErrorIssues = allIssues.filter(issue => issue.type === 'console_errors');
    if (consoleErrorIssues.length > 0) {
      this.analysis.recommendations.push({
        priority: 'MEDIUM',
        action: 'Fix console errors',
        details: consoleErrorIssues.flatMap(issue => issue.errors?.map(e => e.message) || []),
        files: ['src/lib/dragdrop-enhanced.ts', 'src/lib/FolderInsertionPoint.svelte']
      });
    }

    // Insight-based recommendations
    allInsights.forEach(insight => {
      this.analysis.recommendations.push({
        priority: insight.priority.toUpperCase(),
        action: insight.recommendation,
        details: [insight.message],
        type: insight.type
      });
    });

    console.log(`\n💡 Generated ${this.analysis.recommendations.length} recommendations`);
  }

  getRelevantFiles(issues) {
    const fileMap = {
      'test_failure': ['src/lib/dragdrop-enhanced.ts', 'src/App.svelte'],
      'accuracy_issue': ['src/lib/dragdrop-enhanced.ts'],
      'slow_refresh': ['src/App.svelte', 'src/lib/dragdrop-enhanced.ts'],
      'drop_zone_issue': ['src/lib/FolderInsertionPoint.svelte'],
      'console_errors': ['src/lib/dragdrop-enhanced.ts']
    };

    const files = new Set();
    issues.forEach(issue => {
      const relevantFiles = fileMap[issue.type] || [];
      relevantFiles.forEach(file => files.add(file));
    });

    return Array.from(files);
  }

  saveAnalysis() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisFile = path.join(this.logsDir, `analysis-${timestamp}.json`);
    const latestAnalysisFile = path.join(this.logsDir, 'analysis-latest.json');

    fs.writeFileSync(analysisFile, JSON.stringify(this.analysis, null, 2));
    fs.writeFileSync(latestAnalysisFile, JSON.stringify(this.analysis, null, 2));

    // Generate human-readable report
    const reportFile = path.join(this.logsDir, `development-feedback-${timestamp}.txt`);
    const report = this.generateReport();
    fs.writeFileSync(reportFile, report);

    console.log(`\n📄 Analysis saved:`);
    console.log(`   JSON: ${latestAnalysisFile}`);
    console.log(`   Report: ${reportFile}`);
  }

  generateReport() {
    const { analysis } = this;
    
    return `
FaVault Extension - Development Feedback Report
==============================================

Generated: ${analysis.timestamp}
Overall Success Rate: ${analysis.summary.successRate?.toFixed(1) || 'N/A'}%

Test Suite Results:
------------------
${analysis.testSuites.map(suite => `
${suite.status === 'PASSED' ? '✅' : '❌'} ${suite.name}
   Tests: ${suite.summary.passed}/${suite.summary.total} passed
   Duration: ${suite.performance.averageTestTime ? Math.round(suite.performance.averageTestTime) + 'ms' : 'N/A'}
   Issues: ${suite.issues.length}
${suite.issues.map(issue => `   - ${issue.type}: ${issue.error || issue.message}`).join('\n')}
`).join('\n')}

Development Recommendations:
---------------------------
${analysis.recommendations.map((rec, i) => `
${i + 1}. [${rec.priority}] ${rec.action}
   ${rec.details.join('\n   ')}
   ${rec.files ? `Files to check: ${rec.files.join(', ')}` : ''}
`).join('\n')}

${analysis.criticalIssues.length > 0 ? `
🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:
${analysis.criticalIssues.map(issue => `- ${issue.type}: ${issue.error || issue.message}`).join('\n')}
` : '✅ No critical issues detected'}

Next Steps:
----------
1. Address critical issues first (if any)
2. Run tests again: npm run test:logged
3. Check analysis: node analyze-test-feedback.js
4. Repeat until all tests pass

Development Loop:
----------------
Code → Test → Analyze → Fix → Repeat
`.trim();
  }

  printSummary() {
    console.log('\n🎯 Development Feedback Summary:');
    console.log('================================');
    
    if (this.analysis.summary.overallSuccess) {
      console.log('✅ All tests passing - ready for production!');
    } else {
      console.log(`❌ ${this.analysis.criticalIssues.length} critical issues need attention`);
      console.log(`📊 Success rate: ${this.analysis.summary.successRate?.toFixed(1) || 'N/A'}%`);
    }
    
    console.log(`💡 ${this.analysis.recommendations.length} recommendations generated`);
    
    if (this.analysis.recommendations.length > 0) {
      console.log('\n🔧 Top Priority Actions:');
      this.analysis.recommendations
        .filter(rec => rec.priority === 'CRITICAL' || rec.priority === 'HIGH')
        .slice(0, 3)
        .forEach((rec, i) => {
          console.log(`   ${i + 1}. [${rec.priority}] ${rec.action}`);
        });
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new TestFeedbackAnalyzer();
  const analysis = analyzer.analyzeAllTests();
  
  if (analysis) {
    analyzer.printSummary();
  }
}

export default TestFeedbackAnalyzer;
