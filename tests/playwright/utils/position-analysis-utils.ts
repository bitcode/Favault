/**
 * Position Analysis Utilities for Drag and Drop Testing
 * 
 * Provides utilities to analyze position inconsistencies and generate
 * detailed reports about drag and drop behavior patterns.
 */

import { Page } from '@playwright/test';

export interface PositionTestResult {
  initialPosition: number;
  targetPosition: number;
  actualFinalPosition: number;
  expectedFinalPosition: number;
  positionDifference: number;
  success: boolean;
  folderTitle: string;
  timestamp: number;
  testType: 'forward' | 'backward' | 'same';
  movementDistance: number;
}

export interface PositionAnalysisReport {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  successRate: number;
  patterns: {
    forwardMoveIssues: PositionTestResult[];
    backwardMoveIssues: PositionTestResult[];
    commonDifferences: { [key: number]: number };
    averageDifference: number;
  };
  recommendations: string[];
}

export class PositionAnalysisUtils {
  constructor(private page: Page) {}

  /**
   * Analyze position test results and generate comprehensive report
   */
  static analyzePositionResults(results: PositionTestResult[]): PositionAnalysisReport {
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    const successRate = totalTests > 0 ? (successfulTests.length / totalTests) * 100 : 0;

    // Categorize failed tests
    const forwardMoveIssues = failedTests.filter(r => r.testType === 'forward');
    const backwardMoveIssues = failedTests.filter(r => r.testType === 'backward');

    // Analyze common position differences
    const commonDifferences: { [key: number]: number } = {};
    failedTests.forEach(result => {
      const diff = result.positionDifference;
      commonDifferences[diff] = (commonDifferences[diff] || 0) + 1;
    });

    // Calculate average difference
    const averageDifference = failedTests.length > 0 
      ? failedTests.reduce((sum, r) => sum + Math.abs(r.positionDifference), 0) / failedTests.length
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(failedTests, commonDifferences);

    return {
      totalTests,
      successfulTests: successfulTests.length,
      failedTests: failedTests.length,
      successRate,
      patterns: {
        forwardMoveIssues,
        backwardMoveIssues,
        commonDifferences,
        averageDifference
      },
      recommendations
    };
  }

  /**
   * Generate recommendations based on test failure patterns
   */
  private static generateRecommendations(
    failedTests: PositionTestResult[], 
    commonDifferences: { [key: number]: number }
  ): string[] {
    const recommendations: string[] = [];

    // Check for consistent off-by-one errors
    if (commonDifferences[1] > 0 || commonDifferences[-1] > 0) {
      recommendations.push(
        'Off-by-one errors detected. Check index calculation logic in dragdrop-enhanced.ts, ' +
        'particularly the Chrome bookmarks API move behavior handling.'
      );
    }

    // Check for consistent off-by-two errors
    if (commonDifferences[2] > 0 || commonDifferences[-2] > 0) {
      recommendations.push(
        'Off-by-two errors detected. This may indicate issues with insertion point calculation ' +
        'or double-adjustment of indices during move operations.'
      );
    }

    // Check for forward vs backward move patterns
    const forwardIssues = failedTests.filter(r => r.testType === 'forward').length;
    const backwardIssues = failedTests.filter(r => r.testType === 'backward').length;

    if (forwardIssues > backwardIssues * 2) {
      recommendations.push(
        'Forward moves are significantly more problematic than backward moves. ' +
        'Review the index adjustment logic for forward movements in moveFolderToPosition().'
      );
    } else if (backwardIssues > forwardIssues * 2) {
      recommendations.push(
        'Backward moves are significantly more problematic than forward moves. ' +
        'Review the index adjustment logic for backward movements in moveFolderToPosition().'
      );
    }

    // Check for large position differences
    const largeDifferences = failedTests.filter(r => Math.abs(r.positionDifference) > 2);
    if (largeDifferences.length > 0) {
      recommendations.push(
        'Large position differences detected (>2 positions). This may indicate ' +
        'fundamental issues with the position calculation algorithm or race conditions.'
      );
    }

    // Check for no movement issues
    const noMovement = failedTests.filter(r => r.actualFinalPosition === r.initialPosition);
    if (noMovement.length > 0) {
      recommendations.push(
        'Some drag operations resulted in no movement. Check if drag events are being ' +
        'properly handled and if the enhanced drag-drop system is correctly initialized.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'No clear patterns detected in failures. Review individual test cases for specific issues.'
      );
    }

    return recommendations;
  }

