/**
 * Format markdown-like text to styled HTML for display
 */
export function formatMarkdown(text: string): string {
  if (!text) return "";
  
  // Escape HTML to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Split into blocks for proper list handling
  const blocks = escaped.split("\n\n");
  
  const processed = blocks.map(block => {
    // Skip empty blocks
    if (!block.trim()) return "";
    
    // Check if it's a list
    if (block.includes("\n- ") || block.includes("\n* ") || block.startsWith("- ") || block.startsWith("* ")) {
      const items = block.split("\n").filter(l => l.trim());
      const lis = items.map(item => {
        const content = item.replace(/^[-*]\s+/, "");
        return `<li class="ml-5 list-disc text-sm leading-relaxed mb-1">${inlineFormat(content)}</li>`;
      }).join("\n");
      return `<ul class="space-y-1 my-2">${lis}</ul>`;
    }
    
    // Check if it's a numbered list
    if (/^\d+[.)]\s/.test(block.trim())) {
      const items = block.split("\n").filter(l => l.trim());
      const lis = items.map(item => {
        const content = item.replace(/^\d+[.)]\s+/, "");
        return `<li class="ml-5 list-decimal text-sm leading-relaxed mb-1">${inlineFormat(content)}</li>`;
      }).join("\n");
      return `<ol class="space-y-1 my-2">${lis}</ol>`;
    }
    
    // Regular paragraph
    return `<p class="mb-3 leading-relaxed text-sm">${inlineFormat(block)}</p>`;
  });

  return processed.join("\n");
}

function inlineFormat(text: string): string {
  let result = text;
  
  // Code blocks ```code``` - handled at block level, skip inline for now
  
  // Inline code `code`
  result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  
  // Bold **text**
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  
  // Italic *text*
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  
  // Headers ### text - but only if at start of line
  result = result.replace(/^###\s+(.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>');
  result = result.replace(/^##\s+(.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 border-b pb-1">$1</h2>');
  result = result.replace(/^#\s+(.+)$/gm, '<h1 class="text-xl font-bold mt-5 mb-3">$1</h1>');
  
  // Horizontal rule
  result = result.replace(/^---+$/gm, '<hr class="my-4 border-border" />');
  
  // Line breaks within a paragraph
  result = result.replace(/\n/g, "<br/>");
  
  return result;
}
