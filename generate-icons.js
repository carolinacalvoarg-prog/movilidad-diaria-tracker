// Node script to generate PNG icons from SVG
// Run once: node generate-icons.js
// Requires: npm install sharp (optional, only for icon generation)
const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.22;

  // Background rounded rect
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Letter M
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2 + size * 0.02);

  return canvas.toBuffer('image/png');
}

try {
  fs.writeFileSync('./icons/icon-192.png', generateIcon(192));
  fs.writeFileSync('./icons/icon-512.png', generateIcon(512));
  console.log('Icons generated.');
} catch (e) {
  console.log('canvas not available, skipping PNG generation.');
}
