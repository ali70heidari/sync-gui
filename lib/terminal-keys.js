export function terminalKeyInput(event) {
  if (event.ctrlKey && event.key.toLowerCase() === 'c') return '\x03';
  if (event.ctrlKey && event.key.toLowerCase() === 'd') return '\x04';
  if (event.key === 'Enter') return '\n';
  if (event.key === 'Tab') return '\t';
  if (event.key === 'Backspace') return '\x7f';
  if (event.key === 'Delete') return '\x1b[3~';
  if (event.key === 'ArrowUp') return '\x1b[A';
  if (event.key === 'ArrowDown') return '\x1b[B';
  if (event.key === 'ArrowRight') return '\x1b[C';
  if (event.key === 'ArrowLeft') return '\x1b[D';
  if (event.key === 'Home') return '\x1b[H';
  if (event.key === 'End') return '\x1b[F';
  if (!event.ctrlKey && !event.metaKey && event.key.length === 1) return event.key;
  return '';
}
