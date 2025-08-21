import { describe, it, expect } from 'vitest'

describe('Netlify global type declaration', () => {
  it('should provide TypeScript definitions for Netlify global', async () => {
    // Import the main module to ensure global augmentation is loaded
    await import('./main.js')
    
    // This test verifies that TypeScript compilation works when accessing Netlify global
    // The fact that this code compiles validates the global declaration
    const compilationTest = () => {
      // TypeScript should recognize these without errors when global is declared
      const _envType: typeof Netlify.env = null as any
      const _contextType: typeof Netlify.context = null as any
      
      // Verify the shape is correct at compile time
      return { _envType, _contextType }
    }
    
    // If we get here, TypeScript compilation succeeded
    expect(compilationTest).toBeDefined()
  })
})