  /**
   * Create a detailed position test result
   */
  static createPositionTestResult(
    initialPosition: number,
    targetPosition: number,
    actualFinalPosition: number,
    folderTitle: string
  ): PositionTestResult {
    const positionDifference = actualFinalPosition - targetPosition;
    const success = actualFinalPosition === targetPosition;
    const movementDistance = Math.abs(targetPosition - initialPosition);
    
    let testType: 'forward' | 'backward' | 'same';
    if (targetPosition > initialPosition) {
      testType = 'forward';
    } else if (targetPosition < initialPosition) {
      testType = 'backward';
    } else {
      testType = 'same';
    }

    return {
      initialPosition,
      targetPosition,
      actualFinalPosition,
      expectedFinalPosition: targetPosition,
      positionDifference,
      success,
      folderTitle,
      timestamp: Date.now(),
      testType,
      movementDistance
    };
  }

  /**
   * Log detailed analysis to console
   */
  static logAnalysisReport(report: PositionAnalysisReport): void {
    console.log('\n📊 POSITION ANALYSIS REPORT');
    console.log('============================');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Successful: ${report.successfulTests} (${report.successRate.toFixed(1)}%)`);
    console.log(`Failed: ${report.failedTests} (${(100 - report.successRate).toFixed(1)}%)`);

    if (report.failedTests > 0) {
      console.log('\n🔍 FAILURE PATTERNS:');
      console.log(`Forward Move Issues: ${report.patterns.forwardMoveIssues.length}`);
      console.log(`Backward Move Issues: ${report.patterns.backwardMoveIssues.length}`);
      console.log(`Average Position Difference: ${report.patterns.averageDifference.toFixed(2)}`);

      console.log('\n📈 COMMON POSITION DIFFERENCES:');
      Object.entries(report.patterns.commonDifferences)
        .sort(([,a], [,b]) => b - a)
        .forEach(([diff, count]) => {
          console.log(`  ${diff > 0 ? '+' : ''}${diff} positions: ${count} occurrences`);
        });

      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    } else {
      console.log('\n✅ All position tests passed successfully!');
    }
  }

  /**
   * Store analysis results in browser for debugging
   */
  async storeAnalysisResults(report: PositionAnalysisReport): Promise<void> {
    await this.page.evaluate((analysisReport) => {
      (window as any).positionAnalysisReport = analysisReport;
      console.log('📊 Position analysis results stored in window.positionAnalysisReport');
    }, report);
  }

  /**
   * Generate CSV export of test results
   */
  static generateCSVReport(results: PositionTestResult[]): string {
    const headers = [
      'Timestamp',
      'Folder Title',
      'Initial Position',
      'Target Position',
      'Actual Final Position',
      'Position Difference',
      'Success',
      'Test Type',
      'Movement Distance'
    ];

    const csvRows = [
      headers.join(','),
      ...results.map(result => [
        new Date(result.timestamp).toISOString(),
        `"${result.folderTitle}"`,
        result.initialPosition,
        result.targetPosition,
        result.actualFinalPosition,
        result.positionDifference,
        result.success,
        result.testType,
        result.movementDistance
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Validate position consistency across multiple operations
   */
  async validatePositionConsistency(
    operations: Array<{ from: number; to: number; description: string }>
  ): Promise<{
    consistent: boolean;
    issues: string[];
    results: PositionTestResult[];
  }> {
    const results: PositionTestResult[] = [];
    const issues: string[] = [];

    for (const operation of operations) {
      // This would be implemented with actual drag operations
      // For now, it's a placeholder for the validation logic
      console.log(`Validating operation: ${operation.description}`);
    }

    return {
      consistent: issues.length === 0,
      issues,
      results
    };
  }
}

/**
 * Helper function to extract position data from DOM
 */
export async function extractFolderPositions(page: Page): Promise<Array<{
  title: string;
  position: number;
  id?: string;
}>> {
  return await page.evaluate(() => {
    const folders = Array.from(document.querySelectorAll('.folder-container'));
    return folders.map((folder, index) => {
      const titleElement = folder.querySelector('.folder-title, h3, .folder-name');
      const title = titleElement?.textContent?.trim() || `Folder ${index}`;
      const id = folder.getAttribute('data-folder-id') || folder.id || undefined;
      
      return {
        title,
        position: index,
        id
      };
    });
  });
}

/**
 * Helper function to wait for position changes to stabilize
 */
export async function waitForPositionStabilization(
  page: Page, 
  timeoutMs: number = 3000
): Promise<boolean> {
  const startTime = Date.now();
  let lastPositions: string = '';
  let stableCount = 0;
  const requiredStableChecks = 3;

  while (Date.now() - startTime < timeoutMs) {
    const currentPositions = await page.evaluate(() => {
      const folders = Array.from(document.querySelectorAll('.folder-container'));
      return folders.map(f => {
        const title = f.querySelector('.folder-title, h3, .folder-name')?.textContent?.trim();
        return title;
      }).join('|');
    });

    if (currentPositions === lastPositions) {
      stableCount++;
      if (stableCount >= requiredStableChecks) {
        return true;
      }
    } else {
      stableCount = 0;
      lastPositions = currentPositions;
    }

    await page.waitForTimeout(100);
  }

  return false;
}
