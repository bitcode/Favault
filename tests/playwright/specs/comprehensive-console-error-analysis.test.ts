import { test, expect } from '../fixtures/extension';
import { BookmarkTestUtils } from '../utils/bookmark-utils';
import { TestDataSetup } from '../utils/test-data-setup';
import { EnhancedConsoleMonitor, ConsoleAnalysisReport } from '../utils/enhanced-console-monitor';
import { ExtensionTestUtils } from '../fixtures/extension';

/**
 * Comprehensive Console Error Analysis Test Suite
 * Tests every major user interaction and captures console errors for systematic debugging
 */

test.describe('Comprehensive Console Error Analysis', () => {
  let bookmarkUtils: BookmarkTestUtils;
  let testDataSetup: TestDataSetup;
  let consoleMonitor: EnhancedConsoleMonitor;
  let globalReport: ConsoleAnalysisReport | null = null;

  test.beforeAll(async ({ browser }) => {
    console.log('🚀 Starting comprehensive console error analysis...');
    console.log('📋 This test suite will:');
    console.log('   1. Create test bookmarks programmatically');
    console.log('   2. Test every major user interaction');
    console.log('   3. Capture console errors for each interaction');
    console.log('   4. Generate detailed error analysis report');
    console.log('   5. Provide recommendations for fixing issues');
  });

  test.beforeEach(async ({ newTabPage, context }) => {
    bookmarkUtils = new BookmarkTestUtils(newTabPage, context);
    testDataSetup = new TestDataSetup(newTabPage, context);
    consoleMonitor = new EnhancedConsoleMonitor(newTabPage);

    // Start console monitoring immediately
    await consoleMonitor.startMonitoring();
  });

  test.afterEach(async () => {
    // Stop monitoring and capture the report
    if (consoleMonitor) {
      const report = await consoleMonitor.stopMonitoring();
      if (!globalReport) {
        globalReport = report;
      } else {
        // Merge reports if multiple tests run
        globalReport.summary.totalInteractions += report.summary.totalInteractions;
        globalReport.summary.totalErrors += report.summary.totalErrors;
        globalReport.summary.totalWarnings += report.summary.totalWarnings;
        
        // Merge error data
        Object.entries(report.errorsByInteraction).forEach(([interaction, errors]) => {
          if (globalReport!.errorsByInteraction[interaction]) {
            globalReport!.errorsByInteraction[interaction].push(...errors);
          } else {
            globalReport!.errorsByInteraction[interaction] = errors;
          }
        });
        
        globalReport.criticalErrors.push(...report.criticalErrors);
        globalReport.recommendations.push(...report.recommendations);
      }
    }
  });

  test.afterAll(async () => {
    // Generate final comprehensive report
    if (globalReport) {
      console.log('\n🎯 COMPREHENSIVE CONSOLE ERROR ANALYSIS REPORT');
      console.log('================================================');
      console.log(JSON.stringify(globalReport, null, 2));
      
      // Save report to file for easy access
      const fs = require('fs');
      const path = require('path');
      const reportPath = path.join(__dirname, '../../test-results/console-error-analysis-report.json');
      
      try {
        fs.writeFileSync(reportPath, JSON.stringify(globalReport, null, 2));
        console.log(`📄 Full report saved to: ${reportPath}`);
      } catch (error) {
        console.log('⚠️ Could not save report to file:', error.message);
      }
    }
  });

  test('should create comprehensive test bookmark data', async ({ newTabPage, context }) => {
    console.log('📚 Creating comprehensive test bookmark structure...');

    // Initialize test data setup with comprehensive configuration
    await testDataSetup.initialize({
      folderCount: 8,
      bookmarksPerFolder: 4,
      maxNestingLevel: 3,
      includeEmptyFolders: true,
      includeSpecialCharacters: true,
      includeLongTitles: true,
      includeSpecialUrls: true,
      includeDragTestFolders: true,
      includeProtectedFolders: false,
      includeReorderableItems: true,
      browserType: 'chrome'
    });

    // Generate all test data
    const testDataState = await testDataSetup.generateTestData();

    // Generate additional scenarios for comprehensive testing
    await testDataSetup.generateDragDropScenarios();
    await testDataSetup.generateBoundaryConditions();

    // Wait for bookmarks to sync with the extension
    await testDataSetup.waitForBookmarkSync();

    // Validate that bookmarks are visible in the UI
    await bookmarkUtils.waitForBookmarksToLoad();

    const folders = await bookmarkUtils.getBookmarkFolders();
    const allBookmarks = await bookmarkUtils.getAllBookmarks();

    console.log(`✅ Created test environment with:`);
    console.log(`   📁 ${folders.length} bookmark folders`);
    console.log(`   🔖 ${allBookmarks.length} bookmarks`);
    console.log(`   📊 ${testDataState.createdFolders.length} programmatically created folders`);
    console.log(`   📊 ${testDataState.createdBookmarks.length} programmatically created bookmarks`);

    // Basic validation
    expect(folders.length).toBeGreaterThan(0);
    expect(allBookmarks.length).toBeGreaterThan(0);

    // Validate test data integrity
    const validation = await testDataSetup.validateTestData();
    console.log(`🔍 Test data validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
    
    if (!validation.isValid) {
      console.log('❌ Validation errors:', validation.errors);
    }
    
    console.log(`📊 Test data summary:`, validation.summary);
  });

  test('should perform systematic user interaction testing with console error capture', async ({ newTabPage }) => {
    console.log('🎯 Starting systematic user interaction testing...');

    // Wait for page to be fully loaded
    await bookmarkUtils.waitForBookmarksToLoad();

    // Run the complete systematic interaction test suite
    const analysisReport = await consoleMonitor.runSystematicInteractionTests();

    console.log('\n📊 INTERACTION TESTING RESULTS:');
    console.log('================================');
    console.log(`Total Interactions Tested: ${analysisReport.summary.totalInteractions}`);
    console.log(`Interactions with Errors: ${analysisReport.summary.interactionsWithErrors}`);
    console.log(`Error-free Interactions: ${analysisReport.summary.errorFreeInteractions}`);
    console.log(`Total Console Errors: ${analysisReport.summary.totalErrors}`);
    console.log(`Total Console Warnings: ${analysisReport.summary.totalWarnings}`);
    console.log(`Critical Errors: ${analysisReport.criticalErrors.length}`);

    // Log detailed breakdown by interaction
    console.log('\n🔍 ERRORS BY INTERACTION:');
    Object.entries(analysisReport.errorsByInteraction).forEach(([interaction, errors]) => {
      if (errors.length > 0) {
        console.log(`\n❌ ${interaction} (${errors.length} issues):`);
        errors.forEach((error, index) => {
          console.log(`   ${index + 1}. [${error.errorType.toUpperCase()}] ${error.message}`);
          if (error.stack) {
            console.log(`      Stack: ${error.stack.split('\n')[0]}`);
          }
        });
      } else {
        console.log(`✅ ${interaction}: No errors detected`);
      }
    });

    // Log critical errors separately
    if (analysisReport.criticalErrors.length > 0) {
      console.log('\n🚨 CRITICAL ERRORS:');
      analysisReport.criticalErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.action}] ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack.split('\n')[0]}`);
        }
      });
    }

    // Log recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (analysisReport.recommendations.length > 0) {
      analysisReport.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    } else {
      console.log('🎉 No issues found! Your extension is running cleanly.');
    }

    // Assertions to ensure test quality
    expect(analysisReport.summary.totalInteractions).toBeGreaterThan(5);
    
    // Save the global report
    globalReport = analysisReport;
  });

  test('should test specific drag-and-drop console errors', async ({ newTabPage }) => {
    console.log('🔄 Testing drag-and-drop specific console errors...');

    // Ensure we're in edit mode for drag-and-drop
    await ExtensionTestUtils.enableEditMode(newTabPage);
    await newTabPage.waitForTimeout(1000);

    // Get available folders for drag-drop testing
    const folders = await bookmarkUtils.getBookmarkFolders();
    const folderCount = await folders.length;

    console.log(`📁 Found ${folderCount} folders available for drag-drop testing`);

    if (folderCount >= 2) {
      // Test folder reordering with detailed console monitoring
      const sourceFolder = folders[0];
      const targetFolder = folders[1];

      // Get folder titles for reporting
      const sourceTitles = await bookmarkUtils.getFolderTitles();
      console.log(`🎯 Testing drag from "${sourceTitles[0]}" to "${sourceTitles[1]}"`);

      // Start specific monitoring for drag-drop
      const dragDropErrors = await consoleMonitor.captureInteractionErrors({
        name: 'detailed_drag_drop_test',
        description: 'Detailed drag-and-drop operation with console monitoring',
        action: async () => {
          // Get precise positions
          const sourceBox = await sourceFolder.boundingBox();
          const targetBox = await targetFolder.boundingBox();

          if (sourceBox && targetBox) {
            console.log(`📍 Source position: ${sourceBox.x}, ${sourceBox.y}`);
            console.log(`📍 Target position: ${targetBox.x}, ${targetBox.y}`);

            // Simulate detailed drag operation
            await newTabPage.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await newTabPage.waitForTimeout(100);
            
            await newTabPage.mouse.down();
            await newTabPage.waitForTimeout(200);
            
            // Drag with multiple steps for realistic movement
            await newTabPage.mouse.move(
              targetBox.x + targetBox.width / 2, 
              targetBox.y + targetBox.height / 2, 
              { steps: 20 }
            );
            await newTabPage.waitForTimeout(300);
            
            await newTabPage.mouse.up();
            await newTabPage.waitForTimeout(1000);

            // Verify operation completed
            const newTitles = await bookmarkUtils.getFolderTitles();
            console.log(`📊 Folder order after drag: ${newTitles.join(', ')}`);
          }
        }
      });

      console.log(`🔄 Drag-drop operation generated ${dragDropErrors.length} console events`);

      if (dragDropErrors.length > 0) {
        console.log('❌ Drag-drop console errors detected:');
        dragDropErrors.forEach((error, index) => {
          console.log(`   ${index + 1}. [${error.errorType.toUpperCase()}] ${error.message}`);
        });
      } else {
        console.log('✅ Drag-drop operation completed without console errors');
      }
    } else {
      console.log('⚠️ Insufficient folders for drag-drop testing');
    }

    await ExtensionTestUtils.disableEditMode(newTabPage);
  });

  test('should test bookmark interaction console errors', async ({ newTabPage }) => {
    console.log('🔖 Testing bookmark interaction console errors...');

    await bookmarkUtils.waitForBookmarksToLoad();
    
    const allBookmarks = await bookmarkUtils.getAllBookmarks();
    console.log(`🔖 Found ${allBookmarks.length} bookmarks for interaction testing`);

    if (allBookmarks.length > 0) {
      // Test various bookmark interactions
      const bookmarkInteractions = [
        {
          name: 'bookmark_single_click',
          description: 'Single click on bookmark',
          action: async () => {
            await allBookmarks[0].click();
            await newTabPage.waitForTimeout(500);
          }
        },
        {
          name: 'bookmark_double_click',
          description: 'Double click on bookmark',
          action: async () => {
            if (allBookmarks.length > 1) {
              await allBookmarks[1].dblclick();
              await newTabPage.waitForTimeout(500);
            }
          }
        },
        {
          name: 'bookmark_right_click',
          description: 'Right click on bookmark',
          action: async () => {
            if (allBookmarks.length > 2) {
              await allBookmarks[2].click({ button: 'right' });
              await newTabPage.waitForTimeout(500);
              await newTabPage.keyboard.press('Escape');
            }
          }
        },
        {
          name: 'bookmark_hover',
          description: 'Hover over bookmark',
          action: async () => {
            if (allBookmarks.length > 0) {
              await allBookmarks[0].hover();
              await newTabPage.waitForTimeout(300);
            }
          }
        }
      ];

      for (const interaction of bookmarkInteractions) {
        const errors = await consoleMonitor.captureInteractionErrors(interaction);
        
        if (errors.length > 0) {
          console.log(`❌ ${interaction.name} generated ${errors.length} console errors:`);
          errors.forEach((error, index) => {
            console.log(`   ${index + 1}. [${error.errorType.toUpperCase()}] ${error.message}`);
          });
        } else {
          console.log(`✅ ${interaction.name}: No console errors`);
        }
      }
    } else {
      console.log('⚠️ No bookmarks available for interaction testing');
    }
  });

  test('should test edit mode console errors', async ({ newTabPage }) => {
    console.log('✏️ Testing edit mode console errors...');

    // Test edit mode enable/disable cycle multiple times
    const editModeTests = [
      {
        name: 'edit_mode_keyboard_enable',
        description: 'Enable edit mode via keyboard shortcut',
        action: async () => {
          await newTabPage.keyboard.press('Control+e');
          await newTabPage.waitForTimeout(1000);
        }
      },
      {
        name: 'edit_mode_keyboard_disable',
        description: 'Disable edit mode via Escape key',
        action: async () => {
          await newTabPage.keyboard.press('Escape');
          await newTabPage.waitForTimeout(1000);
        }
      },
      {
        name: 'edit_mode_button_enable',
        description: 'Enable edit mode via button click',
        action: async () => {
          const editButton = newTabPage.locator('.edit-toggle, [data-testid="edit-toggle"]').first();
          if (await editButton.isVisible()) {
            await editButton.click();
            await newTabPage.waitForTimeout(1000);
          }
        }
      },
      {
        name: 'edit_mode_button_disable',
        description: 'Disable edit mode via button click',
        action: async () => {
          const editButton = newTabPage.locator('.edit-toggle.active, [data-testid="edit-toggle"][aria-pressed="true"]').first();
          if (await editButton.isVisible()) {
            await editButton.click();
            await newTabPage.waitForTimeout(1000);
          }
        }
      }
    ];

    for (const test of editModeTests) {
      const errors = await consoleMonitor.captureInteractionErrors(test);
      
      if (errors.length > 0) {
        console.log(`❌ ${test.name} generated ${errors.length} console errors:`);
        errors.forEach((error, index) => {
          console.log(`   ${index + 1}. [${error.errorType.toUpperCase()}] ${error.message}`);
        });
      } else {
        console.log(`✅ ${test.name}: No console errors`);
      }
    }
  });

  test('should generate final error analysis summary', async () => {
    console.log('📋 Generating final error analysis summary...');

    if (globalReport) {
      // Calculate error statistics
      const totalInteractionsTested = globalReport.summary.totalInteractions;
      const successRate = Math.round(
        (globalReport.summary.errorFreeInteractions / totalInteractionsTested) * 100
      );

      console.log('\n🎯 FINAL CONSOLE ERROR ANALYSIS SUMMARY');
      console.log('=====================================');
      console.log(`📊 Total User Interactions Tested: ${totalInteractionsTested}`);
      console.log(`✅ Success Rate: ${successRate}% (${globalReport.summary.errorFreeInteractions}/${totalInteractionsTested})`);
      console.log(`❌ Total Console Errors: ${globalReport.summary.totalErrors}`);
      console.log(`⚠️ Total Console Warnings: ${globalReport.summary.totalWarnings}`);
      console.log(`🚨 Critical Errors: ${globalReport.criticalErrors.length}`);

      // Identify most problematic interactions
      const interactionErrorCounts = Object.entries(globalReport.errorsByInteraction)
        .map(([interaction, errors]) => ({ interaction, count: errors.length }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      if (interactionErrorCounts.length > 0) {
        console.log('\n🔍 MOST PROBLEMATIC INTERACTIONS:');
        interactionErrorCounts.slice(0, 5).forEach((item, index) => {
          console.log(`${index + 1}. ${item.interaction}: ${item.count} errors`);
        });
      }

      // Priority recommendations
      console.log('\n💡 PRIORITY RECOMMENDATIONS:');
      const uniqueRecommendations = [...new Set(globalReport.recommendations)];
      uniqueRecommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });

      // Overall health assessment
      let healthStatus = 'EXCELLENT';
      if (globalReport.criticalErrors.length > 0) {
        healthStatus = 'CRITICAL';
      } else if (globalReport.summary.totalErrors > 5) {
        healthStatus = 'NEEDS ATTENTION';
      } else if (globalReport.summary.totalErrors > 0) {
        healthStatus = 'GOOD';
      }

      console.log(`\n🏥 EXTENSION HEALTH STATUS: ${healthStatus}`);
      
      // Test assertions based on findings
      expect(globalReport.summary.totalInteractions).toBeGreaterThan(0);
      
      // Warn about critical errors but don't fail the test
      if (globalReport.criticalErrors.length > 0) {
        console.warn(`⚠️ Found ${globalReport.criticalErrors.length} critical errors that need immediate attention`);
      }
      
      // The test passes regardless of errors found - this is diagnostic, not blocking
      console.log('\n✅ Console error analysis completed successfully');
      console.log('📄 Review the detailed report above to address any identified issues');
    } else {
      console.log('⚠️ No error analysis report available');
    }
  });
});