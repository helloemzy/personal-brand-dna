import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store';
import CollaborativeRichEditor from './CollaborativeRichEditor';

describe('CollaborativeRichEditor XSS Protection', () => {
  const renderEditor = (value: string) => {
    const mockOnChange = jest.fn();
    return render(
      <Provider store={store}>
        <CollaborativeRichEditor
          value={value}
          onChange={mockOnChange}
          context="test"
          placeholder="Enter text..."
        />
      </Provider>
    );
  };

  it('should sanitize script tags', () => {
    const maliciousContent = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
    renderEditor(maliciousContent);
    
    // Script tags should be removed
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).not.toContain('<script>');
    expect(editor.innerHTML).not.toContain('alert');
  });

  it('should sanitize event handlers', () => {
    const maliciousContent = '<p onclick="alert(\'XSS\')">Click me</p>';
    renderEditor(maliciousContent);
    
    // onclick should be removed
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).not.toContain('onclick');
  });

  it('should sanitize javascript: URLs', () => {
    const maliciousContent = '<a href="javascript:alert(\'XSS\')">Click</a>';
    renderEditor(maliciousContent);
    
    // javascript: protocol should be removed
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).not.toContain('javascript:');
  });

  it('should allow safe HTML tags', () => {
    const safeContent = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
    renderEditor(safeContent);
    
    // Safe tags should be preserved
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).toContain('<strong>');
    expect(editor.innerHTML).toContain('<em>');
  });

  it('should allow safe links', () => {
    const safeContent = '<a href="https://example.com" target="_blank" rel="noopener">Safe link</a>';
    renderEditor(safeContent);
    
    // Safe links should be preserved
    const editor = screen.getByRole('textbox');
    expect(editor.innerHTML).toContain('href="https://example.com"');
    expect(editor.innerHTML).toContain('target="_blank"');
  });
});