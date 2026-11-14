// Shared by the pipeline resolver and the browser configuration editor.
export function parseModelPatterns(value, key = '模型列表') {
  if (!value.trim()) return [];
  const patterns = value.split(',').map(item => item.trim());
  if (patterns.some(pattern => !/^[a-zA-Z0-9*][a-zA-Z0-9._:/*-]*$/.test(pattern)
      || !/[a-zA-Z0-9]/.test(pattern) || pattern.includes('**'))) {
    throw new Error(`${key} 须为逗号分隔的模型 ID 或含 * 的规则；须含字母或数字，不能使用连续 **。`);
  }
  return [...new Set(patterns)];
}
export function modelPatternMatches(model, pattern) {
  const expression = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + expression + '$').test(model);
}
