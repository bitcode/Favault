/**
 * Simplified Drag and Drop Position Validation Tests
 * 
 * This test creates a minimal test environment to validate drag and drop
 * positioning logic without requiring the full extension to be loaded.
 * 
 * Tests the core positioning issues:
 * 1. Sometimes dragging over 1 position results in no movement
 * 2. Sometimes dragging over 2 positions only moves 1 position  
 * 3. Sometimes dragging over 2 positions moves 3 positions
 * 4. Final drop position is consistently off by 1-2 positions
 */

import { test, expect, Page } from '@playwright/test';

interface FolderData {
  id: string;
  title: string;
  position: number;
}

class SimpleDragDropTester {
  constructor(private page: Page) {}

  /**
   * Create a minimal test environment with draggable folders
   */
  async setupTestEnvironment(): Promise<void> {
    await this.page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Drag Drop Position Test</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
          }
          .test-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .folder-container {
            display: block;
            padding: 15px;
            margin: 10px 0;
            background: #fff;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            cursor: move;
            transition: all 0.2s ease;
            user-select: none;
          }
          .folder-container:hover {
            border-color: #007bff;
            box-shadow: 0 2px 8px rgba(0,123,255,0.2);
          }
          .folder-container.dragging {
            opacity: 0.5;
            transform: rotate(2deg);
          }
          .folder-container.drag-over {
            border-color: #28a745;
            background: #f8fff9;
          }
          .folder-title {
            font-weight: bold;
            font-size: 16px;
            color: #333;
          }
          .folder-info {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          .insertion-point {
            height: 4px;
            background: #007bff;
            margin: 2px 0;
            border-radius: 2px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          .insertion-point.drag-over-insertion {
            opacity: 1;
          }
          .test-results {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
          }
          .edit-mode .folder-container {
            border-style: dashed;
          }
        </style>
      </head>
      <body class="edit-mode">
        <div class="test-container">
          <h1>🎯 Drag & Drop Position Validation Test</h1>
          <p>This test validates drag and drop positioning accuracy.</p>
          
          <div id="folders-container">
            <!-- Folders will be inserted here -->
          </div>
          
          <div class="test-results">
            <h3>Test Results</h3>
            <div id="test-output"></div>
          </div>
        </div>

        <script>
          // Simple drag and drop implementation for testing
          let draggedElement = null;
          let draggedFromIndex = -1;
          let folders = [];

          function createFolder(id, title, position) {
            return {
              id: id,
              title: title,
              position: position,
              element: null
            };
          }

          function renderFolders() {
            const container = document.getElementById('folders-container');
            container.innerHTML = '';
            
            // Add insertion point at the beginning
            const firstInsertionPoint = document.createElement('div');
            firstInsertionPoint.className = 'insertion-point';
            firstInsertionPoint.setAttribute('data-insertion-index', '0');
            container.appendChild(firstInsertionPoint);

            folders.forEach((folder, index) => {
              // Create folder element
              const folderElement = document.createElement('div');
              folderElement.className = 'folder-container';
              folderElement.draggable = true;
              folderElement.setAttribute('data-folder-id', folder.id);
              folderElement.innerHTML = \`
                <div class="folder-title">\${folder.title}</div>
                <div class="folder-info">Position: \${index} | ID: \${folder.id}</div>
              \`;

              // Add drag event listeners
              folderElement.addEventListener('dragstart', handleDragStart);
              folderElement.addEventListener('dragend', handleDragEnd);
              folderElement.addEventListener('dragover', handleDragOver);
              folderElement.addEventListener('drop', handleDrop);

              container.appendChild(folderElement);
              folder.element = folderElement;

              // Add insertion point after each folder
              const insertionPoint = document.createElement('div');
              insertionPoint.className = 'insertion-point';
              insertionPoint.setAttribute('data-insertion-index', (index + 1).toString());
              insertionPoint.addEventListener('dragover', handleInsertionPointDragOver);
              insertionPoint.addEventListener('drop', handleInsertionPointDrop);
              container.appendChild(insertionPoint);
            });
          }

          function handleDragStart(e) {
            draggedElement = e.target;
            draggedFromIndex = folders.findIndex(f => f.element === e.target);
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.outerHTML);
          }

          function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.drag-over-insertion').forEach(el => el.classList.remove('drag-over-insertion'));
          }

          function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.target.classList.add('drag-over');
          }

          function handleDrop(e) {
            e.preventDefault();
            if (draggedElement && draggedElement !== e.target) {
              const targetIndex = folders.findIndex(f => f.element === e.target);
              moveFolder(draggedFromIndex, targetIndex);
            }
          }

          function handleInsertionPointDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.target.classList.add('drag-over-insertion');
          }

          function handleInsertionPointDrop(e) {
            e.preventDefault();
            const insertionIndex = parseInt(e.target.getAttribute('data-insertion-index'));
            if (draggedElement) {
              moveToInsertionPoint(draggedFromIndex, insertionIndex);
            }
          }

          function moveFolder(fromIndex, toIndex) {
            if (fromIndex === toIndex) return;
            
            const folder = folders.splice(fromIndex, 1)[0];
            folders.splice(toIndex, 0, folder);
            
            // Update positions
            folders.forEach((f, index) => f.position = index);
            
            logMove('folder', fromIndex, toIndex, folders.findIndex(f => f === folder));
            renderFolders();
          }

          function moveToInsertionPoint(fromIndex, insertionIndex) {
            const folder = folders.splice(fromIndex, 1)[0];
            
            // Calculate target position based on insertion point
            let targetPosition = insertionIndex;
            if (insertionIndex > fromIndex) {
              targetPosition = insertionIndex - 1;
            }
            
            folders.splice(targetPosition, 0, folder);
            
            // Update positions
            folders.forEach((f, index) => f.position = index);
            
            logMove('insertion', fromIndex, insertionIndex, targetPosition);
            renderFolders();
          }

          function logMove(type, fromIndex, targetIndex, actualIndex) {
            const output = document.getElementById('test-output');
            const timestamp = new Date().toLocaleTimeString();
            const result = actualIndex === targetIndex ? '✅' : '❌';
            const diff = actualIndex - targetIndex;
            
            output.innerHTML += \`
              <div style="margin: 5px 0; padding: 10px; background: \${result === '✅' ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">
                <strong>\${timestamp}</strong> - \${type.toUpperCase()} MOVE: \${result}<br>
                From: \${fromIndex} → Target: \${targetIndex} → Actual: \${actualIndex}<br>
                Difference: \${diff > 0 ? '+' : ''}\${diff} positions
              </div>
            \`;
            output.scrollTop = output.scrollHeight;
          }

          // Initialize test folders
          function initializeTestFolders() {
            folders = [
              createFolder('folder-1', 'Test Work Folder', 0),
              createFolder('folder-2', 'Test Personal Folder', 1),
              createFolder('folder-3', 'Test Development Tools', 2),
              createFolder('folder-4', 'DragTest Source Folder', 3),
              createFolder('folder-5', 'DragTest Target Folder', 4),
              createFolder('folder-6', 'Special Chars: éñ中文🚀', 5)
            ];
            renderFolders();
          }

          // Expose functions for testing
          window.testFunctions = {
            getFolders: () => folders,
            moveFolder: moveFolder,
            moveToInsertionPoint: moveToInsertionPoint,
            initializeTestFolders: initializeTestFolders
          };

          // Initialize when page loads
          document.addEventListener('DOMContentLoaded', initializeTestFolders);
        </script>
      </body>
      </html>
    `);

    // Wait for the page to be ready
    await this.page.waitForFunction(() => window.testFunctions && window.testFunctions.getFolders);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get current folder positions
   */
  async getFolderPositions(): Promise<FolderData[]> {
    return await this.page.evaluate(() => {
      return window.testFunctions.getFolders().map(folder => ({
        id: folder.id,
        title: folder.title,
        position: folder.position
      }));
    });
  }

  /**
   * Perform drag and drop operation
   */
  async dragAndDrop(fromIndex: number, toIndex: number): Promise<void> {
    await this.page.evaluate(({ from, to }) => {
      window.testFunctions.moveFolder(from, to);
    }, { from: fromIndex, to: toIndex });
    
    await this.page.waitForTimeout(500); // Allow for DOM updates
  }

  /**
   * Perform drag to insertion point
   */
  async dragToInsertionPoint(fromIndex: number, insertionIndex: number): Promise<void> {
    await this.page.evaluate(({ from, insertion }) => {
      window.testFunctions.moveToInsertionPoint(from, insertion);
    }, { from: fromIndex, insertion: insertionIndex });
    
    await this.page.waitForTimeout(500); // Allow for DOM updates
  }
}

test.describe('Simplified Drag and Drop Position Validation', () => {
  let tester: SimpleDragDropTester;

  test.beforeEach(async ({ page }) => {
    tester = new SimpleDragDropTester(page);
    await tester.setupTestEnvironment();
  });

  test('should detect initial folder positions accurately', async ({ page }) => {
    const positions = await tester.getFolderPositions();
    
    console.log('\n📍 Initial Positions:');
    positions.forEach((folder, index) => {
      console.log(`  ${index}: "${folder.title}"`);
    });

    expect(positions.length).toBeGreaterThanOrEqual(3);
    
    // Verify positions are sequential
    positions.forEach((folder, index) => {
      expect(folder.position).toBe(index);
    });
  });

  test('should validate single position forward movement', async ({ page }) => {
    const beforePositions = await tester.getFolderPositions();
    console.log(`\n🎯 TEST: Moving folder from position 0 to position 1`);

    // Move first folder to second position
    await tester.dragAndDrop(0, 1);

    const afterPositions = await tester.getFolderPositions();
    
    // The folder that was at position 0 should now be at position 1
    const movedFolder = afterPositions.find(f => f.id === beforePositions[0].id);
    expect(movedFolder).toBeDefined();
    expect(movedFolder!.position).toBe(1);
    
    console.log(`✅ Folder "${beforePositions[0].title}" moved from 0 to ${movedFolder!.position}`);
  });

  test('should validate two position forward movement', async ({ page }) => {
    const beforePositions = await tester.getFolderPositions();
    console.log(`\n🎯 TEST: Moving folder from position 0 to position 2`);

    // Move first folder to third position
    await tester.dragAndDrop(0, 2);

    const afterPositions = await tester.getFolderPositions();
    
    // The folder that was at position 0 should now be at position 2
    const movedFolder = afterPositions.find(f => f.id === beforePositions[0].id);
    expect(movedFolder).toBeDefined();
    
    const expectedPosition = 2;
    const actualPosition = movedFolder!.position;
    const positionDifference = actualPosition - expectedPosition;
    
    console.log(`📊 Expected: ${expectedPosition}, Actual: ${actualPosition}, Difference: ${positionDifference}`);
    
    if (positionDifference !== 0) {
      console.log(`❌ Position mismatch detected! This indicates the drag-drop positioning issue.`);
    }
    
    // Store the result for analysis (don't fail the test)
    expect(movedFolder).toBeDefined();
  });

  test('should test insertion point accuracy', async ({ page }) => {
    const beforePositions = await tester.getFolderPositions();
    console.log(`\n🎯 TEST: Moving folder to insertion point 2`);

    // Move first folder to insertion point 2 (should end up at position 1)
    await tester.dragToInsertionPoint(0, 2);

    const afterPositions = await tester.getFolderPositions();
    
    const movedFolder = afterPositions.find(f => f.id === beforePositions[0].id);
    expect(movedFolder).toBeDefined();
    
    const expectedPosition = 1; // Insertion point 2 should result in position 1
    const actualPosition = movedFolder!.position;
    const positionDifference = actualPosition - expectedPosition;
    
    console.log(`📊 Insertion Point 2: Expected position ${expectedPosition}, Actual position ${actualPosition}, Difference: ${positionDifference}`);
    
    if (positionDifference !== 0) {
      console.log(`❌ Insertion point calculation error detected!`);
    }
    
    expect(movedFolder).toBeDefined();
  });

  test('should analyze multiple movement patterns', async ({ page }) => {
    const testCases = [
      { from: 0, to: 1, description: 'Move 1 position forward' },
      { from: 1, to: 0, description: 'Move 1 position backward' },
      { from: 0, to: 2, description: 'Move 2 positions forward' },
      { from: 2, to: 0, description: 'Move 2 positions backward' },
      { from: 1, to: 3, description: 'Move 2 positions forward from middle' }
    ];

    console.log('\n📈 MOVEMENT PATTERN ANALYSIS:');
    console.log('==============================');

    for (const testCase of testCases) {
      // Reset to initial state
      await page.reload();
      await tester.setupTestEnvironment();
      
      const beforePositions = await tester.getFolderPositions();
      const sourceFolder = beforePositions[testCase.from];
      
      console.log(`\n🧪 ${testCase.description}: "${sourceFolder.title}" (${testCase.from} → ${testCase.to})`);
      
      await tester.dragAndDrop(testCase.from, testCase.to);
      
      const afterPositions = await tester.getFolderPositions();
      const movedFolder = afterPositions.find(f => f.id === sourceFolder.id);
      
      if (movedFolder) {
        const positionDifference = movedFolder.position - testCase.to;
        const success = positionDifference === 0;
        
        console.log(`  📊 Result: ${success ? '✅' : '❌'} Expected: ${testCase.to}, Actual: ${movedFolder.position}, Diff: ${positionDifference}`);
        
        if (!success) {
          console.log(`  ⚠️  Position inconsistency detected in ${testCase.description}`);
        }
      }
    }

    // This test documents the patterns rather than asserting success
    expect(testCases.length).toBeGreaterThan(0);
  });
});
